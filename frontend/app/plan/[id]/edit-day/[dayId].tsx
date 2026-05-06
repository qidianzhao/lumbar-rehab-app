import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
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

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import type { PlanDay, PlanExercise, UpdatePlanDayExercise } from '@/src/services/planApi';
import * as planApi from '@/src/services/planApi';
import { handleError } from '@/src/utils/errorHandler';

const PHASE_LABEL: Record<string, string> = {
  warmup: '热身',
  core: '核心',
  stretch: '拉伸',
};

type EditableExercise = PlanExercise & { _tempId?: string };

export default function EditPlanDayScreen() {
  const { id, dayId } = useLocalSearchParams<{ id: string; dayId: string }>();
  const planId = Number(id);
  const planDayId = Number(dayId);
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [aiModifying, setAiModifying] = useState(false);
  const [showAiInput, setShowAiInput] = useState(false);
  const [aiInstruction, setAiInstruction] = useState('');
  const [planDay, setPlanDay] = useState<PlanDay | null>(null);
  const [exercises, setExercises] = useState<EditableExercise[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!Number.isFinite(planId) || !Number.isFinite(planDayId)) {
      setError('无效的参数');
      setLoading(false);
      return;
    }

    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const plan = await planApi.getPlanById(planId);
        const day = plan.days.find((d) => d.id === planDayId);
        if (!day) throw new Error('未找到训练日');

        if (!cancelled) {
          setPlanDay(day);
          setExercises([...day.exercises].sort((a, b) => a.sort_order - b.sort_order));
        }
      } catch (e) {
        if (!cancelled) {
          const errorInfo = handleError(e, '加载失败');
          setError(errorInfo.message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [planId, planDayId]);

  const updateExercise = (index: number, field: keyof EditableExercise, value: string | number) => {
    setExercises((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const moveExercise = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === exercises.length - 1) return;

    setExercises((prev) => {
      const next = [...prev];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      return next;
    });
  };

  const deleteExercise = (index: number) => {
    Alert.alert('确认删除', '确定要删除这个动作吗？', [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: () => {
          setExercises((prev) => prev.filter((_, i) => i !== index));
        },
      },
    ]);
  };

  const handleSave = async () => {
    if (exercises.length === 0) {
      Alert.alert('错误', '至少需要保留一个动作');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const payload: UpdatePlanDayExercise[] = exercises.map((ex, idx) => ({
        id: ex.id,
        action_id: ex.action_id,
        phase: ex.phase,
        sets: ex.sets,
        reps: ex.reps,
        rest_seconds: ex.rest_seconds,
        sort_order: idx,
      }));

      await planApi.updatePlanDay(planId, planDayId, { exercises: payload });
      Alert.alert('保存成功', '训练计划已更新', [
        { text: '确定', onPress: () => router.back() },
      ]);
    } catch (e) {
      const errorInfo = handleError(e, '保存失败');
      setError(errorInfo.message);
      Alert.alert('保存失败', errorInfo.message);
    } finally {
      setSaving(false);
    }
  };

  const handleAiModify = async () => {
    if (!aiInstruction.trim()) {
      Alert.alert('提示', '请输入修改指令');
      return;
    }

    setAiModifying(true);
    setError(null);

    try {
      const result = await planApi.aiModifyPlanDay(planId, planDayId, {
        instruction: aiInstruction.trim(),
      });

      if (result.success && result.modified_exercises) {
        // 更新本地exercises状态
        setExercises(result.modified_exercises.map((ex, idx) => ({
          ...ex,
          sort_order: idx,
        })));
        Alert.alert('AI修改成功', result.message);
        setAiInstruction('');
        setShowAiInput(false);
      } else {
        Alert.alert('AI修改失败', result.message);
      }
    } catch (e) {
      const errorInfo = handleError(e, 'AI修改失败');
      setError(errorInfo.message);
      Alert.alert('AI修改失败', errorInfo.message);
    } finally {
      setAiModifying(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.tint} />
      </View>
    );
  }

  if (error && !planDay) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <Text style={{ color: theme.text }}>{error}</Text>
        <Pressable
          style={[styles.btn, { backgroundColor: theme.tint }]}
          onPress={() => router.back()}
        >
          <Text style={styles.btnText}>返回</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={[styles.title, { color: theme.text }]}>编辑训练日</Text>
        <Text style={[styles.subtitle, { color: theme.text }]}>{planDay?.title}</Text>

        {error ? (
          <View style={[styles.errorBanner, { backgroundColor: '#fdecea' }]}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* AI助手区域 */}
        <View style={[styles.aiSection, { borderColor: theme.tabIconDefault }]}>
          <Pressable
            style={[styles.aiToggleBtn, { backgroundColor: showAiInput ? theme.tint : 'transparent' }]}
            onPress={() => setShowAiInput(!showAiInput)}
          >
            <Text style={[styles.aiToggleText, { color: showAiInput ? '#fff' : theme.tint }]}>
              🤖 AI助手
            </Text>
          </Pressable>

          {showAiInput && (
            <View style={styles.aiInputContainer}>
              <TextInput
                style={[styles.aiInput, { borderColor: theme.tabIconDefault, color: theme.text }]}
                value={aiInstruction}
                onChangeText={setAiInstruction}
                placeholder="例如：增加核心训练强度、减少拉伸时间、添加平板支撑..."
                placeholderTextColor={theme.tabIconDefault}
                multiline
                numberOfLines={3}
              />
              <Pressable
                style={[styles.aiSubmitBtn, { backgroundColor: theme.tint, opacity: aiModifying ? 0.5 : 1 }]}
                onPress={handleAiModify}
                disabled={aiModifying}
              >
                {aiModifying ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.aiSubmitText}>应用修改</Text>
                )}
              </Pressable>
            </View>
          )}
        </View>

        <View style={styles.exerciseList}>
          {exercises.map((ex, idx) => (
            <View key={ex.id || ex._tempId} style={[styles.exerciseCard, { borderColor: theme.tabIconDefault }]}>
              {/* 紧凑标题行：动作名 + 热身标记 */}
              <View style={styles.exerciseHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.exerciseName, { color: theme.text }]}>
                    {idx + 1}. {ex.name}
                    {ex.phase === 'warmup' && (
                      <Text style={[styles.warmupTag, { color: theme.text }]}> (热身)</Text>
                    )}
                  </Text>
                </View>
                <View style={styles.exerciseActions}>
                  <Pressable
                    style={[styles.iconBtn, { opacity: idx === 0 ? 0.3 : 1 }]}
                    onPress={() => moveExercise(idx, 'up')}
                    disabled={idx === 0}
                  >
                    <FontAwesome name="arrow-up" size={14} color={theme.tint} />
                  </Pressable>
                  <Pressable
                    style={[styles.iconBtn, { opacity: idx === exercises.length - 1 ? 0.3 : 1 }]}
                    onPress={() => moveExercise(idx, 'down')}
                    disabled={idx === exercises.length - 1}
                  >
                    <FontAwesome name="arrow-down" size={14} color={theme.tint} />
                  </Pressable>
                  <Pressable style={styles.iconBtn} onPress={() => deleteExercise(idx)}>
                    <FontAwesome name="trash-o" size={14} color="#e53935" />
                  </Pressable>
                </View>
              </View>

              {/* 紧凑参数行：组数×次数 · 休息时间 */}
              <View style={styles.compactRow}>
                <View style={styles.compactInputGroup}>
                  <TextInput
                    style={[styles.compactInput, { borderColor: theme.tabIconDefault, color: theme.text }]}
                    value={String(ex.sets)}
                    onChangeText={(v) => updateExercise(idx, 'sets', Number(v) || 0)}
                    keyboardType="number-pad"
                    placeholder="组"
                  />
                  <Text style={[styles.compactLabel, { color: theme.text }]}>组 ×</Text>
                  <TextInput
                    style={[styles.compactInput, { borderColor: theme.tabIconDefault, color: theme.text }]}
                    value={String(ex.reps)}
                    onChangeText={(v) => updateExercise(idx, 'reps', Number(v) || 0)}
                    keyboardType="number-pad"
                    placeholder="次"
                  />
                  <Text style={[styles.compactLabel, { color: theme.text }]}>次</Text>
                </View>

                <Text style={[styles.separator, { color: theme.text }]}>·</Text>

                <View style={styles.compactInputGroup}>
                  <Text style={[styles.compactLabel, { color: theme.text }]}>休息</Text>
                  <TextInput
                    style={[styles.compactInput, { borderColor: theme.tabIconDefault, color: theme.text }]}
                    value={String(ex.rest_seconds)}
                    onChangeText={(v) => updateExercise(idx, 'rest_seconds', Number(v) || 0)}
                    keyboardType="number-pad"
                    placeholder="秒"
                  />
                  <Text style={[styles.compactLabel, { color: theme.text }]}>秒</Text>
                </View>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={[styles.footer, { borderTopColor: theme.tabIconDefault, backgroundColor: theme.background }]}>
        <Pressable
          style={[styles.btnOutline, { borderColor: theme.tabIconDefault }]}
          onPress={() => router.back()}
        >
          <Text style={[styles.btnOutlineText, { color: theme.text }]}>取消</Text>
        </Pressable>
        <Pressable
          style={[styles.btn, { backgroundColor: theme.tint, opacity: saving ? 0.5 : 1, flex: 1 }]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.btnText}>保存修改</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 12 },
  scroll: { padding: 16, paddingBottom: 120 },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 4 },
  subtitle: { fontSize: 16, opacity: 0.85, marginBottom: 16 },
  errorBanner: { padding: 12, borderRadius: 8, marginBottom: 16 },
  errorText: { color: '#c62828', fontSize: 14 },
  aiSection: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  aiToggleBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  aiToggleText: {
    fontSize: 15,
    fontWeight: '600',
  },
  aiInputContainer: {
    marginTop: 12,
    gap: 12,
  },
  aiInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  aiSubmitBtn: {
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  aiSubmitText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  exerciseList: { gap: 12 },
  exerciseCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 14,
    gap: 10,
  },
  exerciseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  exerciseName: { fontSize: 15, fontWeight: '600' },
  warmupTag: { fontSize: 13, fontWeight: '400', opacity: 0.6 },
  exerciseActions: { flexDirection: 'row', gap: 4 },
  iconBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  compactInputGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  compactInput: {
    borderWidth: 1,
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    fontSize: 14,
    textAlign: 'center',
    minWidth: 45,
  },
  compactLabel: { fontSize: 13, opacity: 0.7 },
  separator: { fontSize: 14, opacity: 0.4, marginHorizontal: 4 },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 16,
    paddingBottom: 28,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 12,
  },
  btn: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  btnOutline: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnOutlineText: { fontSize: 16, fontWeight: '600' },
});
