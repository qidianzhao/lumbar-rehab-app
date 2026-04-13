import FontAwesome from '@expo/vector-icons/FontAwesome';
import { type Href, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import type { AssessmentTestItem, MetricType, TestItemSubmit } from '@/src/services/assessmentApi';
import * as assessmentApi from '@/src/services/assessmentApi';

function metricLabel(t: MetricType): string {
  if (t === 'seconds') return '秒';
  if (t === 'reps') return '次';
  return '分';
}

export default function AssessmentTestScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<AssessmentTestItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [values, setValues] = useState<Record<number, number>>({});
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const list = await assessmentApi.getTestItems();
        if (!cancelled) {
          setItems(list);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : '加载失败');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const current = items[index];
  const progress = items.length ? (index + 1) / items.length : 0;

  const currentValue = current ? values[current.action_id] : undefined;
  const canNext = current ? typeof currentValue === 'number' && Number.isFinite(currentValue) : false;

  const ratingOptions = useMemo(() => [1, 2, 3, 4, 5], []);

  function setCurrentValue(v: number) {
    if (!current) return;
    setValues((prev) => ({ ...prev, [current.action_id]: v }));
  }

  function setCurrentNotes(v: string) {
    if (!current) return;
    setNotes((prev) => ({ ...prev, [current.action_id]: v }));
  }

  async function onSubmitAll() {
    if (items.length === 0) return;
    const payload: TestItemSubmit[] = items.map((it) => ({
      action_id: it.action_id,
      metric_value: values[it.action_id] ?? 0,
      user_notes: notes[it.action_id] ? notes[it.action_id] : null,
    }));
    setSubmitting(true);
    setError(null);
    try {
      const report = await assessmentApi.submitAssessment({ items: payload });
      router.replace((`/assessment/result?id=${report.id}` as unknown) as Href);
    } catch (e) {
      setError(e instanceof Error ? e.message : '提交失败');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.tint} />
      </View>
    );
  }

  if (error && items.length === 0) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <Text style={{ color: theme.text }}>{error}</Text>
        <Pressable style={[styles.btn, { backgroundColor: theme.tint }]} onPress={() => router.replace('/assessment/test' as Href)}>
          <Text style={styles.btnText}>重试</Text>
        </Pressable>
      </View>
    );
  }

  if (!current) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <Text style={{ color: theme.text }}>无测试项目</Text>
      </View>
    );
  }

  const unit = metricLabel(current.metric_type);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.background }} contentContainerStyle={styles.content}>
      <View style={styles.progressWrap}>
        <View style={[styles.progressBarBg, { backgroundColor: `${theme.tint}22` }]}>
          <View style={[styles.progressBarFill, { backgroundColor: theme.tint, width: `${progress * 100}%` }]} />
        </View>
        <Text style={[styles.progressText, { color: theme.text }]}>
          {index + 1} / {items.length}
        </Text>
      </View>

      <View style={[styles.card, { borderColor: theme.tabIconDefault }]}>
        <Text style={[styles.name, { color: theme.text }]}>{current.name}</Text>
        <Text style={[styles.prompt, { color: theme.text }]}>{current.prompt}</Text>

        <View style={[styles.media, { borderColor: theme.tabIconDefault }]}>
          <FontAwesome name="play-circle-o" size={40} color={theme.tabIconDefault} />
          <Text style={[styles.mediaText, { color: theme.text }]}>视频/动图占位（后续接入）</Text>
        </View>

        {current.metric_type === 'rating_1_5' ? (
          <View style={styles.chips}>
            {ratingOptions.map((n) => {
              const active = currentValue === n;
              return (
                <Pressable
                  key={n}
                  onPress={() => setCurrentValue(n)}
                  style={[
                    styles.chip,
                    {
                      borderColor: active ? theme.tint : theme.tabIconDefault,
                      backgroundColor: active ? `${theme.tint}22` : 'transparent',
                    },
                  ]}
                >
                  <Text style={{ color: active ? theme.tint : theme.text, fontWeight: '700' }}>{n}</Text>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <View style={styles.inputRow}>
            <TextInput
              value={typeof currentValue === 'number' ? String(currentValue) : ''}
              onChangeText={(t) => setCurrentValue(Number(t))}
              keyboardType="numeric"
              placeholder={`请输入${unit}`}
              placeholderTextColor="#999"
              style={[
                styles.input,
                { borderColor: theme.tabIconDefault, color: theme.text },
              ]}
            />
            <Text style={{ color: theme.text, opacity: 0.8, fontWeight: '700' }}>{unit}</Text>
          </View>
        )}

        <TextInput
          value={notes[current.action_id] ?? ''}
          onChangeText={setCurrentNotes}
          placeholder="备注（可选）"
          placeholderTextColor="#999"
          style={[styles.notes, { borderColor: theme.tabIconDefault, color: theme.text }]}
        />
      </View>

      {error ? <Text style={styles.err}>{error}</Text> : null}

      <View style={styles.navRow}>
        <Pressable
          style={[styles.btnOutline, { borderColor: theme.tint, opacity: index === 0 ? 0.5 : 1 }]}
          onPress={() => setIndex((i) => Math.max(0, i - 1))}
          disabled={index === 0}
        >
          <Text style={[styles.btnOutlineText, { color: theme.tint }]}>上一个</Text>
        </Pressable>

        {index < items.length - 1 ? (
          <Pressable
            style={[styles.btn, { backgroundColor: theme.tint, opacity: canNext ? 1 : 0.6 }]}
            onPress={() => setIndex((i) => Math.min(items.length - 1, i + 1))}
            disabled={!canNext}
          >
            <Text style={styles.btnText}>下一个</Text>
          </Pressable>
        ) : (
          <Pressable
            style={[styles.btn, { backgroundColor: theme.tint, opacity: canNext && !submitting ? 1 : 0.6 }]}
            onPress={onSubmitAll}
            disabled={!canNext || submitting}
          >
            <Text style={styles.btnText}>{submitting ? '提交中…' : '提交评估'}</Text>
          </Pressable>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 12 },
  content: { padding: 16, paddingBottom: 40 },
  progressWrap: { marginBottom: 14, gap: 6 },
  progressBarBg: { height: 10, borderRadius: 999, overflow: 'hidden' },
  progressBarFill: { height: 10, borderRadius: 999 },
  progressText: { fontSize: 13, opacity: 0.8 },
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: 14 },
  name: { fontSize: 18, fontWeight: '800', marginBottom: 6 },
  prompt: { fontSize: 14, opacity: 0.85, marginBottom: 12, lineHeight: 20 },
  media: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 14,
  },
  mediaText: { fontSize: 13, opacity: 0.75 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12 },
  chip: { borderWidth: 1, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14, minWidth: 48, alignItems: 'center' },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  input: { flex: 1, borderWidth: 1, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12, fontSize: 16 },
  notes: { borderWidth: 1, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12, fontSize: 14, marginTop: 4 },
  navRow: { flexDirection: 'row', gap: 12, marginTop: 16 },
  btn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  btnOutline: { flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 1, alignItems: 'center' },
  btnOutlineText: { fontSize: 16, fontWeight: '800' },
  err: { color: '#c62828', marginTop: 12, textAlign: 'center' },
});
