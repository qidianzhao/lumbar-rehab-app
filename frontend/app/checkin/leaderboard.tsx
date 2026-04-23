import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import {
  getLeaderboard,
  getMedalEmoji,
  PERIOD_LABELS,
  PERIODS,
  type LeaderboardData,
  type LeaderboardEntry,
  type LeaderboardPeriod,
} from '@/src/services/leaderboardService';

// ─── 子组件 ────────────────────────────────────────────────

function PeriodTabs({
  active,
  onChange,
  tint,
  text,
  border,
}: {
  active: LeaderboardPeriod;
  onChange: (p: LeaderboardPeriod) => void;
  tint: string;
  text: string;
  border: string;
}) {
  return (
    <View style={[tabStyles.wrap, { borderColor: border }]}>
      {PERIODS.map((p) => (
        <Pressable
          key={p}
          style={[tabStyles.tab, active === p && { backgroundColor: tint }]}
          onPress={() => onChange(p)}
        >
          <Text style={[tabStyles.label, { color: active === p ? '#fff' : text }]}>
            {PERIOD_LABELS[p]}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

function EntryRow({
  entry,
  tint,
  text,
  border,
}: {
  entry: LeaderboardEntry;
  tint: string;
  text: string;
  border: string;
}) {
  const medal = getMedalEmoji(entry.rank);
  return (
    <View
      style={[
        rowStyles.wrap,
        { borderColor: border },
        entry.is_me && { borderColor: tint, borderWidth: 1.5 },
      ]}
    >
      {/* 排名 */}
      <View style={rowStyles.rankWrap}>
        {medal ? (
          <Text style={rowStyles.medal}>{medal}</Text>
        ) : (
          <Text style={[rowStyles.rankNum, { color: text }]}>{entry.rank}</Text>
        )}
      </View>

      {/* 昵称 */}
      <View style={rowStyles.info}>
        <Text style={[rowStyles.name, { color: text }]}>
          {entry.display_name}
          {entry.is_me && <Text style={{ color: tint }}> （我）</Text>}
        </Text>
        <Text style={[rowStyles.sub, { color: text }]}>
          连续 {entry.streak_days} 天
        </Text>
      </View>

      {/* 天数 */}
      <View style={rowStyles.daysWrap}>
        <Text style={[rowStyles.daysNum, { color: tint }]}>{entry.checkin_days}</Text>
        <Text style={[rowStyles.daysSub, { color: text }]}>天</Text>
      </View>
    </View>
  );
}

// ─── 主页面 ────────────────────────────────────────────────

export default function CheckinLeaderboardScreen() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];

  const [period, setPeriod] = useState<LeaderboardPeriod>('WEEK');
  const [data, setData] = useState<LeaderboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (p: LeaderboardPeriod, silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const result = await getLeaderboard(p);
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void fetchData(period);
  }, [period, fetchData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void fetchData(period, true);
  }, [period, fetchData]);

  const onPeriodChange = useCallback((p: LeaderboardPeriod) => {
    setPeriod(p);
    setData(null);
  }, []);

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      {/* Tab 切换 */}
      <PeriodTabs
        active={period}
        onChange={onPeriodChange}
        tint={theme.tint}
        text={theme.text}
        border={theme.tabIconDefault}
      />

      {/* 列表 */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.tint} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={{ color: theme.text }}>{error}</Text>
          <Pressable
            style={[styles.retryBtn, { backgroundColor: theme.tint }]}
            onPress={() => fetchData(period)}
          >
            <Text style={styles.retryText}>重试</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={data?.entries ?? []}
          keyExtractor={(item) => String(item.user_id)}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.tint} />
          }
          renderItem={({ item }) => (
            <EntryRow
              entry={item}
              tint={theme.tint}
              text={theme.text}
              border={theme.tabIconDefault}
            />
          )}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={{ color: theme.text, opacity: 0.5 }}>暂无排行数据</Text>
            </View>
          }
          // 底部固定「我的排名」用 ListFooterComponent + 底部 padding 实现
          ListFooterComponent={<View style={{ height: 100 }} />}
        />
      )}

      {/* 底部固定：我的排名 */}
      {!loading && !error && data?.my_entry && (
        <View
          style={[
            styles.myRankBar,
            { borderTopColor: theme.tabIconDefault, backgroundColor: theme.background },
          ]}
        >
          <Text style={[styles.myRankLabel, { color: theme.text }]}>我的排名</Text>
          {data.my_rank ? (
            <View style={styles.myRankContent}>
              <Text style={[styles.myRankNum, { color: theme.tint }]}>
                {getMedalEmoji(data.my_rank) ?? `#${data.my_rank}`}
              </Text>
              <Text style={[styles.myRankDays, { color: theme.text }]}>
                {data.my_entry.checkin_days} 天打卡 · 连续 {data.my_entry.streak_days} 天
              </Text>
            </View>
          ) : (
            <Text style={{ color: theme.text, opacity: 0.5 }}>暂未上榜</Text>
          )}
        </View>
      )}
    </View>
  );
}

// ─── 样式 ────────────────────────────────────────────────

const tabStyles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    margin: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    overflow: 'hidden',
  },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center' },
  label: { fontSize: 14, fontWeight: '600' },
});

const rowStyles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    gap: 12,
  },
  rankWrap: { width: 36, alignItems: 'center' },
  medal: { fontSize: 24 },
  rankNum: { fontSize: 16, fontWeight: '700' },
  info: { flex: 1, gap: 3 },
  name: { fontSize: 15, fontWeight: '600' },
  sub: { fontSize: 12, opacity: 0.55 },
  daysWrap: { alignItems: 'flex-end' },
  daysNum: { fontSize: 22, fontWeight: '900' },
  daysSub: { fontSize: 11, opacity: 0.6 },
});

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, padding: 24 },
  list: { paddingHorizontal: 16, paddingTop: 4 },
  retryBtn: { paddingHorizontal: 24, paddingVertical: 10, borderRadius: 8 },
  retryText: { color: '#fff', fontWeight: '700' },
  myRankBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    padding: 16,
    paddingBottom: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  myRankLabel: { fontSize: 14, fontWeight: '600', opacity: 0.6 },
  myRankContent: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  myRankNum: { fontSize: 20, fontWeight: '900' },
  myRankDays: { fontSize: 13 },
});
