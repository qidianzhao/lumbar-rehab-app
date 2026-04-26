import FontAwesome from '@expo/vector-icons/FontAwesome';
import { type Href, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import * as planApi from '@/src/services/planApi';

const LEVEL_LABEL: Record<string, string> = {
  beginner: '入门',
  intermediate: '进阶',
  advanced: '强化',
};

const STATUS_LABEL: Record<string, string> = {
  draft: '草稿',
  active: '进行中',
  archived: '已归档',
};

const WEEKDAY_LABEL = ['一', '二', '三', '四', '五', '六', '日'];

export default function PlansScreen() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState<planApi.TrainingPlan | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const p = await planApi.getCurrentPlan();
        if (!cancelled) {
          setPlan(p);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : '加载失败');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useFocusEffect(load);

  const progressWeek = plan?.progress_week ?? 1;
  const thisWeekDays =
    plan?.days.filter((d) => d.week_number === progressWeek) ?? [];

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.tint} />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={[styles.muted, { color: theme.text }]}>{error}</Text>
          <Pressable style={[styles.btn, { backgroundColor: theme.tint }]} onPress={load}>
            <Text style={styles.btnText}>重试</Text>
          </Pressable>
        </View>
      ) : !plan ? (
        <View style={styles.emptyWrap}>
          <FontAwesome name="calendar-o" size={48} color={theme.tabIconDefault} />
          <Text style={[styles.emptyTitle, { color: theme.text }]}>暂无训练计划</Text>
          <Text style={[styles.muted, { color: theme.text }]}>
            生成一份个性化计划，按周安排热身、核心与拉伸。
          </Text>
          <Pressable
            style={[styles.btn, { backgroundColor: theme.tint, marginTop: 20 }]}
            onPress={() => router.push('/plans/generate' as Href)}
          >
            <Text style={styles.btnText}>生成训练计划</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={[styles.card, { borderColor: theme.tabIconDefault }]}>
            <Text style={[styles.planTitle, { color: theme.text }]}>{plan.name}</Text>
            <View style={styles.row}>
              <Text style={[styles.tag, { color: theme.tint }]}>
                {LEVEL_LABEL[plan.level] ?? plan.level}
              </Text>
              <Text style={[styles.tag, { color: theme.text }]}>
                {STATUS_LABEL[plan.status] ?? plan.status}
              </Text>
            </View>
            {plan.description ? (
              <Text style={[styles.desc, { color: theme.text }]}>{plan.description}</Text>
            ) : null}
            <View style={styles.progressRow}>
              <Text style={[styles.progressLabel, { color: theme.text }]}>进度</Text>
              <Text style={[styles.progressValue, { color: theme.tint }]}>
                第 {progressWeek} / {plan.estimated_weeks} 周
              </Text>
            </View>
            <Pressable
              onPress={() => router.push(`/plan/${plan.id}` as Href)}
              style={styles.linkRow}
            >
              <Text style={{ color: theme.tint, fontSize: 15 }}>查看完整计划</Text>
              <FontAwesome name="chevron-right" size={12} color={theme.tint} />
            </Pressable>
          </View>

          <Text style={[styles.sectionTitle, { color: theme.text }]}>本周日程</Text>
          {thisWeekDays.length === 0 ? (
            <Text style={[styles.muted, { color: theme.text }]}>
              本周暂无排期（可进入详情查看其它周）
            </Text>
          ) : (
            thisWeekDays.map((d) => (
              <View
                key={d.id}
                style={[styles.dayRow, { borderColor: theme.tabIconDefault }]}
              >
                <View style={styles.dayMeta}>
                  <Text style={[styles.dayTitle, { color: theme.text }]}>{d.title}</Text>
                  <Text style={[styles.muted, { color: theme.text }]}>
                    约 {d.estimated_duration} 分钟 · 周{WEEKDAY_LABEL[d.day_number - 1] ?? d.day_number}
                  </Text>
                </View>
                <Text style={[styles.count, { color: theme.tint }]}>
                  {d.exercises.length} 个动作
                </Text>
              </View>
            ))
          )}
        </ScrollView>
      )}

      {plan ? (
        <View
          style={[
            styles.footer,
            { borderTopColor: theme.tabIconDefault, backgroundColor: theme.background },
          ]}
        >
          <Pressable
            style={[styles.btnOutline, { borderColor: theme.tint }]}
            onPress={() => router.push('/plans/generate' as Href)}
          >
            <Text style={[styles.btnOutlineText, { color: theme.tint }]}>生成新计划</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 12 },
  scroll: { padding: 16, paddingBottom: 100 },
  emptyWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    gap: 8,
  },
  emptyTitle: { fontSize: 18, fontWeight: '600', marginTop: 12 },
  muted: { fontSize: 14, opacity: 0.75, textAlign: 'center' },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  planTitle: { fontSize: 20, fontWeight: '700', marginBottom: 8 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  tag: { fontSize: 13, fontWeight: '600' },
  desc: { fontSize: 14, lineHeight: 20, marginBottom: 12 },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressLabel: { fontSize: 15 },
  progressValue: { fontSize: 16, fontWeight: '700' },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12 },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  dayMeta: { flex: 1, paddingRight: 8 },
  dayTitle: { fontSize: 15, fontWeight: '600', marginBottom: 4 },
  count: { fontSize: 13, fontWeight: '600' },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 16,
    paddingBottom: 24,
    borderTopWidth: StyleSheet.hairlineWidth,
    backgroundColor: 'transparent',
  },
  btn: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
    alignItems: 'center',
  },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  btnOutline: {
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  btnOutlineText: { fontSize: 16, fontWeight: '600' },
});
