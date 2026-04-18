import { type Href, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import type { SessionHistoryItem } from '@/src/services/trainingApi';
import { getSessionHistory } from '@/src/services/trainingApi';

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDuration(seconds: number | null): string {
  if (seconds == null) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}分${s > 0 ? `${s}秒` : ''}` : `${s}秒`;
}

const STATUS_LABELS: Record<string, string> = {
  completed: '已完成',
  in_progress: '进行中',
  abandoned: '已放弃',
};

type Props = { item: SessionHistoryItem; onPress: () => void; tint: string; text: string; border: string };

function SessionCard({ item, onPress, tint, text, border }: Props) {
  const rate = item.completion_rate != null ? `${item.completion_rate.toFixed(0)}%` : '—';
  const status = STATUS_LABELS[item.status] ?? item.status;
  return (
    <Pressable style={[styles.card, { borderColor: border }]} onPress={onPress}>
      <View style={styles.cardTop}>
        <Text style={[styles.date, { color: text }]}>{formatDate(item.started_at)}</Text>
        <Text style={[styles.status, { color: tint }]}>{status}</Text>
      </View>
      <View style={styles.cardBottom}>
        <View style={styles.metaItem}>
          <Text style={[styles.metaLabel, { color: text }]}>时长</Text>
          <Text style={[styles.metaVal, { color: text }]}>{formatDuration(item.duration_seconds)}</Text>
        </View>
        <View style={styles.metaItem}>
          <Text style={[styles.metaLabel, { color: text }]}>完成率</Text>
          <Text style={[styles.metaVal, { color: tint }]}>{rate}</Text>
        </View>
        <View style={styles.metaItem}>
          <Text style={[styles.metaLabel, { color: text }]}>计划ID</Text>
          <Text style={[styles.metaVal, { color: text }]}>#{item.plan_id}</Text>
        </View>
      </View>
    </Pressable>
  );
}

export default function TrainingRecordsScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];

  const [items, setItems] = useState<SessionHistoryItem[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const PAGE_SIZE = 20;

  const fetchPage = useCallback(async (p: number, replace: boolean) => {
    try {
      const data = await getSessionHistory(p, PAGE_SIZE);
      setTotal(data.total);
      setItems((prev) => (replace ? data.items : [...prev, ...data.items]));
      setPage(p);
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败');
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    void fetchPage(1, true).finally(() => setLoading(false));
  }, [fetchPage]);

  const onLoadMore = useCallback(async () => {
    if (loadingMore || items.length >= total) return;
    setLoadingMore(true);
    await fetchPage(page + 1, false);
    setLoadingMore(false);
  }, [loadingMore, items.length, total, fetchPage, page]);

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.tint} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <Text style={{ color: theme.text }}>{error}</Text>
        <Pressable
          style={[styles.retryBtn, { backgroundColor: theme.tint }]}
          onPress={() => {
            setError(null);
            setLoading(true);
            void fetchPage(1, true).finally(() => setLoading(false));
          }}
        >
          <Text style={styles.retryText}>重试</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <FlatList
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.list}
      data={items}
      keyExtractor={(item) => String(item.id)}
      renderItem={({ item }) => (
        <SessionCard
          item={item}
          tint={theme.tint}
          text={theme.text}
          border={theme.tabIconDefault}
          onPress={() =>
            router.push(`/training/report?session_id=${item.id}` as unknown as Href)
          }
        />
      )}
      ListEmptyComponent={
        <View style={styles.center}>
          <Text style={{ color: theme.text, opacity: 0.6 }}>暂无训练记录</Text>
        </View>
      }
      ListFooterComponent={
        loadingMore ? (
          <ActivityIndicator color={theme.tint} style={{ margin: 16 }} />
        ) : items.length < total ? (
          <Pressable style={styles.moreBtn} onPress={onLoadMore}>
            <Text style={{ color: theme.tint, fontWeight: '700' }}>加载更多</Text>
          </Pressable>
        ) : items.length > 0 ? (
          <Text style={[styles.end, { color: theme.text }]}>已显示全部 {total} 条记录</Text>
        ) : null
      }
      onEndReached={onLoadMore}
      onEndReachedThreshold={0.2}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 12, minHeight: 200 },
  list: { padding: 16, gap: 12, paddingBottom: 32 },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 14,
    gap: 10,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  date: { fontSize: 15, fontWeight: '700' },
  status: { fontSize: 13, fontWeight: '600' },
  cardBottom: { flexDirection: 'row', gap: 24 },
  metaItem: { gap: 2 },
  metaLabel: { fontSize: 11, opacity: 0.6 },
  metaVal: { fontSize: 14, fontWeight: '700' },
  retryBtn: { paddingHorizontal: 24, paddingVertical: 10, borderRadius: 8 },
  retryText: { color: '#fff', fontWeight: '700' },
  moreBtn: { alignItems: 'center', paddingVertical: 16 },
  end: { textAlign: 'center', paddingVertical: 16, fontSize: 12, opacity: 0.5 },
});
