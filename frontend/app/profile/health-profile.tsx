import axios from 'axios';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getUserHealthProfile, updateUserHealthProfile } from '@/src/api/user';

function formatApiError(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const d = err.response?.data as { detail?: string | { msg?: string }[] } | undefined;
    if (typeof d?.detail === 'string') return d.detail;
    if (Array.isArray(d?.detail)) return d.detail.map((x) => JSON.stringify(x)).join('\n');
    return err.message || '网络错误';
  }
  if (err instanceof Error) return err.message;
  return '请求失败';
}

const LUMBAR_LEVELS = [
  { value: 'L3_L4', label: 'L3-L4' },
  { value: 'L4_L5', label: 'L4-L5' },
  { value: 'L5_S1', label: 'L5-S1' },
  { value: 'OTHER', label: '其他' },
  { value: 'UNSURE', label: '不确定' },
];

const DISC_CONDITIONS = [
  { value: 'BULGING', label: '膨出' },
  { value: 'PROTRUSION', label: '突出' },
  { value: 'EXTRUSION', label: '脱出' },
  { value: 'UNSURE', label: '不确定' },
];

const ADDITIONAL_CONDITIONS = [
  { value: 'STENOSIS', label: '椎管狭窄' },
  { value: 'SPONDYLOLISTHESIS', label: '椎体滑脱' },
  { value: 'SCOLIOSIS', label: '脊柱侧弯' },
  { value: 'NONE', label: '无' },
];

const SITTING_DURATIONS = [
  { value: 'LT_4H', label: '小于4小时' },
  { value: 'H4_8', label: '4-8小时' },
  { value: 'GT_8H', label: '大于8小时' },
];

const EXERCISE_HABITS = [
  { value: 'NONE', label: '无' },
  { value: 'OCCASIONAL', label: '偶尔' },
  { value: 'REGULAR', label: '规律' },
];

function MultiChip({
  options,
  selected,
  onChange,
}: {
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const toggle = (v: string) => {
    onChange(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v]);
  };
  return (
    <View style={styles.chipRow}>
      {options.map((opt) => {
        const active = selected.includes(opt.value);
        return (
          <Pressable
            key={opt.value}
            style={[styles.chip, active && styles.chipActive]}
            onPress={() => toggle(opt.value)}>
            <Text style={[styles.chipText, active && styles.chipTextActive]}>{opt.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function SingleChip({
  options,
  selected,
  onChange,
}: {
  options: { value: string; label: string }[];
  selected: string | null;
  onChange: (v: string) => void;
}) {
  return (
    <View style={styles.chipRow}>
      {options.map((opt) => {
        const active = selected === opt.value;
        return (
          <Pressable
            key={opt.value}
            style={[styles.chip, active && styles.chipActive]}
            onPress={() => onChange(opt.value)}>
            <Text style={[styles.chipText, active && styles.chipTextActive]}>{opt.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function HealthProfileScreen() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [discSegments, setDiscSegments] = useState<string[]>([]);
  const [discSeverity, setDiscSeverity] = useState<string | null>(null);
  const [otherConditions, setOtherConditions] = useState<string[]>([]);
  const [dailySittingHours, setDailySittingHours] = useState<string | null>(null);
  const [exerciseHabit, setExerciseHabit] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const profile = await getUserHealthProfile();
        if (profile.height != null) setHeight(String(profile.height));
        if (profile.weight != null) setWeight(String(profile.weight));
        setDiscSegments(profile.disc_segments ?? []);
        setDiscSeverity(profile.disc_severity ?? null);
        setOtherConditions(profile.other_conditions ?? []);
        setDailySittingHours(profile.daily_sitting_hours ?? null);
        setExerciseHabit(profile.exercise_habit ?? null);
      } catch {
        // 静默处理，保持空表单
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const onSave = useCallback(async () => {
    const h = parseFloat(height);
    const w = parseFloat(weight);
    if (height && (isNaN(h) || h <= 0 || h > 300)) {
      Alert.alert('提示', '请输入有效身高（cm）');
      return;
    }
    if (weight && (isNaN(w) || w <= 0 || w > 500)) {
      Alert.alert('提示', '请输入有效体重（kg）');
      return;
    }

    setSaving(true);
    try {
      await updateUserHealthProfile({
        height: height ? h : null,
        weight: weight ? w : null,
        disc_segments: discSegments,
        disc_severity: discSeverity,
        other_conditions: otherConditions,
        daily_sitting_hours: dailySittingHours,
        exercise_habit: exerciseHabit,
      });
      router.back();
    } catch (e) {
      Alert.alert('保存失败', formatApiError(e));
    } finally {
      setSaving(false);
    }
  }, [height, weight, discSegments, discSeverity, otherConditions, dailySittingHours, exerciseHabit]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>

          <Text style={styles.label}>身高（cm）</Text>
          <TextInput
            style={styles.input}
            placeholder="例如：175"
            keyboardType="decimal-pad"
            value={height}
            onChangeText={setHeight}
          />

          <Text style={styles.label}>体重（kg）</Text>
          <TextInput
            style={styles.input}
            placeholder="例如：70"
            keyboardType="decimal-pad"
            value={weight}
            onChangeText={setWeight}
          />

          <Text style={styles.label}>腰部受累节段（可多选）</Text>
          <MultiChip options={LUMBAR_LEVELS} selected={discSegments} onChange={setDiscSegments} />

          <Text style={[styles.label, styles.labelMt]}>腰椎间盘情况</Text>
          <SingleChip options={DISC_CONDITIONS} selected={discSeverity} onChange={setDiscSeverity} />

          <Text style={[styles.label, styles.labelMt]}>合并情况（可多选）</Text>
          <MultiChip options={ADDITIONAL_CONDITIONS} selected={otherConditions} onChange={setOtherConditions} />

          <Text style={[styles.label, styles.labelMt]}>日常久坐时长</Text>
          <SingleChip options={SITTING_DURATIONS} selected={dailySittingHours} onChange={setDailySittingHours} />

          <Text style={[styles.label, styles.labelMt]}>运动习惯</Text>
          <SingleChip options={EXERCISE_HABITS} selected={exerciseHabit} onChange={setExerciseHabit} />

        </View>

        <Pressable
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
          onPress={onSave}
          disabled={saving}>
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveBtnText}>保存</Text>
          )}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f5f5f5' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: 20, paddingBottom: 40 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    marginBottom: 20,
  },
  label: { fontSize: 14, color: '#666', marginBottom: 8 },
  labelMt: { marginTop: 16 },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    marginBottom: 4,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#fff',
  },
  chipActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  chipText: { fontSize: 14, color: '#555' },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  saveBtn: {
    backgroundColor: '#16a34a',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.7 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
