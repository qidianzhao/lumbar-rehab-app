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
import { SafeAreaView } from 'react-native-safe-area-context';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import * as planApi from '@/src/services/planApi';
import { handleError } from '@/src/utils/errorHandler';

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

type QuickAction = {
  icon: React.ComponentProps<typeof FontAwesome>['name'];
  label: string;
  href: Href;
  color: string;
};

export default function ProgramScreen() {
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
          const errorInfo = handleError(e, '加载计划');
          setError(errorInfo.message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useFocusEffect(load);

  const quickActions: QuickAction[] = [
    { icon: 'plus-circle', label: '生成方案', href: '/plans/generate' as Href, color: theme.tint },
    { icon: 'list-ul', label: '动作库', href: '/actions' as Href, color: '#FF9800' },
    { icon: 'history', label: '训练记录', href: '/(tabs)/records' as Href, color: '#4CAF50' },
    { icon: 'comments', label: 'AI助手', href: '/chat' as Href, color: '#9C27B0' },
  ];

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={[styles.title, { color: theme.text }]}>训练方案</Text>

        {/* 快捷操作 */}
        <View style={styles.quickActions}>
          {quickActions.map((action) => (
            <Pressable
              key={action.label}
              style={[styles.quickBtn, { borderColor: theme.tabIconDefault }]}
              onPress={() => router.push(action.href)}
            >
              <View style={[styles.quickIcon, { backgroundColor: `${action.color}15` }]}>
                <FontAwesome name={action.icon} size={20} color={action.color} />
              </View>
              <Text style={[styles.quickLabel, { color: theme.text }]}>{action.label}</Text>
            </Pressable>
          ))}
        </View>

        {/* 加载中 */}
        {loading && (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={theme.tint} />
            <Text style={[styles.loadingText, { color: theme.text }]}>加载中...</Text>
          </View>
        )}

        {/* 错误 */}
        {!loading && error && (
          <View style={[styles.errorCard, { borderColor: theme.tabIconDefault }]}>
            <FontAwesome name="exclamation-circle" size={24} color="#e53935" />
            <Text style={[styles.errorText, { color: theme.text }]}>{error}</Text>
            <Pressable style={[styles.retryBtn, { backgroundColor: theme.tint }]} onPress={load}>
              <Text style={styles.retryText}>重试</Text>
            </Pressable>
          </View>
        )}

        {/* 无方案 */}
        {!loading && !error && !plan && (
          <View style={[styles.emptyCard, { borderColor: theme.tabIconDefault }]}>
            <FontAwesome name="calendar-o" size={48} color={theme.tabIconDefault} />
            <Text style={[styles.emptyTitle, { color: theme.text }]}>还没有训练方案</Text>
            <Text style={[styles.emptySub, { color: theme.text }]}>
              点击上方"生成方案"按钮，让AI为你定制专属训练计划
            </Text>
            <Pressable
              style={[styles.createBtn, { backgroundColor: theme.tint }]}
              onPress={() => router.push('/plans/generate' as Href)}
            >
              <FontAwesome name="plus" size={16} color="#fff" />
              <Text style={styles.createText}>生成方案</Text>
            </Pressable>
          </View>
        )}

        {/* 当前方案 */}
        {!loading && !error && plan && (
          <>
            <View style={[styles.card, { borderColor: theme.tabIconDefault }]}>
              <View style={styles.cardHeader}>
                <Text style={[styles.cardTitle, { color: theme.text }]}>当前方案</Text>
                <View style={[styles.statusBadge, { backgroundColor: `${theme.tint}15` }]}>
                  <Text style={[styles.statusText, { color: theme.tint }]}>
                    {STATUS_LABEL[plan.status] ?? plan.status}
                  </Text>
                </View>
              </View>

              <View style={styles.planInfo}>
                <View style={styles.infoRow}>
                  <FontAwesome name="trophy" size={14} color={theme.tint} />
                  <Text style={[styles.infoLabel, { color: theme.text }]}>难度：</Text>
                  <Text style={[styles.infoValue, { color: theme.text }]}>
                    {LEVEL_LABEL[plan.difficulty_level] ?? plan.difficulty_level}
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <FontAwesome name="calendar" size={14} color={theme.tint} />
                  <Text style={[styles.infoLabel, { color: theme.text }]}>周期：</Text>
                  <Text style={[styles.infoValue, { color: theme.text }]}>
                    {plan.total_weeks}周 · 每周{plan.weekly_frequency}次
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <FontAwesome name="clock-o" size={14} color={theme.tint} />
                  <Text style={[styles.infoLabel, { color: theme.text }]}>时长：</Text>
                  <Text style={[styles.infoValue, { color: theme.text }]}>
                    约{plan.estimated_duration_minutes}分钟/次
                  </Text>
                </View>
              </View>

              <Pressable
                style={[styles.viewBtn, { backgroundColor: theme.tint }]}
                onPress={() => router.push(`/plan/${plan.id}` as Href)}
              >
                <Text style={styles.viewText}>查看详情</Text>
                <FontAwesome name="chevron-right" size={12} color="#fff" />
              </Pressable>
            </View>

            {/* 本周训练日历 */}
            <View style={[styles.card, { borderColor: theme.tabIconDefault }]}>
              <Text style={[styles.cardTitle, { color: theme.text }]}>本周训练日历</Text>
              <View style={styles.weekGrid}>
                {WEEKDAY_LABEL.map((day, idx) => {
                  const dayNum = idx + 1;
                  const dayPlan = plan.days.find(
                    (d) => d.week_number === plan.progress_week && d.day_number === dayNum
                  );
                  const isToday = new Date().getDay() === (idx === 6 ? 0 : idx + 1);
                  const isCompleted = dayPlan?.is_completed ?? false;

                  return (
                    <View key={day} style={styles.dayCell}>
                      <Text style={[styles.dayLabel, { color: theme.text }]}>{day}</Text>
                      <View
                        style={[
                          styles.dayCircle,
                          { borderColor: theme.tabIconDefault },
                          isToday && { borderColor: theme.tint, borderWidth: 2 },
                          isCompleted && { backgroundColor: theme.tint },
                        ]}
                      >
                        {isCompleted && <FontAwesome name="check" size={12} color="#fff" />}
                      </View>
                    </View>
                  );
                })}
              </View>
              <Text style={[styles.weekProgress, { color: theme.text }]}>
                本周进度：第{plan.progress_week}周 · 已完成
                {plan.days.filter((d) => d.week_number === plan.progress_week && d.is_completed).length}/
                {plan.weekly_frequency}次
              </Text>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { padding: 16, paddingBottom: 40 },
  title: { fontSize: 28, fontWeight: '700', marginBottom: 20 },
  quickActions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  quickBtn: {
    flex: 1,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 12,
    gap: 6,
  },
  quickIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickLabel: { fontSize: 12, fontWeight: '600' },
  loadingWrap: { alignItems: 'center', paddingVertical: 40, gap: 12 },
  loadingText: { fontSize: 14, opacity: 0.5 },
  errorCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: 24,
    alignItems: 'center',
    gap: 12,
  },
  errorText: { fontSize: 14, textAlign: 'center' },
  retryBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 8,
  },
  retryText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  emptyCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: 32,
    alignItems: 'center',
    gap: 12,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', marginTop: 12 },
  emptySub: { fontSize: 14, textAlign: 'center', opacity: 0.6, lineHeight: 20 },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 12,
  },
  createText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  cardTitle: { fontSize: 18, fontWeight: '700' },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: { fontSize: 12, fontWeight: '600' },
  planInfo: { gap: 10, marginBottom: 16 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  infoLabel: { fontSize: 14, opacity: 0.6 },
  infoValue: { fontSize: 14, fontWeight: '600' },
  viewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
  },
  viewText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  weekGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    marginBottom: 16,
  },
  dayCell: { alignItems: 'center', gap: 6 },
  dayLabel: { fontSize: 12, opacity: 0.6 },
  dayCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekProgress: { fontSize: 13, opacity: 0.6, textAlign: 'center' },
});
