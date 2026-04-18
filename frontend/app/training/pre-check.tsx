import { type Href, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import * as trainingApi from '@/src/services/trainingApi';
import { useTrainingStore } from '@/src/stores/trainingStore';

const REGIONS: { id: string; label: string }[] = [
  { id: 'waist_left', label: '腰部左侧' },
  { id: 'waist_right', label: '腰部右侧' },
  { id: 'waist_center', label: '腰部中间' },
  { id: 'leg', label: '腿部' },
];

export default function TrainingPreCheckScreen() {
  const router = useRouter();
  const { planId: planIdStr, planDayId: planDayIdStr } = useLocalSearchParams<{
    planId?: string;
    planDayId?: string;
  }>();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  const hydrate = useTrainingStore((s) => s.hydrateFromSession);
  const reset = useTrainingStore((s) => s.reset);

  const planId = Number(planIdStr);
  const planDayId = Number(planDayIdStr);

  const [modalVisible, setModalVisible] = useState(false);
  const [region, setRegion] = useState('waist_center');
  const [painLevel, setPainLevel] = useState(3);
  const [desc, setDesc] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startWithStatus(status: trainingApi.PreCheckStatus) {
    if (!Number.isFinite(planId) || !Number.isFinite(planDayId)) {
      setError('缺少计划参数');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      reset();
      const data = await trainingApi.createSession({
        plan_id: planId,
        plan_day_id: planDayId,
        pre_check_status: status,
        pain_info:
          status === 'discomfort'
            ? { body_region: region, pain_level: Math.round(painLevel), description: desc || null }
            : null,
      });
      hydrate(data);
      setModalVisible(false);
      router.replace('/training/session' as Href);
    } catch (e) {
      setError(e instanceof Error ? e.message : '创建会话失败');
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView style={[styles.root, { backgroundColor: theme.background }]} contentContainerStyle={styles.content}>
      <Text style={[styles.title, { color: theme.text }]}>训练前状态确认</Text>
      <Text style={[styles.hint, { color: theme.text }]}>
        请根据当前身体感受选择。若明显不适，建议暂停训练或降低强度。
      </Text>

      {error ? <Text style={styles.err}>{error}</Text> : null}

      <Pressable
        style={[styles.bigBtn, { backgroundColor: theme.tint, opacity: loading ? 0.7 : 1 }]}
        disabled={loading}
        onPress={() => void startWithStatus('normal')}
      >
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.bigBtnText}>状态正常</Text>}
      </Pressable>

      <Pressable
        style={[styles.bigBtn, { backgroundColor: '#b8860b', opacity: loading ? 0.7 : 1 }]}
        disabled={loading}
        onPress={() => setModalVisible(true)}
      >
        <Text style={styles.bigBtnText}>有些不适</Text>
      </Pressable>

      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalMask}>
          <View style={[styles.modalCard, { backgroundColor: theme.background }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>不适信息</Text>
            <Text style={[styles.label, { color: theme.text }]}>疼痛部位</Text>
            <View style={styles.regionRow}>
              {REGIONS.map((r) => {
                const on = region === r.id;
                return (
                  <Pressable
                    key={r.id}
                    onPress={() => setRegion(r.id)}
                    style={[
                      styles.regionChip,
                      {
                        borderColor: on ? theme.tint : theme.tabIconDefault,
                        backgroundColor: on ? `${theme.tint}22` : 'transparent',
                      },
                    ]}
                  >
                    <Text style={{ color: on ? theme.tint : theme.text, fontWeight: '600' }}>{r.label}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={[styles.label, { color: theme.text }]}>疼痛等级：{Math.round(painLevel)} / 10</Text>
            <View style={styles.levelRow}>
              {Array.from({ length: 11 }, (_, i) => i).map((n) => {
                const on = Math.round(painLevel) === n;
                return (
                  <Pressable
                    key={n}
                    onPress={() => setPainLevel(n)}
                    style={[
                      styles.levelChip,
                      {
                        borderColor: on ? theme.tint : theme.tabIconDefault,
                        backgroundColor: on ? `${theme.tint}22` : 'transparent',
                      },
                    ]}
                  >
                    <Text style={{ color: on ? theme.tint : theme.text, fontSize: 13, fontWeight: '700' }}>{n}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={[styles.label, { color: theme.text }]}>补充描述（可选）</Text>
            <TextInput
              value={desc}
              onChangeText={setDesc}
              placeholder="例如：弯腰时加重"
              placeholderTextColor="#999"
              style={[styles.input, { borderColor: theme.tabIconDefault, color: theme.text }]}
              multiline
            />
            <View style={styles.modalActions}>
              <Pressable style={[styles.smallBtn, { borderColor: theme.tabIconDefault }]} onPress={() => setModalVisible(false)}>
                <Text style={{ color: theme.text }}>取消</Text>
              </Pressable>
              <Pressable
                style={[styles.smallBtn, { backgroundColor: theme.tint }]}
                onPress={() => void startWithStatus('discomfort')}
              >
                <Text style={{ color: '#fff', fontWeight: '700' }}>确认并开始</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 22, fontWeight: '800', marginBottom: 8 },
  hint: { fontSize: 14, lineHeight: 20, opacity: 0.85, marginBottom: 20 },
  err: { color: '#c62828', marginBottom: 12 },
  bigBtn: {
    paddingVertical: 18,
    borderRadius: 14,
    alignItems: 'center',
    marginBottom: 14,
  },
  bigBtnText: { color: '#fff', fontSize: 18, fontWeight: '800' },
  modalMask: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    padding: 18,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    gap: 8,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', marginBottom: 6 },
  label: { fontSize: 14, fontWeight: '600', marginTop: 6 },
  regionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  regionChip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    minHeight: 72,
    padding: 10,
    textAlignVertical: 'top',
  },
  levelRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  levelChip: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 12 },
  smallBtn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
});
