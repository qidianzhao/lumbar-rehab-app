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
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import AiAssistantModal from '@/components/AiAssistantModal';
import * as planApi from '@/src/services/planApi';
import { handleError } from '@/src/utils/errorHandler';

const API = process.env.EXPO_PUBLIC_API_BASE ?? 'http://localhost:8000/api/v1';

const STATUS_LABEL: Record<string, string> = {
  draft: '草稿',
  active: '进行中',
  archived: '已归档',
};

const BODY_PARTS = [
  { key: 'neck', label: '颈部', icon: 'user' },
  { key: 'shoulder', label: '肩部', icon: 'hand-rock-o' },
  { key: 'back', label: '背部', icon: 'square' },
  { key: 'waist', label: '腰部', icon: 'circle-o' },
  { key: 'hip', label: '臀部', icon: 'circle' },
  { key: 'leg', label: '腿部', icon: 'long-arrow-down' },
] as const;

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

export default function ProgramScreen() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'plans' | 'actions'>('plans');
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<planApi.TrainingPlan[]>([]);
  const [actions, setActions] = useState<Action[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editingPlanId, setEditingPlanId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState('');
  const [showAiAssistant, setShowAiAssistant] = useState(false);
  const [selectedPart, setSelectedPart] = useState<string>('neck');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedAction, setSelectedAction] = useState<Action | null>(null);
  const [addingToPlan, setAddingToPlan] = useState(false);

  const load = useCallback(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const [plansData, actionsRes] = await Promise.all([
          planApi.getMyPlans(),
          fetch(`${API}/actions`),
        ]);
        const actionsData = await actionsRes.json();
        if (!cancelled) {
          setPlans(plansData);
          setActions(actionsData);
        }
      } catch (e) {
        if (!cancelled) {
          const errorInfo = handleError(e, '加载数据');
          setError(errorInfo.message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useFocusEffect(load);

  const handleStartEdit = (plan: planApi.TrainingPlan) => {
    setEditingPlanId(plan.id);
    setEditingName(plan.name);
  };

  const handleSaveName = async (planId: number) => {
    if (!editingName.trim()) {
      Alert.alert('提示', '方案名称不能为空');
      return;
    }

    try {
      await planApi.updatePlan(planId, { name: editingName.trim() });
      setPlans((prev) =>
        prev.map((p) => (p.id === planId ? { ...p, name: editingName.trim() } : p))
      );
      setEditingPlanId(null);
    } catch (e) {
      const errorInfo = handleError(e, '更新方案名称');
      Alert.alert('错误', errorInfo.message);
    }
  };

  const handleCancelEdit = () => {
    setEditingPlanId(null);
    setEditingName('');
  };

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

  const filteredActions = actions.filter((a) => a.body_part === selectedPart);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top']}>
      <View style={styles.container}>
        <Text style={[styles.title, { color: theme.text }]}>训练方案</Text>

        {/* 顶部Tab */}
        <View style={styles.topTabs}>
          <Pressable
            style={[
              styles.topTab,
              activeTab === 'plans' && [styles.topTabActive, { borderBottomColor: theme.tint }],
            ]}
            onPress={() => setActiveTab('plans')}
          >
            <Text
              style={[
                styles.topTabText,
                { color: activeTab === 'plans' ? theme.tint : theme.text },
                activeTab !== 'plans' && { opacity: 0.6 },
              ]}
            >
              我的方案
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.topTab,
              activeTab === 'actions' && [styles.topTabActive, { borderBottomColor: theme.tint }],
            ]}
            onPress={() => setActiveTab('actions')}
          >
            <Text
              style={[
                styles.topTabText,
                { color: activeTab === 'actions' ? theme.tint : theme.text },
                activeTab !== 'actions' && { opacity: 0.6 },
              ]}
            >
              动作库
            </Text>
          </Pressable>
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

        {/* 我的方案内容 */}
        {!loading && !error && activeTab === 'plans' && (
          <ScrollView contentContainerStyle={styles.scroll}>
            {plans.length === 0 ? (
              <View style={[styles.emptyCard, { borderColor: theme.tabIconDefault }]}>
                <FontAwesome name="calendar-o" size={48} color={theme.tabIconDefault} />
                <Text style={[styles.emptyTitle, { color: theme.text }]}>还没有训练方案</Text>
                <Text style={[styles.emptySub, { color: theme.text }]}>
                  点击右下角AI助手，让AI为你定制专属训练方案
                </Text>
              </View>
            ) : (
              <View style={styles.planList}>
                {plans.map((plan) => (
                  <View key={plan.id} style={[styles.planCard, { borderColor: theme.tabIconDefault }]}>
                    <View style={styles.planHeader}>
                      {editingPlanId === plan.id ? (
                        <View style={styles.editingRow}>
                          <TextInput
                            style={[
                              styles.nameInput,
                              { color: theme.text, borderColor: theme.tint },
                            ]}
                            value={editingName}
                            onChangeText={setEditingName}
                            autoFocus
                            maxLength={50}
                          />
                          <Pressable
                            style={[styles.saveBtn, { backgroundColor: theme.tint }]}
                            onPress={() => handleSaveName(plan.id)}
                          >
                            <FontAwesome name="check" size={14} color="#fff" />
                          </Pressable>
                          <Pressable
                            style={[styles.cancelBtn, { borderColor: theme.tabIconDefault }]}
                            onPress={handleCancelEdit}
                          >
                            <FontAwesome name="times" size={14} color={theme.text} />
                          </Pressable>
                        </View>
                      ) : (
                        <Pressable
                          style={styles.planTitleRow}
                          onPress={() => handleStartEdit(plan)}
                        >
                          <FontAwesome name="file-text-o" size={18} color={theme.tint} />
                          <Text style={[styles.planName, { color: theme.text }]}>{plan.name}</Text>
                          <FontAwesome name="pencil" size={14} color={theme.tabIconDefault} />
                        </Pressable>
                      )}
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
                        onPress={async () => {
                          try {
                            const planDetail = await planApi.getPlanById(plan.id);
                            if (!planDetail.days || planDetail.days.length === 0) {
                              Alert.alert('提示', '请先添加动作到方案');
                              return;
                            }
                            router.push(`/training/session?planId=${plan.id}&dayId=${planDetail.days[0].id}` as Href);
                          } catch (e) {
                            Alert.alert('错误', '无法开始训练');
                          }
                        }}
                      >
                        <FontAwesome name="play" size={14} color="#fff" />
                        <Text style={styles.actionBtnText}>开始</Text>
                      </Pressable>

                      <Pressable
                        style={[styles.actionBtn, styles.actionBtnOutline, { borderColor: theme.tint }]}
                        onPress={async () => {
                          try {
                            const planDetail = await planApi.getPlanById(plan.id);
                            if (!planDetail.days || planDetail.days.length === 0) {
                              const res = await fetch(`${API}/plans/${plan.id}/days`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  week_number: 1,
                                  day_number: 1,
                                  day_type: 'training',
                                  title: '训练日',
                                }),
                              });
                              const result = await res.json();
                              if (result.code === 0 && result.data) {
                                router.push(`/plan/${plan.id}/edit-day/${result.data.id}` as Href);
                              } else {
                                Alert.alert('错误', '创建训练日失败');
                              }
                            } else {
                              router.push(`/plan/${plan.id}/edit-day/${planDetail.days[0].id}` as Href);
                            }
                          } catch (e) {
                            Alert.alert('错误', '无法打开编辑页面');
                          }
                        }}
                      >
                        <FontAwesome name="edit" size={14} color={theme.tint} />
                        <Text style={[styles.actionBtnTextOutline, { color: theme.tint }]}>编辑</Text>
                      </Pressable>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>
        )}

        {/* 动作库内容 */}
        {!loading && !error && activeTab === 'actions' && (
          <View style={styles.actionsContent}>
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

      {/* AI助手浮窗按钮 - 只在我的方案Tab显示 */}
      {activeTab === 'plans' && (
        <Pressable
          style={[styles.aiFab, { backgroundColor: theme.tint }]}
          onPress={() => setShowAiAssistant(true)}
        >
          <FontAwesome name="comments" size={24} color="#fff" />
        </Pressable>
      )}

      {/* AI助手弹窗 */}
      <AiAssistantModal
        visible={showAiAssistant}
        onClose={() => setShowAiAssistant(false)}
        title="AI助手"
      />

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

            <ScrollView style={styles.planListModal}>
              {plans.map((plan) => (
                <Pressable
                  key={plan.id}
                  style={[styles.planItem, { borderColor: theme.tabIconDefault }]}
                  onPress={() => handleConfirmAdd(plan.id)}
                  disabled={addingToPlan}
                >
                  <FontAwesome name="file-text-o" size={16} color={theme.tint} />
                  <Text style={[styles.planNameModal, { color: theme.text }]}>{plan.name}</Text>
                  <FontAwesome name="chevron-right" size={14} color={theme.tabIconDefault} />
                </Pressable>
              ))}
            </ScrollView>

            <Pressable
              style={[styles.cancelBtnModal, { borderColor: theme.tabIconDefault }]}
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
  topTabs: {
    flexDirection: 'row',
    marginBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
  },
  topTab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  topTabActive: {
    borderBottomWidth: 2,
  },
  topTabText: {
    fontSize: 16,
    fontWeight: '600',
  },
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
  scroll: { paddingBottom: 100 },
  emptyCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: 32,
    alignItems: 'center',
    gap: 12,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', marginTop: 12 },
  emptySub: { fontSize: 14, textAlign: 'center', opacity: 0.6, lineHeight: 20 },
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
  editingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  nameInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  saveBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
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
  actionsContent: { flex: 1, flexDirection: 'row', gap: 12 },
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
  aiFab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
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
  planListModal: { maxHeight: 300 },
  planItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    marginBottom: 8,
  },
  planNameModal: { flex: 1, fontSize: 15, fontWeight: '600' },
  cancelBtnModal: {
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  cancelText: { fontSize: 15, fontWeight: '600' },
});
