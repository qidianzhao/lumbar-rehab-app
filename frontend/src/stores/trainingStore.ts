import { create } from 'zustand';

import type { SessionFinishData, SessionStartAction } from '@/src/services/trainingApi';
import * as trainingApi from '@/src/services/trainingApi';

type TrainingState = {
  sessionId: number | null;
  planDayTitle: string;
  actions: SessionStartAction[];
  /** 当前动作下标；等于 actions.length 表示所有动作已处理完，等待结束会话 */
  currentActionIndex: number;
  /** 当前组（1..planned_sets） */
  currentSet: number;
  startedAtMs: number | null;
  safetyNotice: string | null;
  lastReport: SessionFinishData | null;
  reset: () => void;
  hydrateFromSession: (data: Awaited<ReturnType<typeof trainingApi.createSession>>) => void;
  isWorkoutFlowDone: () => boolean;
  skipCurrentAction: () => Promise<void>;
  completeCurrentSet: () => Promise<void>;
  finishTraining: () => Promise<SessionFinishData>;
};

export const useTrainingStore = create<TrainingState>((set, get) => ({
  sessionId: null,
  planDayTitle: '',
  actions: [],
  currentActionIndex: 0,
  currentSet: 1,
  startedAtMs: null,
  safetyNotice: null,
  lastReport: null,

  reset: () =>
    set({
      sessionId: null,
      planDayTitle: '',
      actions: [],
      currentActionIndex: 0,
      currentSet: 1,
      startedAtMs: null,
      safetyNotice: null,
      lastReport: null,
    }),

  hydrateFromSession: (data) => {
    set({
      sessionId: data.session_id,
      planDayTitle: data.plan_day_title,
      actions: data.actions,
      currentActionIndex: 0,
      currentSet: 1,
      startedAtMs: Date.now(),
      safetyNotice: data.safety_notice,
    });
  },

  isWorkoutFlowDone: () => {
    const { actions, currentActionIndex } = get();
    return actions.length > 0 && currentActionIndex >= actions.length;
  },

  skipCurrentAction: async () => {
    const { sessionId, actions, currentActionIndex } = get();
    const cur = actions[currentActionIndex];
    if (!sessionId || !cur) return;
    await trainingApi.submitRecord(sessionId, {
      record_id: cur.record_id,
      action_id: cur.action_id,
      actual_sets: 0,
      actual_reps: 0,
      is_completed: false,
      is_skipped: true,
    });
    if (currentActionIndex < actions.length - 1) {
      set({ currentActionIndex: currentActionIndex + 1, currentSet: 1 });
    } else {
      set({ currentActionIndex: actions.length });
    }
  },

  completeCurrentSet: async () => {
    const { sessionId, actions, currentActionIndex, currentSet } = get();
    const cur = actions[currentActionIndex];
    if (!sessionId || !cur) return;

    const isLastSet = currentSet === cur.planned_sets;
    await trainingApi.submitRecord(sessionId, {
      record_id: cur.record_id,
      action_id: cur.action_id,
      actual_sets: currentSet,
      actual_reps: currentSet * cur.planned_reps,
      is_completed: isLastSet,
      is_skipped: false,
    });

    if (isLastSet) {
      if (currentActionIndex < actions.length - 1) {
        set({ currentActionIndex: currentActionIndex + 1, currentSet: 1 });
      } else {
        set({ currentActionIndex: actions.length });
      }
    } else {
      set({ currentSet: currentSet + 1 });
    }
  },

  finishTraining: async () => {
    const { sessionId } = get();
    if (!sessionId) {
      throw new Error('无会话');
    }
    const report = await trainingApi.finishSession(sessionId);
    set({ lastReport: report });
    return report;
  },
}));
