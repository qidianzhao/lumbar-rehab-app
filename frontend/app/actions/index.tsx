import FontAwesome from '@expo/vector-icons/FontAwesome';
import { type Href, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { handleError } from '@/src/utils/errorHandler';
import * as planApi from '@/src/services/planApi';

const API = process.env.EXPO_PUBLIC_API_BASE ?? 'http://localhost:8000/api/v1';

type Action = {
  id: number;
  name: string;
  category: string;
  phase: string;
  body_part: string;
  difficulty_level: number;
  description: string | null;
  video_url: string | null;
  thumbnail_url: string | null;
};

const BODY_PARTS = [
  { key: 'neck', label: '颈部', icon: 'user' },
  { key: 'shoulder', label: '肩部', icon: 'hand-rock-o' },
  { key: 'back', label: '背部', icon: 'square' },
  { key: 'waist', label: '腰部', icon: 'circle-o' },
  { key: 'hip', label: '臀部', icon: 'circle' },
  { key: 'leg', label: '腿部', icon: 'long-arrow-down' },
] as const;

export default function ActionsLibraryScreen() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [actions, setActions] = useState<Action[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedPart, setSelectedPart] = useState<string>('neck');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedAction, setSelectedAction] = useState<Action | null>(null);
  const [plans, setPlans] = useState<planApi.TrainingPlan[]>([]);
  const [addingToPlan, setAddingToPlan] = useState(false);

  const load = useCallback(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const [actionsRes, plansData] = await Promise.all([
          fetch(`${API}/actions`),
          planApi.getMyPlans(),
        ]);
        const actionsData = await actionsRes.json();
        if (!cancelled) {
          setActions(actionsData);
          setPlans(plansData);
        }
      } catch (e) {
        if (!cancelled) {
          const errorInfo = handleError(e, '加载动作库失败');
          setError(errorInfo.message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useFocusEffect(load);

  const filteredActions = actions.filter((a) => a.body_part === selectedPart);

  const handleAddToPlan = (action: Action) => {
    setSelectedAction(action);
    setShowAddModal(true);
  };

  const handleConfirmAdd = async (planId: number) => {
    if (!selectedAction || addingToPlan) return;

    setAddingToPlan(true);
    try {
      await fetch(`${API}/plans/${planId}/exercises`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action_id: selectedAction.id,
          insert_position: 'end',
          phase: 'core',
          sets: 3,
          reps: 12,
          rest_seconds: 60,
        }),
      });
      Alert.alert('成功', `已将"${selectedAction.name}"添加到方案`);
      setShowAddModal(false);
      setSelectedAction(null);
    } catch (e) {
      const errorInfo = handleError(e, '添加动作失败');
      Alert.alert('错误', errorInfo.message);
    } finally {
      setAddingToPlan(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top']}>
      <View style={styles.container}>
        <Text style={[styles.title, { color: theme.text }]}>动作库</Text>

        {loading && (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={theme.tint} />
            <Text style={[styles.loadingText, { color: theme.text }]}>加载中...</Text>
          </View>
        )}

        {!loading && error && (
          <View style={[styles.errorCard, { borderColor: theme.tabIconDefault }]}>
            <FontAwesome name="exclamation-circle" size={24} color="#e53935" />
            <Text style={[styles.errorText, { color: theme.text }]}>{error}</Text>
            <Pressable style={[styles.retryBtn, { backgroundColor: theme.tint }]} onPress={load}>
              <Text style={styles.retryText}>重试</Text>
            </Pressable>
          </View>
        )}

        {!loading && !error && (
          <View style={styles.content}>
            {/* 左侧部位标签 */}
            <View style={[styles.sidebar, { borderRightColor: theme.tabIconDefault }]}>
              <ScrollView showsVerticalScrollIndicator={false}>
                {BODY_PARTS.map((part) => (
                  <Pressable
                    key={part.key}
                    style={[
                      styles.partBtn,
                      selectedPart === part.key && [
                        styles.partBtnActive,
                        { backgroundColor: `${theme.tint}15`, borderLeftColor: theme.tint },
                      ],
                    ]}
                    onPress={() => setSelectedPart(part.key)}
                  >
                    <FontAwesome
                      name={part.icon}
                      size={18}
                      color={selectedPart === part.key ? theme.tint : theme.text}
                      style={{ opacity: selectedPart === part.key ? 1 : 0.5 }}
                    />
                    <Text
                      style={[
                        styles.partLabel,
                        { color: selectedPart === part.key ? theme.tint : theme.text },
                        selectedPart !== part.key && { opacity: 0.7 },
                      ]}
                    >
                      {part.label}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>

            {/* 右侧视频网格 */}
            <ScrollView style={styles.mainContent} contentContainerStyle={styles.gridContainer}>
              {filteredActions.length === 0 ? (
                <View style={styles.emptyState}>
                  <FontAwesome name="inbox" size={48} color={theme.tabIconDefault} />
                  <Text style={[styles.emptyText, { color: theme.text }]}>
                    该部位暂无动作
                  </Text>
                </View>
              ) : (
                <View style={styles.actionGrid}>
                  {filteredActions.map((action) => (
                    <View
                      key={action.id}
                      style={[styles.actionCard, { borderColor: theme.tabIconDefault }]}
                    >
                      <Pressable
                        style={styles.videoArea}
                        onPress={() => alert(`播放：${action.name}`)}
                      >
                        <View
                          style={[styles.thumbnail, { backgroundColor: theme.tabIconDefault + '20' }]}
                        >
                          {action.thumbnail_url ? (
                            <Image
                              source={{ uri: action.thumbnail_url }}
                              style={styles.thumbnailImage}
                              resizeMode="cover"
                            />
                          ) : (
                            <FontAwesome
                              name="play-circle"
                              size={32}
                              color={theme.tabIconDefault}
                            />
                          )}
                        </View>
                      </Pressable>

                      <View style={styles.actionInfo}>
                        <Text style={[styles.actionName, { color: theme.text }]} numberOfLines={2}>
                          {action.name}
                        </Text>

                        <View style={styles.actionFooter}>
                          <View style={styles.difficultyRow}>
                            {Array.from({ length: action.difficulty_level }).map((_, i) => (
                              <FontAwesome key={i} name="star" size={10} color="#FF9800" />
                            ))}
                          </View>

                          <Pressable
                            style={[styles.addBtn, { backgroundColor: theme.tint }]}
                            onPress={() => handleAddToPlan(action)}
                          >
                            <FontAwesome name="plus" size={14} color="#fff" />
                          </Pressable>
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </ScrollView>
          </View>
        )}
      </View>

      {/* 添加到方案弹窗 */}
      <Modal
        visible={showAddModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAddModal(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowAddModal(false)}>
          <Pressable style={[styles.modalContent, { backgroundColor: theme.background }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>添加到方案</Text>
            <Text style={[styles.modalSubtitle, { color: theme.text }]}>
              选择要添加到的训练方案
            </Text>

            <ScrollView style={styles.planList}>
              {plans.map((plan) => (
                <Pressable
                  key={plan.id}
                  style={[styles.planItem, { borderColor: theme.tabIconDefault }]}
                  onPress={() => handleConfirmAdd(plan.id)}
                  disabled={addingToPlan}
                >
                  <FontAwesome name="file-text-o" size={16} color={theme.tint} />
                  <Text style={[styles.planName, { color: theme.text }]}>{plan.name}</Text>
                  <FontAwesome name="chevron-right" size={14} color={theme.tabIconDefault} />
                </Pressable>
              ))}
            </ScrollView>

            <Pressable
              style={[styles.cancelBtn, { borderColor: theme.tabIconDefault }]}
              onPress={() => setShowAddModal(false)}
            >
              <Text style={[styles.cancelText, { color: theme.text }]}>取消</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { flex: 1, padding: 16 },
  title: { fontSize: 28, fontWeight: '700', marginBottom: 16 },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { fontSize: 14, opacity: 0.5 },
  errorCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: 24,
    alignItems: 'center',
    gap: 12,
  },
  errorText: { fontSize: 14, textAlign: 'center' },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, marginTop: 8 },
  retryText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  content: { flex: 1, flexDirection: 'row', gap: 12 },
  sidebar: {
    width: 80,
    borderRightWidth: StyleSheet.hairlineWidth,
    paddingRight: 8,
  },
  partBtn: {
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 8,
    gap: 6,
    borderLeftWidth: 3,
    borderLeftColor: 'transparent',
  },
  partBtnActive: {
    borderLeftWidth: 3,
  },
  partLabel: { fontSize: 12, fontWeight: '600', textAlign: 'center' },
  mainContent: { flex: 1 },
  gridContainer: { paddingBottom: 20 },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  emptyText: { fontSize: 14, opacity: 0.5 },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  actionCard: {
    width: '48%',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    overflow: 'hidden',
  },
  videoArea: { width: '100%' },
  thumbnail: {
    width: '100%',
    aspectRatio: 16 / 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbnailImage: { width: '100%', height: '100%' },
  actionInfo: { padding: 10, gap: 8 },
  actionName: { fontSize: 14, fontWeight: '600', lineHeight: 18, minHeight: 36 },
  actionFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  difficultyRow: { flexDirection: 'row', gap: 2 },
  addBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 16,
    padding: 20,
    gap: 16,
  },
  modalTitle: { fontSize: 20, fontWeight: '700', textAlign: 'center' },
  modalSubtitle: { fontSize: 14, opacity: 0.7, textAlign: 'center' },
  planList: { maxHeight: 300 },
  planItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    marginBottom: 8,
  },
  planName: { flex: 1, fontSize: 15, fontWeight: '600' },
  cancelBtn: {
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  cancelText: { fontSize: 15, fontWeight: '600' },
});
