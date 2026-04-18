import FontAwesome from '@expo/vector-icons/FontAwesome';
import { type Href, useRouter } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import type { SessionStartAction } from '@/src/services/trainingApi';
import { useTrainingStore } from '@/src/stores/trainingStore';

function ActionVideo({
  action,
  paused,
}: {
  action: SessionStartAction;
  paused: boolean;
}) {
  const player = useVideoPlayer(action.video_url ?? null, (p) => {
    p.loop = true;
    p.muted = false;
  });

  useEffect(() => {
    if (paused) {
      player.pause();
    } else {
      player.play();
    }
  }, [paused, player]);

  if (!action.video_url) {
    return (
      <View style={styles.videoPlaceholder}>
        <FontAwesome name="film" size={48} color="#aaa" />
        <Text style={styles.videoPlaceholderText}>暂无视频</Text>
      </View>
    );
  }

  return <VideoView player={player} style={styles.video} contentFit="contain" nativeControls />;
}

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
  const completeCurrentSet = useTrainingStore((s) => s.completeCurrentSet);
  const skipCurrentAction = useTrainingStore((s) => s.skipCurrentAction);
  const finishTraining = useTrainingStore((s) => s.finishTraining);
  const isWorkoutFlowDone = useTrainingStore((s) => s.isWorkoutFlowDone);
  const [paused, setPaused] = useState(false);
  const [restRemaining, setRestRemaining] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const current = useMemo(() => {
    if (currentActionIndex < 0 || currentActionIndex >= actions.length) return null;
    return actions[currentActionIndex];
  }, [actions, currentActionIndex]);

  const totalProgress = useMemo(() => {
    if (actions.length === 0) return 0;
    let acc = 0;
    for (let i = 0; i < actions.length; i++) {
      const a = actions[i];
      if (i < currentActionIndex) {
        acc += 1;
      } else if (i === currentActionIndex) {
        acc += (currentSet - 1) / Math.max(1, a.planned_sets);
        break;
      }
    }
    return acc / actions.length;
  }, [actions, currentActionIndex, currentSet]);

  useEffect(() => {
    if (restRemaining === null || restRemaining <= 0) return;
    if (paused) return;
    const t = setInterval(() => {
      setRestRemaining((r) => {
        if (r === null || r <= 1) {
          return null;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [restRemaining, paused]);

  const onCompleteSet = useCallback(async () => {
    if (!current || restRemaining !== null || busy) return;
    setBusy(true);
    const prevIdx = useTrainingStore.getState().currentActionIndex;
    const prevSet = useTrainingStore.getState().currentSet;
    try {
      await completeCurrentSet();
      const s = useTrainingStore.getState();
      if (s.isWorkoutFlowDone()) {
        setRestRemaining(null);
        return;
      }
      if (s.currentActionIndex === prevIdx && s.currentSet > prevSet) {
        const act = s.actions[s.currentActionIndex];
        setRestRemaining(act.rest_seconds);
      } else {
        setRestRemaining(null);
      }
    } finally {
      setBusy(false);
    }
  }, [completeCurrentSet, current, restRemaining, busy]);

  const onSkip = useCallback(async () => {
    if (!current || busy) return;
    setBusy(true);
    setRestRemaining(null);
    try {
      await skipCurrentAction();
    } finally {
      setBusy(false);
    }
  }, [current, skipCurrentAction, busy]);

  const onFinish = useCallback(async () => {
    if (!sessionId || busy) return;
    setBusy(true);
    try {
      const report = await finishTraining();
      router.replace('/training/report' as Href);
    } finally {
      setBusy(false);
    }
  }, [sessionId, finishTraining, router, busy]);

  if (!sessionId || actions.length === 0) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <Text style={{ color: theme.text }}>请先完成训练前确认</Text>
        <Pressable style={[styles.primaryBtn, { backgroundColor: theme.tint }]} onPress={() => router.replace('/training/pre-check' as Href)}>
          <Text style={styles.primaryBtnText}>去确认</Text>
        </Pressable>
      </View>
    );
  }

  if (isWorkoutFlowDone()) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background, padding: 24 }]}>
        <Text style={[styles.doneTitle, { color: theme.text }]}>本轮动作已完成</Text>
        <Text style={[styles.doneSub, { color: theme.text }]}>生成训练报告并同步打卡</Text>
        <Pressable style={[styles.primaryBtn, { backgroundColor: theme.tint, marginTop: 16 }]} onPress={() => void onFinish()} disabled={busy}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>结束训练</Text>}
        </Pressable>
      </View>
    );
  }

  if (!current) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <Text style={{ color: theme.text }}>加载中…</Text>
      </View>
    );
  }

  const actionIndexDisplay = currentActionIndex + 1;

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <View style={styles.top}>
        <Text style={[styles.dayTitle, { color: theme.text }]} numberOfLines={1}>
          {planDayTitle}
        </Text>
        <Text style={[styles.sub, { color: theme.text }]}>
          第 {actionIndexDisplay} 个 / 共 {actions.length} 个动作
        </Text>
        <View style={[styles.barBg, { backgroundColor: `${theme.tint}22` }]}>
          <View style={[styles.barFill, { width: `${totalProgress * 100}%`, backgroundColor: theme.tint }]} />
        </View>
        {safetyNotice ? (
          <Text style={styles.safety}>{safetyNotice}</Text>
        ) : null}
      </View>

      <View style={styles.middle}>
        <ActionVideo key={current.record_id} action={current} paused={paused || restRemaining !== null} />
        <Text style={[styles.actionName, { color: theme.text }]}>{current.name}</Text>
        <Text style={[styles.setInfo, { color: theme.tint }]}>
          第 {currentSet} 组 / 共 {current.planned_sets} 组 · 每组 {current.planned_reps} 次
        </Text>
        {current.tips ? <Text style={[styles.tips, { color: theme.text }]}>{current.tips}</Text> : null}
      </View>

      {restRemaining !== null && restRemaining > 0 ? (
        <View style={styles.restBanner}>
          <Text style={styles.restText}>组间休息 {restRemaining} 秒</Text>
        </View>
      ) : null}

      <View style={styles.bottom}>
        <View style={styles.row}>
          <Pressable style={[styles.iconBtn, { borderColor: theme.tint }]} onPress={() => setPaused((p) => !p)}>
            <FontAwesome name={paused ? 'play' : 'pause'} size={22} color={theme.tint} />
          </Pressable>
          <Pressable
            style={[styles.primaryBtn, { backgroundColor: '#888', flex: 1 }]}
            onPress={() => void onSkip()}
            disabled={busy || restRemaining !== null}
          >
            <Text style={styles.primaryBtnText}>跳过</Text>
          </Pressable>
          <Pressable
            style={[
              styles.primaryBtn,
              { backgroundColor: theme.tint, flex: 1, opacity: restRemaining !== null || busy ? 0.5 : 1 },
            ]}
            onPress={() => void onCompleteSet()}
            disabled={restRemaining !== null || busy}
          >
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryBtnText}>完成</Text>
            )}
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  top: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 6 },
  dayTitle: { fontSize: 18, fontWeight: '800' },
  sub: { fontSize: 13, opacity: 0.85, marginTop: 4 },
  barBg: { height: 8, borderRadius: 999, overflow: 'hidden', marginTop: 10 },
  barFill: { height: 8, borderRadius: 999 },
  safety: { fontSize: 12, color: '#b8860b', marginTop: 8 },
  middle: { flex: 1, paddingHorizontal: 16 },
  video: { width: '100%', aspectRatio: 16 / 9, backgroundColor: '#000', borderRadius: 12 },
  videoPlaceholder: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#111',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  videoPlaceholderText: { color: '#aaa' },
  actionName: { fontSize: 20, fontWeight: '800', marginTop: 12 },
  setInfo: { fontSize: 15, fontWeight: '700', marginTop: 6 },
  tips: { fontSize: 14, lineHeight: 20, opacity: 0.9, marginTop: 8 },
  restBanner: {
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: 'rgba(47,149,220,0.15)',
  },
  restText: { fontSize: 16, fontWeight: '800', color: '#2f95dc' },
  bottom: { padding: 16, paddingBottom: 28 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconBtn: {
    width: 48,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtn: { paddingVertical: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center', minHeight: 48 },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  doneTitle: { fontSize: 20, fontWeight: '800' },
  doneSub: { fontSize: 14, opacity: 0.85, marginTop: 8, textAlign: 'center' },
});
