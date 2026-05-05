import FontAwesome from '@expo/vector-icons/FontAwesome';
import { type Href, useRouter, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import type { AssessmentTestItem } from '@/src/services/assessmentApi';
import { getTestItems } from '@/src/services/assessmentApi';
import { handleError } from '@/src/utils/errorHandler';

const ASSESSMENT_PROGRESS_KEY = '@assessment_progress';

const DIMENSION_LABELS: Record<string, string> = {
  core_endurance: '核心耐力',
  glute_strength: '臀部力量',
  spine_stability: '脊柱稳定',
  core_control: '核心控制',
  spine_mobility: '脊柱灵活',
  flexibility: '柔韧性',
};

const METRIC_LABELS: Record<string, string> = {
  seconds: '秒',
  reps: '次',
  rating_1_5: '1-5分',
};

export default function AssessmentIntroScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];

  const [items, setItems] = useState<AssessmentTestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasSavedProgress, setHasSavedProgress] = useState(false);

  // 加载测试项目（只在首次加载时执行）
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const list = await getTestItems();
        if (!cancelled) setItems(list);
      } catch (e) {
        if (!cancelled) {
          const errorInfo = handleError(e, '加载测试项目');
          setError(errorInfo.message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // 每次页面获得焦点时检查是否有保存的进度
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void (async () => {
        try {
          const saved = await AsyncStorage.getItem(ASSESSMENT_PROGRESS_KEY);
          if (!cancelled) {
            setHasSavedProgress(!!saved);
          }
        } catch (e) {
          // 忽略错误
        }
      })();
      return () => { cancelled = true; };
    }, [])
  );

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.background }}
      contentContainerStyle={styles.scroll}
    >
      {/* 标题区 */}
      <View style={styles.header}>
        <FontAwesome name="clipboard" size={44} color={theme.tint} />
        <Text style={[styles.title, { color: theme.text }]}>体能测试与评估</Text>
        <Text style={[styles.sub, { color: theme.text }]}>
          约 15 分钟 · 6 个动作 · 用于生成更适合你的训练计划
        </Text>
      </View>

      {/* 注意事项 */}
      <View style={[styles.card, { borderColor: theme.tabIconDefault }]}>
        <Text style={[styles.cardTitle, { color: theme.text }]}>注意事项</Text>
        <Text style={[styles.item, { color: theme.text }]}>· 量力而行，不追求极限</Text>
        <Text style={[styles.item, { color: theme.text }]}>· 不适 / 疼痛明显请立即停止</Text>
        <Text style={[styles.item, { color: theme.text }]}>· 动作保持标准姿势，宁少勿乱</Text>
      </View>

      {/* 未完成进度提示 */}
      {hasSavedProgress && (
        <View style={[styles.card, { borderColor: theme.tint, backgroundColor: `${theme.tint}11` }]}>
          <View style={styles.progressNotice}>
            <FontAwesome name="info-circle" size={20} color={theme.tint} />
            <Text style={[styles.progressText, { color: theme.tint }]}>
              检测到未完成的测试进度，点击"继续测试"可恢复
            </Text>
          </View>
        </View>
      )}

      {/* 测试项目列表 */}
      <View style={[styles.card, { borderColor: theme.tabIconDefault }]}>
        <Text style={[styles.cardTitle, { color: theme.text }]}>测试项目</Text>

        {loading && (
          <ActivityIndicator size="small" color={theme.tint} style={{ marginVertical: 12 }} />
        )}

        {error && (
          <Text style={styles.err}>{error}</Text>
        )}

        {!loading && !error && items.map((it, idx) => (
          <View
            key={it.action_id}
            style={[
              styles.testRow,
              idx < items.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.tabIconDefault },
            ]}
          >
            <View style={[styles.indexBadge, { backgroundColor: `${theme.tint}22` }]}>
              <Text style={[styles.indexText, { color: theme.tint }]}>{idx + 1}</Text>
            </View>
            <View style={styles.testInfo}>
              <Text style={[styles.testName, { color: theme.text }]}>{it.name}</Text>
              <Text style={[styles.testMeta, { color: theme.text }]}>
                {DIMENSION_LABELS[it.dimension] ?? it.dimension} · {METRIC_LABELS[it.metric_type] ?? it.metric_type}
              </Text>
              <Text style={[styles.testPrompt, { color: theme.text }]} numberOfLines={2}>
                {it.prompt}
              </Text>
            </View>
          </View>
        ))}

        {!loading && !error && items.length === 0 && (
          <Text style={[styles.item, { color: theme.text }]}>暂无测试项目</Text>
        )}
      </View>

      {/* 开始按钮 */}
      <Pressable
        style={[styles.btn, { backgroundColor: theme.tint }]}
        onPress={() => router.push('/assessment/test' as Href)}
      >
        <Text style={styles.btnText}>{hasSavedProgress ? '继续测试' : '开始测试'}</Text>
      </Pressable>

      {/* 重新开始按钮 */}
      {hasSavedProgress && (
        <Pressable
          style={[styles.btnOutline, { borderColor: theme.tabIconDefault }]}
          onPress={async () => {
            await AsyncStorage.removeItem(ASSESSMENT_PROGRESS_KEY);
            setHasSavedProgress(false);
            router.push('/assessment/test' as Href);
          }}
        >
          <Text style={[styles.btnOutlineText, { color: theme.text }]}>重新开始测试</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 20, paddingBottom: 40 },
  header: { alignItems: 'center', marginBottom: 20, gap: 8 },
  title: { fontSize: 22, fontWeight: '800' },
  sub: { fontSize: 14, opacity: 0.8, textAlign: 'center', lineHeight: 20 },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  cardTitle: { fontSize: 16, fontWeight: '700', marginBottom: 10 },
  item: { fontSize: 14, lineHeight: 22, opacity: 0.9 },
  testRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    gap: 12,
  },
  indexBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  indexText: { fontSize: 13, fontWeight: '800' },
  testInfo: { flex: 1, gap: 3 },
  testName: { fontSize: 15, fontWeight: '700' },
  testMeta: { fontSize: 12, opacity: 0.6 },
  testPrompt: { fontSize: 13, opacity: 0.75, lineHeight: 18 },
  btn: { paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginTop: 4 },
  btnText: { color: '#fff', fontSize: 17, fontWeight: '800' },
  btnOutline: { paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginTop: 12, borderWidth: 1 },
  btnOutlineText: { fontSize: 17, fontWeight: '800' },
  err: { color: '#c62828', fontSize: 13, marginVertical: 8 },
  progressNotice: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  progressText: { flex: 1, fontSize: 14, lineHeight: 20, fontWeight: '600' },
});
