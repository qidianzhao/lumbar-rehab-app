import FontAwesome from '@expo/vector-icons/FontAwesome';
import { type Href, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import * as planApi from '@/src/services/planApi';

const PHASE_LABEL: Record<string, string> = {
  warmup: '热身', core: '核心', stretch: '拉伸',
};

export default function HomeScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  const [plan, setPlan] = useState<planApi.TrainingPlan | null | undefined>(undefined);

  useFocusEffect(useCallback(() => {
    let cancelled = false;
    planApi.getCurrentPlan()
      .then((p) => { if (!cancelled) setPlan(p); })
      .catch(() => { if (!cancelled) setPlan(null); });
    return () => { cancelled = true; };
  }, []));

  const todayDayNum = new Date().getDay() || 7;
  const progressWeek = plan?.progress_week ?? 1;
  const thisWeekDays = plan?.days.filter((d) => d.week_number === progressWeek) ?? [];
  const todayDay = thisWeekDays.find((d) => d.day_number === todayDayNum) ?? thisWeekDays[0] ?? null;

  const completedDays = thisWeekDays.length;
  const totalDays = plan?.weekly_frequency ?? 0;

  async function onStartTraining() {
    if (!plan || !todayDay) return;
    router.push(`/training/pre-check?planId=${plan.id}&planDayId=${todayDay.id}` as Href);
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={[styles.title, { color: theme.text }]}>腰突康复运动</Text>

        {/* 加载中 */}
        {plan === undefined && (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={theme.tint} />
          </View>
        )}

        {/* 无计划 → 引导 */}
        {plan === null && (
          <View style={[styles.emptyCard, { borderColor: theme.tabIconDefault }]}>
            <FontAwesome name="calendar-o" size={36} color={theme.tabIconDefault} />
            <Text style={[styles.emptyTitle, { color: theme.text }]}>还没有训练计划</Text>
            <Text style={[styles.muted, { color: theme.text }]}>先完成体能测试，再生成专属计划</Text>
            <View style={styles.emptyBtns}>
              <Pressable style={[styles.btn, { backgroundColor: theme.tint }]} onPress={() => router.push('/assessment' as Href)}>
                <Text style={styles.btnText}>去体能测试</Text>
              </Pressable>
              <Pressable style={[styles.btnOutline, { borderColor: theme.tint }]} onPress={() => router.push('/plans/generate' as Href)}>
                <Text style={[styles.btnOutlineText, { color: theme.tint }]}>直接生成计划</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* 有计划 → 今日训练卡片 */}
        {plan && todayDay && (
          <View style={[styles.todayCard, { borderColor: theme.tint, backgroundColor: `${theme.tint}08` }]}>
            <View style={styles.todayHeader}>
              <FontAwesome name="bolt" size={15} color={theme.tint} />
              <Text style={[styles.todayLabel, { color: theme.tint }]}>今日训练</Text>
            </View>
            <Text style={[styles.todayName, { color: theme.text }]}>{todayDay.title}</Text>
            <Text style={[styles.muted, { color: theme.text }]}>
              约 {todayDay.estimated_duration} 分钟 · {todayDay.exercises.length} 个动作
            </Text>

            {['warmup', 'core', 'stretch'].map((ph) => {
              const exs = todayDay.exercises.filter((e) => e.phase === ph);
              if (!exs.length) return null;
              return (
                <View key={ph} style={styles.phaseGroup}>
                  <Text style={[styles.phaseLabel, { color: theme.tint }]}>{PHASE_LABEL[ph]}</Text>
                  {exs.map((ex) => (
                    <Text key={ex.id} style={[styles.exItem, { color: theme.text }]}>· {ex.name}  {ex.sets}组×{ex.reps}次</Text>
                  ))}
                </View>
              );
            })}

            <Pressable
              style={[styles.startBtn, { backgroundColor: theme.tint }]}
              onPress={() => void onStartTraining()}
            >
              <FontAwesome name="play" size={14} color="#fff" /><Text style={styles.startBtnText}>开始训练</Text>
            </Pressable>
          </View>
        )}

        {/* 有计划但今天无排期 */}
        {plan && !todayDay && (
          <View style={[styles.restCard, { borderColor: theme.tabIconDefault }]}>
            <FontAwesome name="coffee" size={28} color={theme.tabIconDefault} />
            <Text style={[styles.restTitle, { color: theme.text }]}>今天是休息日</Text>
            <Text style={[styles.muted, { color: theme.text }]}>好好休息，明天继续加油</Text>
            <Pressable style={styles.linkRow} onPress={() => router.push('/plans' as Href)}>
              <Text style={{ color: theme.tint, fontSize: 14 }}>查看本周计划</Text>
              <FontAwesome name="chevron-right" size={11} color={theme.tint} />
            </Pressable>
          </View>
        )}

        {/* 本周进度 */}
        {plan && (
          <View style={[styles.progressCard, { borderColor: theme.tabIconDefault }]}>
            <Text style={[styles.progressTitle, { color: theme.text }]}>本周进度</Text>
            <Text style={[styles.progressValue, { color: theme.tint }]}>
              第 {progressWeek} / {plan.estimated_weeks} 周 · {completedDays}/{totalDays} 天
            </Text>
            <View style={[styles.barBg, { backgroundColor: `${theme.tint}22` }]}>
              <View style={[styles.barFill, { backgroundColor: theme.tint, width: `${totalDays ? (completedDays / totalDays) * 100 : 0}%` }]} />
            </View>
            <Pressable style={styles.linkRow} onPress={() => router.push('/plans' as Href)}>
              <Text style={{ color: theme.tint, fontSize: 14 }}>查看完整计划</Text>
              <FontAwesome name="chevron-right" size={11} color={theme.tint} />
            </Pressable>
          </View>
        )}

        {/* 快捷入口 */}
        <View style={styles.quickRow}>
          {[
            { icon: 'clipboard' as const, label: '体能测试', href: '/assessment' as Href },
            { icon: 'history' as const, label: '训练记录', href: '/(tabs)/records' as Href },
            { icon: 'user' as const, label: '个人中心', href: '/(tabs)/profile' as Href },
          ].map((e) => (
            <Pressable key={e.label} style={[styles.quickBtn, { borderColor: theme.tabIconDefault }]} onPress={() => router.push(e.href)}>
              <FontAwesome name={e.icon} size={20} color={theme.tint} />
              <Text style={[styles.quickLabel, { color: theme.text }]}>{e.label}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 24, fontWeight: '800', marginBottom: 16 },
  loadingWrap: { alignItems: 'center', paddingVertical: 40 },
  emptyCard: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, padding: 24, alignItems: 'center', gap: 8, marginBottom: 16 },
  emptyTitle: { fontSize: 17, fontWeight: '700', marginTop: 4 },
  emptyBtns: { flexDirection: 'row', gap: 10, marginTop: 8 },
  muted: { fontSize: 13, opacity: 0.65, textAlign: 'center' },
  todayCard: { borderWidth: 1.5, borderRadius: 14, padding: 16, marginBottom: 16 },
  todayHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  todayLabel: { fontSize: 12, fontWeight: '700' },
  todayName: { fontSize: 18, fontWeight: '800', marginBottom: 4 },
  phaseGroup: { marginTop: 8 },
  phaseLabel: { fontSize: 12, fontWeight: '700', marginBottom: 3 },
  exItem: { fontSize: 13, lineHeight: 20, opacity: 0.85 },
  startBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 14, paddingVertical: 13, borderRadius: 10 },
  startBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  restCard: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, padding: 20, alignItems: 'center', gap: 6, marginBottom: 16 },
  restTitle: { fontSize: 16, fontWeight: '700', marginTop: 4 },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8 },
  progressCard: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, padding: 14, marginBottom: 16, gap: 8 },
  progressTitle: { fontSize: 14, fontWeight: '700' },
  progressValue: { fontSize: 15, fontWeight: '800' },
  barBg: { height: 6, borderRadius: 999, overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 999 },
  quickRow: { flexDirection: 'row', gap: 10 },
  quickBtn: { flex: 1, borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, alignItems: 'center', paddingVertical: 14, gap: 6 },
  quickLabel: { fontSize: 12, fontWeight: '600' },
  btn: { paddingVertical: 11, paddingHorizontal: 18, borderRadius: 10, alignItems: 'center' },
  btnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  btnOutline: { paddingVertical: 11, paddingHorizontal: 18, borderRadius: 10, borderWidth: 1, alignItems: 'center' },
  btnOutlineText: { fontSize: 14, fontWeight: '700' },
});
