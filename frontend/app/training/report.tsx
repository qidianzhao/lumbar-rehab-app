import FontAwesome from '@expo/vector-icons/FontAwesome';
import { type Href, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { shareTrainingReport } from '@/src/services/shareService';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import type { SessionFinishData } from '@/src/services/trainingApi';
import { getSessionReport } from '@/src/services/trainingApi';
import { useTrainingStore } from '@/src/stores/trainingStore';
import { handleError } from '@/src/utils/errorHandler';

export default function TrainingReportScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ session_id?: string }>();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];

  const storeReport = useTrainingStore((s) => s.lastReport);
  const reset = useTrainingStore((s) => s.reset);

  const [report, setReport] = useState<SessionFinishData | null>(storeReport);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);

  // 从历史记录跳转来时，通过 session_id 参数从 API 加载
  useEffect(() => {
    const sid = params.session_id ? Number(params.session_id) : null;
    if (!sid) return; // 没有参数说明是正常训练流结束跳转，用 storeReport
    setLoading(true);
    void (async () => {
      try {
        const data = await getSessionReport(sid);
        setReport(data);
      } catch (e) {
        const errorInfo = handleError(e, '加载训练报告');
        setError(errorInfo.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [params.session_id]);

  // 正常训练流结束离开时清 store
  useEffect(() => {
    if (!params.session_id) {
      return () => { reset(); };
    }
  }, [params.session_id, reset]);

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
        <Pressable onPress={() => router.back()}>
          <Text style={{ color: theme.tint }}>返回</Text>
        </Pressable>
      </View>
    );
  }

  if (!report) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <Text style={{ color: theme.text }}>暂无报告</Text>
        <Pressable onPress={() => router.replace('/(tabs)' as Href)}>
          <Text style={{ color: theme.tint }}>回首页</Text>
        </Pressable>
      </View>
    );
  }

  const sessionId = params.session_id ? Number(params.session_id) : report.session_id;

  async function handleShare() {
    if (!sessionId) return;
    setSharing(true);
    try {
      await shareTrainingReport(sessionId);
    } catch (e) {
      Alert.alert('分享失败', handleError(e, '请稍后重试'));
    } finally {
      setSharing(false);
    }
  }

  const doneCount = report.action_details.filter((a) => a.is_completed && !a.is_skipped).length;
  const skipCount = report.action_details.filter((a) => a.is_skipped).length;

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={[styles.title, { color: theme.text }]}>训练报告</Text>
        <Text style={[styles.meta, { color: theme.text }]}>
          时长 {report.duration_display} · 完成率 {report.completion_rate.toFixed(0)}%
        </Text>

        <View style={[styles.card, { borderColor: theme.tabIconDefault }]}>
          <View style={styles.rateRow}>
            <Text style={[styles.label, { color: theme.text }]}>完成率</Text>
            <Text style={[styles.rateVal, { color: theme.tint }]}>{report.completion_rate.toFixed(0)}%</Text>
          </View>
          <View style={[styles.progressBg, { backgroundColor: `${theme.tint}22` }]}>
            <View
              style={[
                styles.progressFill,
                { width: `${Math.min(100, report.completion_rate)}%`, backgroundColor: theme.tint },
              ]}
            />
          </View>
        </View>

        <View style={[styles.card, { borderColor: theme.tabIconDefault }]}>
          <Text style={[styles.section, { color: theme.text }]}>动作完成情况</Text>
          {report.action_details.map((a) => (
            <View key={`${a.action_id}-${a.phase}`} style={styles.rowItem}>
              <Text style={{ fontSize: 18 }}>{a.is_skipped ? '⚠️' : a.is_completed ? '✅' : '○'}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.actionName, { color: theme.text }]}>{a.name}</Text>
                <Text style={[styles.detail, { color: theme.text }]}>
                  计划 {a.planned_sets}×{a.planned_reps} · 实际 {a.actual_sets}×累计{a.actual_reps}次
                </Text>
              </View>
            </View>
          ))}
        </View>

        <View style={[styles.card, { borderColor: theme.tabIconDefault }]}>
          <Text style={[styles.section, { color: theme.text }]}>AI 训练总结</Text>
          <Text style={[styles.ai, { color: theme.text }]}>{report.ai_summary}</Text>
        </View>

        <View
          style={[
            styles.checkin,
            { borderColor: report.checkin_ok ? theme.tint : theme.tabIconDefault },
          ]}
        >
          <FontAwesome
            name={report.checkin_ok ? 'check-circle' : 'info-circle'}
            size={20}
            color={theme.tint}
          />
          <Text style={{ color: theme.text, flex: 1, marginLeft: 8 }}>
            {report.checkin_ok ? '打卡成功：今日训练已记录' : '今日已有打卡记录（未重复写入）'}
          </Text>
        </View>

        <Text style={[styles.mini, { color: theme.text }]}>
          完成 {doneCount} 个 · 跳过 {skipCount} 个
        </Text>
      </ScrollView>

      <View
        style={[
          styles.footer,
          { borderTopColor: theme.tabIconDefault, backgroundColor: theme.background },
        ]}
      >
        <View style={styles.footerRow}>
          <Pressable
            style={[styles.outline, { borderColor: theme.tint, flex: 1 }]}
            onPress={() => router.replace('/(tabs)' as Href)}
          >
            <Text style={{ color: theme.tint, fontWeight: '700' }}>返回首页</Text>
          </Pressable>
          <Pressable
            style={[styles.outline, { borderColor: theme.tint, flex: 1 }, sharing && styles.disabled]}
            onPress={handleShare}
            disabled={sharing}
          >
            {sharing ? (
              <ActivityIndicator size="small" color={theme.tint} />
            ) : (
              <View style={styles.shareBtn}>
                <FontAwesome name="share-alt" size={14} color={theme.tint} />
                <Text style={{ color: theme.tint, fontWeight: '700', marginLeft: 6 }}>分享</Text>
              </View>
            )}
          </Pressable>
        </View>
        <Pressable
          style={[styles.primary, { backgroundColor: theme.tint }]}
          onPress={() => router.push('/(tabs)/program' as Href)}
        >
          <Text style={styles.primaryText}>查看训练计划</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  scroll: { padding: 16, paddingBottom: 120 },
  title: { fontSize: 22, fontWeight: '800' },
  meta: { fontSize: 14, opacity: 0.85, marginTop: 6, marginBottom: 14 },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  rateRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  label: { fontSize: 15, fontWeight: '600' },
  rateVal: { fontSize: 18, fontWeight: '900' },
  progressBg: { height: 10, borderRadius: 999, overflow: 'hidden' },
  progressFill: { height: 10, borderRadius: 999 },
  section: { fontSize: 16, fontWeight: '800', marginBottom: 10 },
  rowItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 12 },
  actionName: { fontSize: 15, fontWeight: '700' },
  detail: { fontSize: 12, opacity: 0.85, marginTop: 2 },
  ai: { fontSize: 14, lineHeight: 22 },
  checkin: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  mini: { fontSize: 12, opacity: 0.75, textAlign: 'center' },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 16,
    paddingBottom: 28,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  outline: { paddingVertical: 14, borderRadius: 12, borderWidth: 1, alignItems: 'center' },
  primary: { paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  primaryText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  footerRow: { flexDirection: 'row', gap: 10 },
  shareBtn: { flexDirection: 'row', alignItems: 'center' },
  disabled: { opacity: 0.5 },
});
