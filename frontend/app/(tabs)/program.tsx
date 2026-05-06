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

const PLAN_TYPE_TABS = [
  { key: 'training', label: '训练方案', icon: 'heartbeat' },
  { key: 'stretch', label: '拉伸方案', icon: 'hand-peace-o' },
  { key: 'eye_exercise', label: '眼保健操', icon: 'eye' },
] as const;

type PlanType = typeof PLAN_TYPE_TABS[number]['key'];

const STATUS_LABEL: Record<string, string> = {
  draft: '草稿',
  active: '进行中',
  archived: '已归档',
};

export default function ProgramScreen() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<planApi.TrainingPlan[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<PlanType>('training');

  const load = useCallback(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        // TODO: 后端API需要支持按plan_type筛选
        const allPlans = await planApi.getMyPlans();
        if (!cancelled) {
          setPlans(allPlans);
        }
      } catch (e) {
        if (!cancelled) {
          const errorInfo = handleError(e, '加载方案');
          setError(errorInfo.message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useFocusEffect(load);

  // 按类型筛选方案
  const filteredPlans = plans.filter((p) => (p.plan_type ?? 'training') === activeTab);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={[styles.title, { color: theme.text }]}>训练方案</Text>

        {/* 快捷操作 */}
        <View style={styles.quickActions}>
          <Pressable
            style={[styles.quickBtn, { borderColor: theme.tabIconDefault }]}
            onPress={() => router.push('/plan/generate' as Href)}
          >
            <View style={[styles.quickIcon, { backgroundColor: `${theme.tint}15` }]}>
              <FontAwesome name="plus-circle" size={20} color={theme.tint} />
            </View>
            <Text style={[styles.quickLabel, { color: theme.text }]}>生成方案</Text>
          </Pressable>

          <Pressable
            style={[styles.quickBtn, { borderColor: theme.tabIconDefault }]}
            onPress={() => router.push('/actions' as Href)}
          >
            <View style={[styles.quickIcon, { backgroundColor: '#FF980015' }]}>
              <FontAwesome name="list-ul" size={20} color="#FF9800" />
            </View>
            <Text style={[styles.quickLabel, { color: theme.text }]}>动作库</Text>
          </Pressable>

          <Pressable
            style={[styles.quickBtn, { borderColor: theme.tabIconDefault }]}
            onPress={() => router.push('/chat' as Href)}
          >
            <View style={[styles.quickIcon, { backgroundColor: '#9C27B015' }]}>
              <FontAwesome name="comments" size={20} color="#9C27B0" />
            </View>
            <Text style={[styles.quickLabel, { color: theme.text }]}>AI助手</Text>
          </Pressable>
        </View>

        {/* 方案类型Tab */}
        <View style={styles.tabs}>
          {PLAN_TYPE_TABS.map((tab) => (
            <Pressable
              key={tab.key}
              style={[
                styles.tab,
                { borderColor: theme.tabIconDefault },
                activeTab === tab.key && { backgroundColor: theme.tint, borderColor: theme.tint },
              ]}
              onPress={() => setActiveTab(tab.key)}
            >
              <FontAwesome
                name={tab.icon}
                size={16}
                color={activeTab === tab.key ? '#fff' : theme.text}
              />
              <Text
                style={[
                  styles.tabText,
                  { color: activeTab === tab.key ? '#fff' : theme.text },
                ]}
              >
                {tab.label}
              </Text>
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
        {!loading && !error && filteredPlans.length === 0 && (
          <View style={[styles.emptyCard, { borderColor: theme.tabIconDefault }]}>
            <FontAwesome name="calendar-o" size={48} color={theme.tabIconDefault} />
            <Text style={[styles.emptyTitle, { color: theme.text }]}>还没有{PLAN_TYPE_TABS.find(t => t.key === activeTab)?.label}</Text>
            <Text style={[styles.emptySub, { color: theme.text }]}>
              点击上方"生成方案"按钮，让AI为你定制专属训练计划
            </Text>
            <Pressable
              style={[styles.createBtn, { backgroundColor: theme.tint }]}
              onPress={() => router.push('/plan/generate' as Href)}
            >
              <FontAwesome name="plus" size={16} color="#fff" />
              <Text style={styles.createText}>生成方案</Text>
            </Pressable>
          </View>
        )}

        {/* 方案列表 */}
        {!loading && !error && filteredPlans.length > 0 && (
          <View style={styles.planList}>
            {filteredPlans.map((plan) => (
              <View key={plan.id} style={[styles.planCard, { borderColor: theme.tabIconDefault }]}>
                <View style={styles.planHeader}>
                  <View style={styles.planTitleRow}>
                    <FontAwesome name="file-text-o" size={18} color={theme.tint} />
                    <Text style={[styles.planName, { color: theme.text }]}>{plan.name}</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: `${theme.tint}15` }]}>
                    <Text style={[styles.statusText, { color: theme.tint }]}>
                      {STATUS_LABEL[plan.status] ?? plan.status}
                    </Text>
                  </View>
                </View>

                <View style={styles.planMeta}>
                  <View style={styles.metaItem}>
                    <FontAwesome name="list" size={12} color={theme.text} style={{ opacity: 0.5 }} />
                    <Text style={[styles.metaText, { color: theme.text }]}>
                      {plan.total_actions ?? 0}个动作
                    </Text>
                  </View>
                  <View style={styles.metaItem}>
                    <FontAwesome name="clock-o" size={12} color={theme.text} style={{ opacity: 0.5 }} />
                    <Text style={[styles.metaText, { color: theme.text }]}>
                      {plan.duration_minutes ?? plan.estimated_duration_minutes ?? 25}分钟
                    </Text>
                  </View>
                </View>

                <View style={styles.planActions}>
                  <Pressable
                    style={[styles.actionBtn, { backgroundColor: theme.tint }]}
                    onPress={() => router.push(`/training/start?planId=${plan.id}` as Href)}
                  >
                    <FontAwesome name="play" size={14} color="#fff" />
                    <Text style={styles.actionBtnText}>开始</Text>
                  </Pressable>

                  <Pressable
                    style={[styles.actionBtn, styles.actionBtnOutline, { borderColor: theme.tint }]}
                    onPress={() => router.push(`/plan/${plan.id}` as Href)}
                  >
                    <FontAwesome name="edit" size={14} color={theme.tint} />
                    <Text style={[styles.actionBtnTextOutline, { color: theme.tint }]}>编辑</Text>
                  </Pressable>

                  <Pressable
                    style={[styles.actionBtn, styles.actionBtnOutline, { borderColor: theme.tint }]}
                    onPress={() => {
                      // TODO: 实现AI优化功能
                      alert('AI优化功能开发中');
                    }}
                  >
                    <FontAwesome name="magic" size={14} color={theme.tint} />
                    <Text style={[styles.actionBtnTextOutline, { color: theme.tint }]}>AI优化</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
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
  tabs: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  tabText: { fontSize: 13, fontWeight: '600' },
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
  planList: { gap: 16 },
  planCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: 16,
  },
  planHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  planTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  planName: { fontSize: 16, fontWeight: '700', flex: 1 },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: { fontSize: 11, fontWeight: '600' },
  planMeta: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 12,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: { fontSize: 13, opacity: 0.7 },
  planActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
  },
  actionBtnOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
  },
  actionBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  actionBtnTextOutline: { fontSize: 13, fontWeight: '600' },
});
