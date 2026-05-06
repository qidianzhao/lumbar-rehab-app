import { type Href, useRouter } from 'expo-router';
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
const DURATION_OPTIONS = [15, 20, 25, 30, 35, 40, 45];

export default function PlanGenerateScreen() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  const router = useRouter();
  const [weeklyFrequency, setWeeklyFrequency] = useState(3);
  const [preferredDuration, setPreferredDuration] = useState(30);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit() {
    setError(null);
    setSubmitting(true);
    try {
      const plan = await planApi.generatePlan({
        weekly_frequency: weeklyFrequency,
        preferred_duration: preferredDuration,
      });
      router.replace(`/plan/${plan.id}` as Href);
    } catch (e) {
      const errorInfo = handleError(e, '生成失败');
      setError(errorInfo.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function onRetry() {
    await onSubmit();
  }

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: theme.background }]}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={[styles.lead, { color: theme.text }]}>
        选择每周训练天数与单次时长，系统将按热身 → 核心 → 拉伸 结构生成计划。
      </Text>

      <Text style={[styles.label, { color: theme.text }]}>每周训练频率（天）</Text>
      <View style={styles.chips}>
        {FREQ_OPTIONS.map((n) => {
          const active = weeklyFrequency === n;
          return (
            <Pressable
              key={n}
              onPress={() => setWeeklyFrequency(n)}
              style={[
                styles.chip,
                {
                  borderColor: active ? theme.tint : theme.tabIconDefault,
                  backgroundColor: active ? `${theme.tint}22` : 'transparent',
                },
              ]}
            >
              <Text style={[styles.chipText, { color: active ? theme.tint : theme.text }]}>
                {n} 天
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={[styles.label, { color: theme.text }]}>每次训练时长（分钟）</Text>
      <View style={styles.chips}>
        {DURATION_OPTIONS.map((m) => {
          const active = preferredDuration === m;
          return (
            <Pressable
              key={m}
              onPress={() => setPreferredDuration(m)}
              style={[
                styles.chip,
                {
                  borderColor: active ? theme.tint : theme.tabIconDefault,
                  backgroundColor: active ? `${theme.tint}22` : 'transparent',
                },
              ]}
            >
              <Text style={[styles.chipText, { color: active ? theme.tint : theme.text }]}>
                {m}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.error}>{error}</Text>
          <Pressable
            style={[styles.retryBtn, { borderColor: theme.tint }]}
            onPress={onRetry}
            disabled={submitting}
          >
            <Text style={[styles.retryText, { color: theme.tint }]}>重试</Text>
          </Pressable>
        </View>
      ) : null}

      <Pressable
        style={[
          styles.submit,
          { backgroundColor: theme.tint, opacity: submitting ? 0.7 : 1 },
        ]}
        onPress={onSubmit}
        disabled={submitting}
      >
        {submitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.submitText}>生成计划</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  lead: { fontSize: 15, lineHeight: 22, marginBottom: 24 },
  label: { fontSize: 15, fontWeight: '600', marginBottom: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 22 },
  chip: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
  },
  chipText: { fontSize: 15, fontWeight: '600' },
  errorContainer: {
    marginBottom: 12,
    padding: 12,
    backgroundColor: '#ffebee',
    borderRadius: 8,
    gap: 8,
  },
  error: { color: '#c62828', fontSize: 14, lineHeight: 20 },
  retryBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  retryText: { fontSize: 14, fontWeight: '600' },
  submit: {
    marginTop: 8,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  submitText: { color: '#fff', fontSize: 17, fontWeight: '700' },
});
