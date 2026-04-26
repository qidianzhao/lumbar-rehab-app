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
import * as trainingApi from '@/src/services/trainingApi';
import { useTrainingStore } from '@/src/stores/trainingStore';

const WEEKDAY = ['一', '二', '三', '四', '五', '六', '日'];
const LEVEL_LABEL: Record<string, string> = {
  beginner: '入门', intermediate: '进阶', advanced: '强化',
};
const PHASE_LABEL: Record<string, string> = {
  warmup: '热身', core: '核心', stretch: '拉伸',
};

export default function PlansIndexScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  const hydrateFromSession = useTrainingStore((s) => s.hydrateFromSession);

  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState<planApi.TrainingPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [startingDayId, setStartingDayId] = useState<number | null>(null);

  const load = useCallback(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const p = await planApi.getCurrentPlan();
        if (!cancelled) setPlan(p);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : '加载失败');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useFocusEffect(load);

  const progressWeek = plan?.progress_week ?? 1;
  const thisWeekDays = plan?.days.filter((d) => d.week_number === progressWeek) ?? [];

  // 今日训练：按今天星期几匹配
  const todayDayNum = new Date().getDay() || 7; // 1=Mon..7=Sun
  const todayDay = thisWeekDays.find((d) => d.day_number === todayDayNum) ?? thisWeekDays[0] ?? null;

  async function startTraining(day: planApi.PlanDay) {
    if (!plan) return;
    setStartingDayId(day.id);
    try {
      const session = await trainingApi.createSession({
        plan_id: plan.id,
        plan_day_id: day.id,
        pre_check_status: 'normal',
      });
      hydrateFromSession(session);
      router.push('/training/session' as Href);
    } catch (e) {
      setError(e instanceof Error ? e.message : '开始训练失败');
    } finally {
      setStartingDayId(null);
    }
  }

  if (loading) {
    return <View style={[styles.center, { backgroundColor: theme.background }]}><ActivityIndicator size="large" color={theme.tint} /></View>;
  }

  if (error && !plan) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <Text style={{ color: theme.text }}>{error}</Text>
        <Pressable style={[styles.btn, { backgroundColor: theme.tint }]} onPress={load}>
          <Text style={styles.btnText}>重试</Text>
        </Pressable>
      </View>
    );
  }

  if (!plan) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background, padding: 32 }]}>
        <FontAwesome name="calendar-o" size={52} color={theme.tabIconDefault} />
        <Text style={[styles.emptyTitle, { color: theme.text }]}>暂无训练计划</Text>
        <Text style={[styles.muted, { color: theme.text }]}>完成体能测试后生成专属计划</Text>
        <Pressable style={[styles.btn, { backgroundColor: theme.tint, marginTop: 20 }]} onPress={() => router.push('/plans/generate' as Href)}>
          <Text style={styles.btnText}>生成训练计划</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* 计划概览 */}
        <View style={[styles.card, { borderColor: theme.tabIconDefault }]}>
          <Text style={[styles.planName, { color: theme.text }]}>{plan.name}</Text>
          <Text style={[styles.planMeta, { color: theme.text }]}>
            {LEVEL_LABEL[plan.level] ?? plan.level} · 第 {progressWeek}/{plan.estimated_weeks} 周 · 每周 {plan.weekly_frequency} 天
          </Text>
          {plan.description ? <Text style={[styles.planDesc, { color: theme.text }]}>{plan.description}</Text> : null}
          {/* 进度条 */}
          <View style={[styles.barBg, { backgroundColor: `${theme.tint}22` }]}>
            <View style={[styles.barFill, { backgroundColor: theme.tint, width: `${(progressWeek / plan.estimated_weeks) * 100}%` }]} />
          </View>
        </View>

        {/* 今日训练卡片 */}
        {todayDay && (
          <View style={[styles.todayCard, { borderColor: theme.tint, backgroundColor: `${theme.tint}08` }]}>
            <View style={styles.todayHeader}>
              <FontAwesome name="bolt" size={16} color={theme.tint} />
              <Text style={[styles.todayTitle, { color: theme.tint }]}>今日训练</Text>
            </View>
            <Text style={[styles.todayName, { color: theme.text }]}>{todayDay.title}</Text>
            <Text style={[styles.muted, { color: theme.text }]}>约 {todayDay.estimated_duration} 分钟 · {todayDay.exercises.length} 个动作</Text>

            {/* 动作列表按阶段分组 */}
            {['warmup', 'core', 'stretch'].map((ph) => {
              const exs = todayDay.exercises.filter((e) => e.phase === ph);
              if (!exs.length) return null;
              return (
                <View key={ph} style={styles.phaseGroup}>
                  <Text style={[styles.phaseLabel, { color: theme.tint }]}>{PHASE_LABEL[ph]}</Text>
                  {exs.map((ex) => (
                    <Text key={ex.id} style={[styles.exItem, { color: theme.text }]}>
                      · {ex.name}  {ex.sets}组×{ex.reps}次
                    </Text>
                  ))}
                </View>
              );
            })}

            <Pressable
              style={[styles.startBtn, { backgroundColor: theme.tint, opacity: startingDayId === todayDay.id ? 0.7 : 1 }]}
              onPress={() => void startTraining(todayDay)}
              disabled={startingDayId !== null}
            >
              {startingDayId === todayDay.id
                ? <ActivityIndicator color="#fff" />
                : <><FontAwesome name="play" size={14} color="#fff" /><Text style={styles.startBtnText}>开始训练</Text></>
              }
            </Pressable>
          </View>
        )}

        {/* 本周日程 */}
        <Text style={[styles.sectionTitle, { color: theme.text }]}>本周日程</Text>
        <View style={styles.weekRow}>
          {WEEKDAY.map((label, idx) => {
            const dayNum = idx + 1;
            const day = thisWeekDays.find((d) => d.day_number === dayNum);
            const isToday = dayNum === todayDayNum;
            return (
              <View key={dayNum} style={[
                styles.weekCell,
                { borderColor: isToday ? theme.tint : theme.tabIconDefault, backgroundColor: day ? `${theme.tint}15` : 'transparent' },
              ]}>
                <Text style={[styles.weekLabel, { color: isToday ? theme.tint : theme.text }]}>周{label}</Text>
                <FontAwesome
                  name={day ? 'check-circle' : 'circle-o'}
                  size={16}
                  color={day ? theme.tint : theme.tabIconDefault}
                />
              </View>
            );
          })}
        </View>

        {/* 其他训练日 */}
        {thisWeekDays.filter((d) => d.id !== todayDay?.id).map((day) => (
          <View key={day.id} style={[styles.dayRow, { borderColor: theme.tabIconDefault }]}>
            <View style={styles.dayMeta}>
              <Text style={[styles.dayTitle, { color: theme.text }]}>{day.title}</Text>
              <Text style={[styles.muted, { color: theme.text }]}>约 {day.estimated_duration} 分钟 · 周{WEEKDAY[day.day_number - 1]}</Text>
            </View>
            <Pressable
              style={[styles.smallBtn, { borderColor: theme.tint, opacity: startingDayId === day.id ? 0.6 : 1 }]}
              onPress={() => void startTraining(day)}
              disabled={startingDayId !== null}
            >
              {startingDayId === day.id
                ? <ActivityIndicator size="small" color={theme.tint} />
                : <Text style={[styles.smallBtnText, { color: theme.tint }]}>开始</Text>
              }
            </Pressable>
          </View>
        ))}

        {error ? <Text style={styles.err}>{error}</Text> : null}
      </ScrollView>

      <View style={[styles.footer, { borderTopColor: theme.tabIconDefault, backgroundColor: theme.background }]}>
        <Pressable style={[styles.btnOutline, { borderColor: theme.tint }]} onPress={() => router.push('/plans/generate' as Href)}>
          <Text style={[styles.btnOutlineText, { color: theme.tint }]}>生成新计划</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  scroll: { padding: 16, paddingBottom: 100 },
  emptyTitle: { fontSize: 18, fontWeight: '700', marginTop: 12 },
  muted: { fontSize: 13, opacity: 0.65, marginTop: 2 },
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: 14, marginBottom: 16 },
  planName: { fontSize: 18, fontWeight: '800', marginBottom: 4 },
  planMeta: { fontSize: 13, opacity: 0.7, marginBottom: 6 },
  planDesc: { fontSize: 14, lineHeight: 20, opacity: 0.85, marginBottom: 10 },
  barBg: { height: 6, borderRadius: 999, overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 999 },
  todayCard: { borderWidth: 1.5, borderRadius: 12, padding: 14, marginBottom: 16 },
  todayHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  todayTitle: { fontSize: 13, fontWeight: '700' },
  todayName: { fontSize: 17, fontWeight: '800', marginBottom: 4 },
  phaseGroup: { marginTop: 8 },
  phaseLabel: { fontSize: 12, fontWeight: '700', marginBottom: 3 },
  exItem: { fontSize: 13, lineHeight: 20, opacity: 0.85 },
  startBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 14, paddingVertical: 12, borderRadius: 10 },
  startBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  sectionTitle: { fontSize: 15, fontWeight: '700', marginBottom: 10 },
  weekRow: { flexDirection: 'row', gap: 6, marginBottom: 16 },
  weekCell: { flex: 1, borderWidth: 1, borderRadius: 8, alignItems: 'center', paddingVertical: 8, gap: 4 },
  weekLabel: { fontSize: 11, fontWeight: '600' },
  dayRow: { flexDirection: 'row', alignItems: 'center', borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, padding: 12, marginBottom: 8 },
  dayMeta: { flex: 1 },
  dayTitle: { fontSize: 14, fontWeight: '600', marginBottom: 2 },
  smallBtn: { borderWidth: 1, borderRadius: 8, paddingVertical: 6, paddingHorizontal: 14 },
  smallBtnText: { fontSize: 14, fontWeight: '700' },
  err: { color: '#c62828', textAlign: 'center', marginTop: 8 },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 16, paddingBottom: 28, borderTopWidth: StyleSheet.hairlineWidth },
  btn: { paddingVertical: 12, paddingHorizontal: 24, borderRadius: 10, alignItems: 'center' },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  btnOutline: { paddingVertical: 12, borderRadius: 10, borderWidth: 1, alignItems: 'center' },
  btnOutlineText: { fontSize: 15, fontWeight: '700' },
});
