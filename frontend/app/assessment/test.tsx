import FontAwesome from '@expo/vector-icons/FontAwesome';
import { type Href, useRouter } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Modal,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import type { AssessmentTestItem, MetricType, TestItemSubmit } from '@/src/services/assessmentApi';
import * as assessmentApi from '@/src/services/assessmentApi';
import { logger } from '@/src/utils/logger';
import { useAIVoiceChat } from '@/src/hooks/useAIVoiceChat';
import {
  speakText,
  startBgMusic,
  stopBgMusic,
} from '@/src/services/voiceService';
import { handleError } from '@/src/utils/errorHandler';

const ASSESSMENT_PROGRESS_KEY = '@assessment_progress';

// ── 视频占位组件 ──────────────────────────────────────────────────────────────

function ActionVideo({ player, videoUrl }: { player: ReturnType<typeof useVideoPlayer>; videoUrl?: string | null }) {
  if (!videoUrl) {
    return (
      <View style={styles.videoPlaceholder}>
        <FontAwesome name="play-circle-o" size={40} color="#aaa" />
        <Text style={styles.videoPlaceholderText}>暂无示范视频</Text>
      </View>
    );
  }
  return <VideoView player={player} style={styles.video} contentFit="contain" nativeControls={false} />;
}

// ── 秒表（平板支撑等计时类） ──────────────────────────────────────────────────

