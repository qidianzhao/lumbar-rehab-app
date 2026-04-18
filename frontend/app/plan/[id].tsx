import FontAwesome from '@expo/vector-icons/FontAwesome';
import { type Href, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  LayoutAnimation,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  UIManager,
  View,
} from 'react-native';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import type { PlanDay, PlanExercise, TrainingPlan } from '@/src/services/planApi';
import * as planApi from '@/src/services/planApi';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const PHASE_LABEL: Record<string, string> = {
  warmup: '热身',
  core: '核心',
  stretch: '拉伸',
};

function groupByWeek(days: PlanDay[]) {
  const map = new Map<number, PlanDay[]>();
  for (const d of days) {
    const list = map.get(d.week_number) ?? [];
    list.push(d);
    map.set(d.week_number, list);
  }
  for (const [, list] of map) {
    list.sort((a, b) => a.day_number - b.day_number);
  }
  return [...map.entries()].sort((a, b) => a[0] - b[0]);
}

export default function PlanDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const planId = Number(id);
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState<TrainingPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [confirming, setConfirming] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const defaultPlanDay = useMemo(() => {
    if (!plan?.days?.length) return null;
    const pw = plan.progress_week ?? 1;
    const weekDays = plan.days.filter((d) => d.week_number === pw);
    return weekDays[0] ?? plan.days[0] ?? null;
  }, [plan]);

  useEffect(() => {
    if (!Number.isFinite(planId)) {
      setError('无效的计划 ID');
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const p = await planApi.getPlanById(planId);
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
  }, [planId, reloadKey]);

  function retry() {
    setReloadKey((k) => k + 1);
  }

  const weeks = useMemo(() => (plan ? groupByWeek(plan.days) : []), [plan]);

  function toggleDay(dayId: number) {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((prev) => ({ ...prev, [dayId]: !prev[dayId] }));
  }

  async function onConfirm() {
    if (!plan) return;
    setConfirming(true);
    try {
      const p = await planApi.confirmPlan(plan.id);
      setPlan(p);
    } catch (e) {
      setError(e instanceof Error ? e.message : '确认失败');
    } finally {
      setConfirming(false);
    }
  }

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.tint} />
      </View>
    );
  }

  if (error || !plan) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <Text style={{ color: theme.text }}>{error ?? '未找到计划'}</Text>
        <Pressable style={[styles.primaryBtn, { backgroundColor: theme.tint }]} onPress={retry}>
          <Text style={styles.primaryBtnText}>重试</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={[styles.title, { color: theme.text }]}>{plan.name}</Text>
        <Text style={[styles.meta, { color: theme.text }]}>
          共 {plan.estimated_weeks} 周 · 每周 {plan.weekly_frequency} 练
          {plan.preferred_duration_minutes
            ? ` · 单次约 ${plan.preferred_duration_minutes} 分钟`
            : ''}
        </Text>
        {plan.status === 'draft' ? (
          <View style={[styles.banner, { borderColor: theme.tint }]}>
            <Text style={[styles.bannerText, { color: theme.text }]}>
              当前为草稿，确认后将启用并归档其它进行中计划。
            </Text>
            <Pressable
              style={[styles.primaryBtn, { backgroundColor: theme.tint, opacity: confirming ? 0.7 : 1 }]}
              onPress={onConfirm}
              disabled={confirming}
            >
              <Text style={styles.primaryBtnText}>{confirming ? '确认中…' : '确认启用计划'}</Text>
            </Pressable>
          </View>
        ) : null}

        {weeks.map(([weekNum, days]) => (
          <View key={weekNum} style={styles.weekBlock}>
            <Text style={[styles.weekTitle, { color: theme.tint }]}>第 {weekNum} 周</Text>
            {days.map((day) => (
              <View
                key={day.id}
                style={[styles.dayCard, { borderColor: theme.tabIconDefault }]}
              >
                <Pressable style={styles.dayHeader} onPress={() => toggleDay(day.id)}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.dayTitle, { color: theme.text }]}>{day.title}</Text>
                    <Text style={[styles.daySub, { color: theme.text }]}>
                      约 {day.estimated_duration} 分钟
                    </Text>
                  </View>
                  <FontAwesome
                    name={expanded[day.id] ? 'chevron-up' : 'chevron-down'}
                    size={16}
                    color={theme.tint}
                  />
                </Pressable>
                {expanded[day.id] ? (
                  <View style={styles.exerciseList}>
                    {renderPhases(day.exercises, theme)}
                  </View>
                ) : null}
              </View>
            ))}
          </View>
        ))}
      </ScrollView>

      <View
        style={[
          styles.footer,
          { borderTopColor: theme.tabIconDefault, backgroundColor: theme.background },
        ]}
      >
        <Pressable
          style={[styles.primaryBtn, { backgroundColor: theme.tint, opacity: defaultPlanDay ? 1 : 0.5 }]}
          disabled={!defaultPlanDay}
          onPress={() => {
            if (!plan || !defaultPlanDay) return;
            router.push(
              `/training/pre-check?planId=${plan.id}&planDayId=${defaultPlanDay.id}` as Href,
            );
          }}
        >
          <Text style={styles.primaryBtnText}>开始训练</Text>
        </Pressable>
      </View>
    </View>
  );
}

function renderPhases(
  exercises: PlanExercise[],
  theme: (typeof Colors)['light'] | (typeof Colors)['dark'],
) {
  const byPhase: Record<string, PlanExercise[]> = {};
  for (const ex of exercises) {
    const list = byPhase[ex.phase] ?? [];
    list.push(ex);
    byPhase[ex.phase] = list;
  }
  const order = ['warmup', 'core', 'stretch'];
  return order
    .filter((p) => byPhase[p]?.length)
    .map((phase) => (
      <View key={phase} style={styles.phaseBlock}>
        <Text style={[styles.phaseTitle, { color: theme.tint }]}>
          {PHASE_LABEL[phase] ?? phase}
        </Text>
        {byPhase[phase]!.map((ex) => (
          <View key={ex.id} style={styles.exerciseRow}>
            <Text style={[styles.exName, { color: theme.text }]}>{ex.name}</Text>
            <Text style={[styles.exDetail, { color: theme.text }]}>
              {ex.sets} 组 × {ex.reps} 次 · 休息 {ex.rest_seconds}s
            </Text>
          </View>
        ))}
      </View>
    ));
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 12 },
  scroll: { padding: 16, paddingBottom: 120 },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 6 },
  meta: { fontSize: 14, opacity: 0.85, marginBottom: 16 },
  banner: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    gap: 10,
  },
  bannerText: { fontSize: 14, lineHeight: 20 },
  weekBlock: { marginBottom: 18 },
  weekTitle: { fontSize: 17, fontWeight: '700', marginBottom: 10 },
  dayCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    marginBottom: 10,
    overflow: 'hidden',
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 8,
  },
  dayTitle: { fontSize: 16, fontWeight: '600' },
  daySub: { fontSize: 13, opacity: 0.8, marginTop: 4 },
  exerciseList: { paddingHorizontal: 12, paddingBottom: 12 },
  phaseBlock: { marginBottom: 12 },
  phaseTitle: { fontSize: 14, fontWeight: '700', marginBottom: 6 },
  exerciseRow: { marginBottom: 8 },
  exName: { fontSize: 15, fontWeight: '600' },
  exDetail: { fontSize: 13, opacity: 0.85, marginTop: 2 },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 16,
    paddingBottom: 28,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  primaryBtn: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
});
