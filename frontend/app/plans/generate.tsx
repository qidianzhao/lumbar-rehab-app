import FontAwesome from '@expo/vector-icons/FontAwesome';
import { type Href, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
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
import { handleError } from '@/src/utils/errorHandler';

const FREQ_OPTIONS = [2, 3, 4, 5];
const DURATION_OPTIONS = [15, 20, 25, 30];

const LEVEL_LABEL: Record<string, string> = {
  beginner: '入门', intermediate: '进阶', advanced: '强化',
};
const PHASE_LABEL: Record<string, string> = {
  warmup: '热身', core: '核心', stretch: '拉伸',
};

export default function PlanGenerateScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  const params = useLocalSearchParams<{ assessment_id?: string }>();

  const [freq, setFreq] = useState(3);
  const [duration, setDuration] = useState(20);
  const [generating, setGenerating] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [plan, setPlan] = useState<planApi.TrainingPlan | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onGenerate() {
    setGenerating(true);
    setError(null);
    setPlan(null);
    try {
      const p = await planApi.generatePlan({
        assessment_id: params.assessment_id ? Number(params.assessment_id) : null,
        weekly_frequency: freq,
        preferred_duration: duration,
      });
      setPlan(p);
    } catch (e) {
      const errorInfo = handleError(e, '生成计划');
      setError(errorInfo.message);
    } finally {
      setGenerating(false);
    }
  }

  async function onConfirm() {
    if (!plan) return;
    setConfirming(true);
    setError(null);
    try {
      await planApi.confirmPlan(plan.id);
      router.replace('/(tabs)/program' as Href);
    } catch (e) {
      const errorInfo = handleError(e, '确认计划');
      setError(errorInfo.message);
    } finally {
      setConfirming(false);
    }
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.background }} contentContainerStyle={styles.scroll}>
      <Text style={[styles.pageTitle, { color: theme.text }]}>生成训练计划</Text>

      {/* 每周训练天数 */}
      <View style={[styles.section, { borderColor: theme.tabIconDefault }]}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>每周训练天数</Text>
        <View style={styles.optionRow}>
          {FREQ_OPTIONS.map((f) => (
            <Pressable
              key={f}
              style={[styles.optionBtn, { borderColor: freq === f ? theme.tint : theme.tabIconDefault, backgroundColor: freq === f ? `${theme.tint}18` : 'transparent' }]}
              onPress={() => setFreq(f)}
            >
              <Text style={[styles.optionText, { color: freq === f ? theme.tint : theme.text }]}>{f} 天</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* 每次训练时长 */}
      <View style={[styles.section, { borderColor: theme.tabIconDefault }]}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>每次训练时长</Text>
        <View style={styles.optionRow}>
          {DURATION_OPTIONS.map((d) => (
            <Pressable
              key={d}
              style={[styles.optionBtn, { borderColor: duration === d ? theme.tint : theme.tabIconDefault, backgroundColor: duration === d ? `${theme.tint}18` : 'transparent' }]}
              onPress={() => setDuration(d)}
            >
              <Text style={[styles.optionText, { color: duration === d ? theme.tint : theme.text }]}>{d} 分钟</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {error ? <Text style={styles.err}>{error}</Text> : null}

      {/* 生成按钮 */}
      {!plan && (
        <Pressable
          style={[styles.btn, { backgroundColor: theme.tint, opacity: generating ? 0.7 : 1 }]}
          onPress={onGenerate}
          disabled={generating}
        >
          {generating ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color="#fff" />
              <Text style={styles.btnText}>AI 生成中…</Text>
            </View>
          ) : (
            <Text style={styles.btnText}>生成计划</Text>
          )}
        </Pressable>
      )}

      {/* 计划预览 */}
      {plan && (
        <>
          <View style={[styles.previewCard, { borderColor: theme.tint }]}>
            <View style={styles.previewHeader}>
              <FontAwesome name="check-circle" size={18} color={theme.tint} />
              <Text style={[styles.previewTitle, { color: theme.text }]}>{plan.name}</Text>
            </View>
            <Text style={[styles.previewMeta, { color: theme.text }]}>
              {LEVEL_LABEL[plan.level] ?? plan.level} · 每周 {plan.weekly_frequency} 天 · 共 {plan.estimated_weeks} 周
            </Text>
            {plan.description ? (
              <Text style={[styles.previewDesc, { color: theme.text }]}>{plan.description}</Text>
            ) : null}

            {/* 第一周第一天预览 */}
            {(() => {
              const firstDay = plan.days.find((d) => d.week_number === 1 && d.day_number === plan.days[0]?.day_number);
              if (!firstDay) return null;
              const byPhase = ['warmup', 'core', 'stretch'].map((ph) => ({
                phase: ph,
                exercises: firstDay.exercises.filter((e) => e.phase === ph),
              })).filter((g) => g.exercises.length > 0);
              return (
                <View style={styles.dayPreview}>
                  <Text style={[styles.dayPreviewTitle, { color: theme.text }]}>示例课程：{firstDay.title}</Text>
                  {byPhase.map((g) => (
                    <View key={g.phase} style={styles.phaseGroup}>
                      <Text style={[styles.phaseLabel, { color: theme.tint }]}>{PHASE_LABEL[g.phase] ?? g.phase}</Text>
                      {g.exercises.map((ex) => (
                        <Text key={ex.id} style={[styles.exItem, { color: theme.text }]}>
                          · {ex.name}  {ex.sets}组×{ex.reps}次
                        </Text>
                      ))}
                    </View>
                  ))}
                </View>
              );
            })()}
          </View>

          <View style={styles.confirmRow}>
            <Pressable
              style={[styles.btnOutline, { borderColor: theme.tabIconDefault }]}
              onPress={() => { setPlan(null); setError(null); }}
            >
              <Text style={[styles.btnOutlineText, { color: theme.text }]}>重新生成</Text>
            </Pressable>
            <Pressable
              style={[styles.btn, { backgroundColor: theme.tint, flex: 1, opacity: confirming ? 0.7 : 1 }]}
              onPress={onConfirm}
              disabled={confirming}
            >
              {confirming ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>确认并开始</Text>}
            </Pressable>
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 20, paddingBottom: 48 },
  pageTitle: { fontSize: 22, fontWeight: '800', marginBottom: 20 },
  section: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: 14, marginBottom: 16 },
  sectionTitle: { fontSize: 15, fontWeight: '700', marginBottom: 12 },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  optionBtn: { borderWidth: 1, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 16 },
  optionText: { fontSize: 15, fontWeight: '600' },
  btn: { paddingVertical: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  err: { color: '#c62828', textAlign: 'center', marginBottom: 12 },
  previewCard: { borderWidth: 1.5, borderRadius: 12, padding: 16, marginBottom: 16 },
  previewHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  previewTitle: { fontSize: 17, fontWeight: '800', flex: 1 },
  previewMeta: { fontSize: 13, opacity: 0.7, marginBottom: 8 },
  previewDesc: { fontSize: 14, lineHeight: 20, opacity: 0.85, marginBottom: 12 },
  dayPreview: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(0,0,0,0.1)', paddingTop: 12, marginTop: 4 },
  dayPreviewTitle: { fontSize: 14, fontWeight: '700', marginBottom: 8 },
  phaseGroup: { marginBottom: 8 },
  phaseLabel: { fontSize: 13, fontWeight: '700', marginBottom: 4 },
  exItem: { fontSize: 13, lineHeight: 20, opacity: 0.85 },
  confirmRow: { flexDirection: 'row', gap: 12 },
  btnOutline: { paddingVertical: 14, paddingHorizontal: 20, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  btnOutlineText: { fontSize: 15, fontWeight: '700' },
});