function Stopwatch({ onCommit }: { onCommit: (seconds: number) => void }) {
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
      // 开始计时时启动背景音乐
      startBgMusic('https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3').catch(() => {});
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
      // 停止计时时停止背景音乐
      if (elapsed > 0) {
        stopBgMusic().catch(() => {});
      }
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running, elapsed]);

  const toggle = () => {
    if (running) {
      setRunning(false);
      onCommit(elapsed);
    } else {
      setElapsed(0);
      setRunning(true);
    }
  };

  const reset = () => { setRunning(false); setElapsed(0); };

  return (
    <View style={styles.stopwatch}>
      <Text style={styles.stopwatchTime}>{elapsed} 秒</Text>
      <View style={styles.stopwatchRow}>
        <Pressable style={[styles.swBtn, { backgroundColor: running ? '#e53935' : '#2f95dc' }]} onPress={toggle}>
          <Text style={styles.swBtnText}>{running ? '停止并记录' : elapsed > 0 ? '重新开始' : '开始计时'}</Text>
        </Pressable>
        {elapsed > 0 && !running && (
          <Pressable style={[styles.swBtn, { backgroundColor: '#888' }]} onPress={reset}>
            <Text style={styles.swBtnText}>重置</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

// ── 计数器（臀桥、鸟狗式等计次类） ──────────────────────────────────────────

function Counter({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <View style={styles.counter}>
      <Pressable style={styles.counterBtn} onPress={() => onChange(Math.max(0, value - 1))}>
        <FontAwesome name="minus" size={20} color="#fff" />
      </Pressable>
      <Text style={styles.counterValue}>{value} 次</Text>
      <Pressable style={[styles.counterBtn, { backgroundColor: '#2f95dc' }]} onPress={() => onChange(value + 1)}>
        <FontAwesome name="plus" size={20} color="#fff" />
      </Pressable>
    </View>
  );
}

// ── 主页面 ────────────────────────────────────────────────────────────────────

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
  const [videoUrls, setVideoUrls] = useState<Record<number, string | null>>({});
  const [error, setError] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [values, setValues] = useState<Record<number, number>>({});
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [showTextInput, setShowTextInput] = useState(false);
  const [textInput, setTextInput] = useState('');

  const current = items[index];
  const currentVideoUrl = current ? (videoUrls[current.action_id] ?? null) : null;
  const player = useVideoPlayer(null, (p) => { p.loop = true; p.muted = true; });

  // 使用统一的AI语音交互Hook
  const { isRecording, aiMessage, isProcessing, onMicPressIn, onMicPressOut, sendTextToAI } = useAIVoiceChat({
    context: {
      action_name: current?.name,
      phase: 'assessment',
    },
    isOnline: true, // 体能测试页面假设在线
  });

  // 数据加载 + 恢复进度
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const list = await assessmentApi.getTestItems();
        if (cancelled) return;
        setItems(list);
        const urls: Record<number, string | null> = {};
        await Promise.all(list.map(async (it) => {
          try {
            const res = await api.get<any>(`/actions/${it.action_id}`);
            urls[it.action_id] = res.data?.video_url ?? null;
          } catch { urls[it.action_id] = null; }
        }));
        if (!cancelled) setVideoUrls(urls);

        // 恢复保存的进度
        try {
          const saved = await AsyncStorage.getItem(ASSESSMENT_PROGRESS_KEY);
          if (saved && !cancelled) {
            const progress = JSON.parse(saved);
            setIndex(progress.index ?? 0);
            setValues(progress.values ?? {});
            setNotes(progress.notes ?? {});
          }
        } catch (e) {
          logger.error('恢复进度失败:', e);
        }
      } catch (e) {
        if (!cancelled) {
          const errorInfo = handleError(e, '加载测试项目');
          setError(errorInfo.message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // 页面卸载时停止背景音乐
  useEffect(() => {
    return () => { stopBgMusic().catch(() => {}); };
  }, []);

  // 视频源变化时换源
  useEffect(() => {
    if (currentVideoUrl) player.replace({ uri: currentVideoUrl });
  }, [currentVideoUrl]);

  // 动作切换时 TTS 播报，播完后播放视频
  useEffect(() => {
    if (!current) return;
    player.pause();
    speakText(`第${index + 1}个动作：${current.name}，${current.prompt}`)
      .then(() => { if (currentVideoUrl) player.play(); })
      .catch(() => { if (currentVideoUrl) player.play(); });
  }, [index, current]);

  const progress = items.length ? (index + 1) / items.length : 0;
  const currentValue = current ? values[current.action_id] : undefined;
  const canNext = current ? typeof currentValue === 'number' && Number.isFinite(currentValue) && currentValue > 0 : false;
  const ratingOptions = useMemo(() => [1, 2, 3, 4, 5], []);

  // 保存进度到本地存储
  useEffect(() => {
    if (items.length === 0) return;
    const saveProgress = async () => {
      try {
        await AsyncStorage.setItem(ASSESSMENT_PROGRESS_KEY, JSON.stringify({
          index,
          values,
          notes,
          timestamp: new Date().toISOString(),
        }));
      } catch (e) {
        logger.error('保存进度失败:', e);
      }
    };
    void saveProgress();
  }, [index, values, notes, items.length]);

  function setCurrentValue(v: number) {
    if (!current) return;
    setValues((prev) => ({ ...prev, [current.action_id]: v }));
  }

  function setCurrentNotes(v: string) {
    if (!current) return;
    setNotes((prev) => ({ ...prev, [current.action_id]: v }));
  }

  const handleTextSubmit = useCallback(async () => {
    if (!textInput.trim() || isProcessing) return;

    const text = textInput.trim();
    setTextInput('');
    setShowTextInput(false);

    await sendTextToAI(text);
  }, [textInput, isProcessing, sendTextToAI]);

  async function onSubmitAll() {
    if (items.length === 0) return;
    const payload: TestItemSubmit[] = items.map((it) => ({
      action_id: it.action_id,
      metric_value: values[it.action_id] ?? 0,
      user_notes: notes[it.action_id] || null,
    }));
    setSubmitting(true);
    setError(null);
    try {
      const report = await assessmentApi.submitAssessment({ items: payload });
      // 提交成功后清除保存的进度
      await AsyncStorage.removeItem(ASSESSMENT_PROGRESS_KEY);
      router.replace((`/assessment/result?id=${report.id}`) as unknown as Href);
    } catch (e) {
      const errorInfo = handleError(e, '提交测试结果');
      setError(errorInfo.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <View style={[styles.center, { backgroundColor: theme.background }]}><ActivityIndicator size="large" color={theme.tint} /></View>;
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

  if (!current) return <View style={[styles.center, { backgroundColor: theme.background }]}><Text style={{ color: theme.text }}>无测试项目</Text></View>;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.background }} contentContainerStyle={styles.content}>
      {/* 进度条 */}
      <View style={styles.progressWrap}>
        <View style={[styles.progressBarBg, { backgroundColor: `${theme.tint}22` }]}>
          <View style={[styles.progressBarFill, { backgroundColor: theme.tint, width: `${progress * 100}%` }]} />
        </View>
        <Text style={[styles.progressText, { color: theme.text }]}>{index + 1} / {items.length}</Text>
      </View>

      <View style={[styles.card, { borderColor: theme.tabIconDefault }]}>
        {/* 视频 */}
        <ActionVideo player={player} videoUrl={videoUrls[current.action_id]} />

        {/* 动作名 + 提示 */}
        <Text style={[styles.name, { color: theme.text }]}>{current.name}</Text>
        <Text style={[styles.prompt, { color: theme.text }]}>{current.prompt}</Text>

        {/* 输入区 */}
        {current.metric_type === 'seconds' ? (
          <Stopwatch onCommit={setCurrentValue} />
        ) : current.metric_type === 'reps' ? (
          <Counter value={currentValue ?? 0} onChange={setCurrentValue} />
        ) : (
          // rating_1_5
          <View style={styles.chips}>
            {ratingOptions.map((n) => {
              const active = currentValue === n;
              return (
                <Pressable
                  key={n}
                  onPress={() => setCurrentValue(n)}
                  style={[styles.chip, { borderColor: active ? theme.tint : theme.tabIconDefault, backgroundColor: active ? `${theme.tint}22` : 'transparent' }]}
                >
                  <Text style={{ color: active ? theme.tint : theme.text, fontWeight: '700' }}>{n}</Text>
                </Pressable>
              );
            })}
          </View>
        )}

        {/* 备注 */}
        <TextInput
          value={notes[current.action_id] ?? ''}
          onChangeText={setCurrentNotes}
          placeholder="备注（可选）"
          placeholderTextColor="#999"
          style={[styles.notes, { borderColor: theme.tabIconDefault, color: theme.text }]}
        />
      </View>

      {error ? <Text style={styles.err}>{error}</Text> : null}

      {aiMessage ? (
        <View style={styles.aiBubble}>
          <Text style={styles.aiText}>{aiMessage}</Text>
        </View>
      ) : null}

      {/* 导航行 */}
      <View style={styles.navRow}>
        <Pressable
          style={[styles.iconBtn, { borderColor: theme.tabIconDefault }]}
          onPressIn={() => void onMicPressIn()}
          onPressOut={() => void onMicPressOut()}
        >
          <FontAwesome name="microphone" size={20} color={isRecording ? '#e53935' : theme.tabIconDefault} />
        </Pressable>

        <Pressable
          style={[styles.iconBtn, { borderColor: theme.tabIconDefault }]}
          onPress={() => setShowTextInput(true)}
        >
          <FontAwesome name="keyboard-o" size={20} color={theme.tabIconDefault} />
        </Pressable>

        <Pressable
          style={[styles.btnOutline, { borderColor: theme.tint, opacity: index === 0 ? 0.4 : 1 }]}
          onPress={() => setIndex((i) => Math.max(0, i - 1))}
          disabled={index === 0}
        >
          <Text style={[styles.btnOutlineText, { color: theme.tint }]}>上一个</Text>
        </Pressable>

        {index < items.length - 1 ? (
          <Pressable
            style={[styles.btn, { backgroundColor: theme.tint, opacity: canNext ? 1 : 0.5 }]}
            onPress={() => setIndex((i) => Math.min(items.length - 1, i + 1))}
            disabled={!canNext}
          >
            <Text style={styles.btnText}>下一个</Text>
          </Pressable>
        ) : (
          <Pressable
            style={[styles.btn, { backgroundColor: theme.tint, opacity: canNext && !submitting ? 1 : 0.5 }]}
            onPress={onSubmitAll}
            disabled={!canNext || submitting}
          >
            {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>提交评估</Text>}
          </Pressable>
        )}
      </View>

      <Modal
        visible={showTextInput}
        transparent
        animationType="fade"
        onRequestClose={() => setShowTextInput(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowTextInput(false)}>
          <Pressable style={[styles.modalContent, { backgroundColor: theme.background }]} onPress={(e) => e.stopPropagation()}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>向AI助手提问</Text>
            <TextInput
              style={[styles.textInputField, { borderColor: theme.tabIconDefault, color: theme.text }]}
              value={textInput}
              onChangeText={setTextInput}
              placeholder="输入你的问题..."
              placeholderTextColor="#999"
              multiline
              autoFocus
              onSubmitEditing={handleTextSubmit}
            />
            <View style={styles.modalActions}>
              <Pressable
                style={[styles.modalBtn, styles.modalBtnCancel, { borderColor: theme.tabIconDefault }]}
                onPress={() => { setShowTextInput(false); setTextInput(''); }}
              >
                <Text style={[styles.modalBtnText, { color: theme.text }]}>取消</Text>
              </Pressable>
              <Pressable
                style={[styles.modalBtn, styles.modalBtnSubmit, { backgroundColor: theme.tint, opacity: (!textInput.trim() || isProcessing) ? 0.5 : 1 }]}
                onPress={handleTextSubmit}
                disabled={!textInput.trim() || isProcessing}
              >
                {isProcessing ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={[styles.modalBtnText, { color: '#fff' }]}>发送</Text>
                )}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
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
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: 14, marginBottom: 12 },
  video: { width: '100%', aspectRatio: 16 / 9, backgroundColor: '#000', borderRadius: 10, marginBottom: 12 },
  videoPlaceholder: { width: '100%', aspectRatio: 16 / 9, backgroundColor: '#111', borderRadius: 10, alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 12 },
  videoPlaceholderText: { color: '#aaa', fontSize: 13 },
  name: { fontSize: 18, fontWeight: '800', marginBottom: 6 },
  prompt: { fontSize: 14, opacity: 0.85, marginBottom: 14, lineHeight: 20 },
  stopwatch: { alignItems: 'center', gap: 10, marginBottom: 14 },
  stopwatchTime: { fontSize: 48, fontWeight: '900', color: '#2f95dc' },
  stopwatchRow: { flexDirection: 'row', gap: 10 },
  swBtn: { paddingVertical: 12, paddingHorizontal: 20, borderRadius: 10 },
  swBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  counter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 20, marginBottom: 14 },
  counterBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#888', alignItems: 'center', justifyContent: 'center' },
  counterValue: { fontSize: 32, fontWeight: '900', color: '#2f95dc', minWidth: 100, textAlign: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 },
  chip: { borderWidth: 1, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14, minWidth: 48, alignItems: 'center' },
  notes: { borderWidth: 1, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12, fontSize: 14, marginTop: 4 },
  navRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  iconBtn: { width: 48, height: 48, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  btn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center', minHeight: 48 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  btnOutline: { flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 1, alignItems: 'center' },
  btnOutlineText: { fontSize: 16, fontWeight: '800' },
  err: { color: '#c62828', marginTop: 8, textAlign: 'center' },
  aiBubble: { backgroundColor: 'rgba(47,149,220,0.1)', borderRadius: 10, padding: 10, marginBottom: 8 },
  aiText: { fontSize: 14, color: '#2f95dc', lineHeight: 20 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalContent: { width: '100%', maxWidth: 400, borderRadius: 16, padding: 20, gap: 16 },
  modalTitle: { fontSize: 18, fontWeight: '700', textAlign: 'center' },
  textInputField: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 15, minHeight: 100, textAlignVertical: 'top' },
  modalActions: { flexDirection: 'row', gap: 12 },
  modalBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  modalBtnCancel: { borderWidth: 1 },
  modalBtnSubmit: {},
  modalBtnText: { fontSize: 15, fontWeight: '600' },
});
