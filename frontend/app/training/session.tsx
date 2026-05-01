import FontAwesome from '@expo/vector-icons/FontAwesome';
import { type Href, useRouter } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useTrainingStore } from '@/src/stores/trainingStore';
import {
  speakText,
  stopSpeaking,
  startRecording,
  stopRecordingAndRecognize,
  startBgMusic,
  stopBgMusic,
  pauseBgMusic,
  resumeBgMusic,
} from '@/src/services/voiceService';
import { api } from '@/src/api/client';
import * as offlineService from '@/src/services/offlineService';

const AI_CHAT_URL = '/ai/chat';

type Phase = 'exercising' | 'resting' | 'finished';

export default function TrainingSessionScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];

  const sessionId = useTrainingStore((s) => s.sessionId);
  const planDayTitle = useTrainingStore((s) => s.planDayTitle);
  const actions = useTrainingStore((s) => s.actions);
  const currentActionIndex = useTrainingStore((s) => s.currentActionIndex);
  const currentSet = useTrainingStore((s) => s.currentSet);
  const safetyNotice = useTrainingStore((s) => s.safetyNotice);
  const advanceSet = useTrainingStore((s) => s.advanceSet);
  const skipCurrentAction = useTrainingStore((s) => s.skipCurrentAction);
  const finishTraining = useTrainingStore((s) => s.finishTraining);
  const isWorkoutFlowDone = useTrainingStore((s) => s.isWorkoutFlowDone);

  const [phase, setPhase] = useState<Phase>('exercising');
  const [countdown, setCountdown] = useState(0);
  const [paused, setPaused] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [aiMessage, setAiMessage] = useState<string | null>(null);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [busy, setBusy] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

  const pausedRef = useRef(false);
  const prevActionIndexRef = useRef(-1);

  const current = actions[currentActionIndex] ?? null;
  const player = useVideoPlayer(null, (p) => { p.loop = true; p.muted = true; });

  // 检查网络状态
  useEffect(() => {
    void offlineService.isOnline().then(setIsOnline);
  }, []);

  // 获取视频URL（优先使用本地缓存）
  const getVideoUrl = useCallback(async (action: typeof current): Promise<string | null> => {
    if (!action?.video_url) return null;

    // 检查是否有本地缓存
    const isDownloaded = await offlineService.isVideoDownloaded(action.action_id);
    if (isDownloaded) {
      return offlineService.getVideoLocalPath(action.action_id);
    }

    // 如果在线，使用远程URL
    if (isOnline) {
      return action.video_url;
    }

    // 离线且无缓存
    return null;
  }, [isOnline]);

  // 倒计时主循环
  useEffect(() => {
    if (paused || phase === 'finished') return;
    if (countdown <= 0) return;

    const id = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) { clearInterval(id); return 0; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [paused, phase, countdown]);

  // 倒计时归零时自动推进
  useEffect(() => {
    if (countdown !== 0 || phase === 'finished') return;
    if (!current) return;

    if (phase === 'exercising') {
      // 这组结束 → 提交 → 判断是否进入休息或下一动作
      void (async () => {
        setBusy(true);
        try {
          const prevIdx = currentActionIndex;
          const prevSet = currentSet;
          await advanceSet();
          const s = useTrainingStore.getState();

          if (s.isWorkoutFlowDone()) {
            setPhase('finished');
            if (voiceEnabled) speakText('训练完成，干得漂亮！').catch(() => {});
            return;
          }

          if (s.currentActionIndex === prevIdx) {
            // 同一动作下一组 → 休息
            setPhase('resting');
            setCountdown(current.rest_seconds);
            if (voiceEnabled) speakText(`这组完成，休息${current.rest_seconds}秒`).catch(() => {});
            player.pause();
          } else {
            // 下一动作，由 currentActionIndex 变化触发上面的 useEffect
          }
        } finally {
          setBusy(false);
        }
      })();
    } else if (phase === 'resting') {
      // 休息结束 → 开始下一组
      setPhase('exercising');
      setCountdown(current.set_duration_seconds);
      if (voiceEnabled) speakText('休息结束，开始下一组').catch(() => {});
      if (current.video_url && !pausedRef.current) player.play();
    }
  }, [countdown, phase]);

  // 暂停/恢复控制
  useEffect(() => {
    if (paused) {
      player.pause();
      pauseBgMusic().catch(() => {});
      stopSpeaking();
    } else {
      if (phase === 'exercising' && current?.video_url) player.play();
      resumeBgMusic().catch(() => {});
    }
  }, [paused]);

  // 训练完成后自动跳转
  useEffect(() => {
    if (phase !== 'finished') return;
    const id = setTimeout(async () => {
      setBusy(true);
      try {
        await finishTraining();
        router.replace('/training/report' as Href);
      } finally { setBusy(false); }
    }, 3000);
    return () => clearTimeout(id);
  }, [phase]);

  const onSkip = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    stopSpeaking();
    try { await skipCurrentAction(); }
    finally { setBusy(false); }
  }, [busy, skipCurrentAction]);

  const onMicPressIn = useCallback(async () => {
    if (!isOnline) {
      Alert.alert('离线模式', 'AI语音功能需要联网使用');
      return;
    }
    setAiMessage(null);
    setIsRecording(true);
    stopSpeaking();
    try { await startRecording(); }
    catch (e: any) { setIsRecording(false); Alert.alert('录音失败', e?.message ?? '请检查麦克风权限'); }
  }, [voiceEnabled]);

  const onMicPressOut = useCallback(async () => {
    if (!isRecording) return;
    setIsRecording(false);
    try {
      const text = await stopRecordingAndRecognize();
      if (!text || !current) return;
      const res = await api.post<{ code: number; data: { reply: string } }>(AI_CHAT_URL, {
        messages: [{ role: 'user', content: text }],
        context: { action_name: current.name, current_set: currentSet, total_sets: current.planned_sets, phase: current.phase },
      });
      const reply = res.data?.data?.reply ?? '';
      if (reply) { setAiMessage(reply); await speakText(reply); }
    } catch { /* 静默 */ }
  }, [isRecording, current, currentSet]);



  // 背景音乐
  useEffect(() => {
    startBgMusic('https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3').catch(() => {});
    return () => { stopBgMusic().catch(() => {}); };
  }, []);

  // 检查网络
  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const res = await fetch(`${api.defaults.baseURL?.replace('/api/v1', '')}/health`);
        if (!cancelled) setVoiceEnabled(res.ok);
      } catch { if (!cancelled) setVoiceEnabled(false); }
    };
    check();
    const id = setInterval(check, 15000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  // 动作切换时换视频源 + TTS 播报
  useEffect(() => {
    if (!current) return;
    if (currentActionIndex === prevActionIndexRef.current) return;
    prevActionIndexRef.current = currentActionIndex;

    void (async () => {
      const videoUrl = await getVideoUrl(current);
      if (videoUrl) {
        player.replace({ uri: videoUrl });
      }

      setPhase('exercising');
      setCountdown(current.set_duration_seconds);
      setAiMessage(null);

      if (voiceEnabled && isOnline) {
        player.pause();
        const tip = current.tips
          ? `第${currentActionIndex + 1}个动作：${current.name}，${current.tips}`
          : `第${currentActionIndex + 1}个动作：${current.name}，注意保持正确姿势`;
        speakText(tip)
          .then(() => { if (videoUrl && !pausedRef.current) player.play(); })
          .catch(() => { if (videoUrl && !pausedRef.current) player.play(); });
      } else {
        if (videoUrl) player.play();
      }
    })();
  }, [currentActionIndex, current, isOnline, voiceEnabled, getVideoUrl]);

  if (!sessionId || actions.length === 0) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <Text style={{ color: theme.text }}>请先完成训练前确认</Text>
        <Pressable style={[styles.btn, { backgroundColor: theme.tint }]} onPress={() => router.replace('/training/pre-check' as Href)}>
          <Text style={styles.btnText}>去确认</Text>
        </Pressable>
      </View>
    );
  }

  if (phase === 'finished') {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <Text style={[styles.doneTitle, { color: theme.text }]}>训练完成！</Text>
        <Text style={[styles.doneSub, { color: theme.text }]}>正在生成报告…</Text>
        {busy ? <ActivityIndicator color={theme.tint} style={{ marginTop: 16 }} /> : null}
      </View>
    );
  }

  if (!current) {
    return <View style={[styles.center, { backgroundColor: theme.background }]}><ActivityIndicator color={theme.tint} /></View>;
  }

  const totalActions = actions.length;
  const progress = totalActions > 0 ? (currentActionIndex + (currentSet - 1) / current.planned_sets) / totalActions : 0;

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <View style={styles.top}>
        <Text style={[styles.dayTitle, { color: theme.text }]} numberOfLines={1}>{planDayTitle}</Text>
        <Text style={[styles.sub, { color: theme.text }]}>
          第 {currentActionIndex + 1} / {totalActions} 个动作 · 第 {currentSet} / {current.planned_sets} 组
        </Text>
        <View style={[styles.barBg, { backgroundColor: `${theme.tint}22` }]}>
          <View style={[styles.barFill, { width: `${progress * 100}%`, backgroundColor: theme.tint }]} />
        </View>
        {safetyNotice ? <Text style={styles.safety}>{safetyNotice}</Text> : null}
      </View>

      <View style={styles.videoWrap}>
        {current.video_url ? (
          <VideoView player={player} style={styles.video} contentFit="contain" nativeControls={false} />
        ) : (
          <View style={styles.videoPlaceholder}>
            <FontAwesome name="film" size={48} color="#aaa" />
            <Text style={styles.videoPlaceholderText}>暂无视频</Text>
          </View>
        )}
        <View style={styles.countdownOverlay}>
          <Text style={styles.countdownText}>{countdown}</Text>
          <Text style={styles.countdownLabel}>{phase === 'resting' ? '休息' : '秒'}</Text>
        </View>
      </View>

      <View style={styles.info}>
        <Text style={[styles.actionName, { color: theme.text }]}>{current.name}</Text>
        <Text style={[styles.setInfo, { color: theme.tint }]}>
          {phase === 'resting' ? '组间休息中…' : `每组 ${current.planned_reps} 次 · ${current.set_duration_seconds} 秒`}
        </Text>
        {current.tips ? <Text style={[styles.tips, { color: theme.text }]}>{current.tips}</Text> : null}
        {aiMessage ? (
          <View style={styles.aiBubble}>
            <Text style={styles.aiText}>{aiMessage}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.bottom}>
        <View style={styles.row}>
          <Pressable style={[styles.iconBtn, { borderColor: theme.tint }]} onPress={() => setPaused((p) => !p)}>
            <FontAwesome name={paused ? 'play' : 'pause'} size={22} color={theme.tint} />
          </Pressable>
          {voiceEnabled ? (
            <Pressable
              style={[styles.iconBtn, { borderColor: isRecording ? '#e53935' : '#888', backgroundColor: isRecording ? '#fdecea' : 'transparent' }]}
              onPressIn={() => void onMicPressIn()}
              onPressOut={() => void onMicPressOut()}
            >
              <FontAwesome name="microphone" size={22} color={isRecording ? '#e53935' : '#888'} />
            </Pressable>
          ) : null}
          <Pressable
            style={[styles.btn, { backgroundColor: '#888', flex: 1, opacity: busy ? 0.5 : 1 }]}
            onPress={() => void onSkip()}
            disabled={busy}
          >
            <Text style={styles.btnText}>跳过此动作</Text>
          </Pressable>
        </View>
        {isRecording ? <Text style={styles.recordingHint}>松手发送</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, padding: 24 },
  top: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 6 },
  dayTitle: { fontSize: 18, fontWeight: '800' },
  sub: { fontSize: 13, opacity: 0.85, marginTop: 4 },
  barBg: { height: 8, borderRadius: 999, overflow: 'hidden', marginTop: 10 },
  barFill: { height: 8, borderRadius: 999 },
  safety: { fontSize: 12, color: '#b8860b', marginTop: 8 },
  videoWrap: { position: 'relative', width: '100%', aspectRatio: 16 / 9 },
  video: { width: '100%', height: '100%', backgroundColor: '#000' },
  videoPlaceholder: { width: '100%', height: '100%', backgroundColor: '#111', alignItems: 'center', justifyContent: 'center', gap: 8 },
  videoPlaceholderText: { color: '#aaa' },
  countdownOverlay: { position: 'absolute', bottom: 8, right: 12, alignItems: 'center' },
  countdownText: { fontSize: 48, fontWeight: '900', color: '#fff', textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 4 },
  countdownLabel: { fontSize: 14, color: '#fff', textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 4 },
  info: { flex: 1, paddingHorizontal: 16, paddingTop: 10 },
  actionName: { fontSize: 20, fontWeight: '800' },
  setInfo: { fontSize: 15, fontWeight: '700', marginTop: 4 },
  tips: { fontSize: 14, lineHeight: 20, opacity: 0.9, marginTop: 6 },
  aiBubble: { marginTop: 10, backgroundColor: 'rgba(47,149,220,0.1)', borderRadius: 10, padding: 10 },
  aiText: { fontSize: 14, color: '#2f95dc', lineHeight: 20 },
  bottom: { padding: 16, paddingBottom: 28 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconBtn: { width: 48, height: 48, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  btn: { paddingVertical: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center', minHeight: 48 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  doneTitle: { fontSize: 24, fontWeight: '900' },
  doneSub: { fontSize: 15, opacity: 0.8, marginTop: 8 },
  recordingHint: { textAlign: 'center', color: '#e53935', fontSize: 13, marginTop: 8 },
});
