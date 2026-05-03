import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { SessionFinishData, SessionStartAction } from '@/src/services/trainingApi';
import * as trainingApi from '@/src/services/trainingApi';

type TrainingState = {
  sessionId: number | null;
  planDayTitle: string;
  actions: SessionStartAction[];
  currentActionIndex: number;
  currentSet: number;
  startedAtMs: number | null;
  safetyNotice: string | null;
  lastReport: SessionFinishData | null;

  reset: () => void;
  hydrateFromSession: (data: Awaited<ReturnType<typeof trainingApi.createSession>>) => void;
  isWorkoutFlowDone: () => boolean;
  skipCurrentAction: () => Promise<void>;
  advanceSet: () => Promise<void>;
  finishTraining: () => Promise<SessionFinishData>;
};

export const useTrainingStore = create<TrainingState>()(
  persist(
    (set, get) => ({
      sessionId: null,
      planDayTitle: '',
      actions: [],
      currentActionIndex: 0,
      currentSet: 1,
      startedAtMs: null,
      safetyNotice: null,
      lastReport: null,

      reset: () => set({
        sessionId: null,
        planDayTitle: '',
        actions: [],
        currentActionIndex: 0,
        currentSet: 1,
        startedAtMs: null,
        safetyNotice: null,
        lastReport: null,
      }),

      hydrateFromSession: (data) => set({
        sessionId: data.session_id,
        planDayTitle: data.plan_day_title,
        actions: data.actions,
        currentActionIndex: 0,
        currentSet: 1,
        startedAtMs: Date.now(),
        safetyNotice: data.safety_notice,
      }),

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
        const nextIdx = currentActionIndex + 1;
        set({ currentActionIndex: nextIdx < actions.length ? nextIdx : actions.length, currentSet: 1 });
      },

      // 当前组完成，自动推进到下一组或下一动作
      advanceSet: async () => {
        const { sessionId, actions, currentActionIndex, currentSet } = get();
        const cur = actions[currentActionIndex];
        if (!sessionId || !cur) return;

        const isLastSet = currentSet >= cur.planned_sets;
        await trainingApi.submitRecord(sessionId, {
          record_id: cur.record_id,
          action_id: cur.action_id,
          actual_sets: currentSet,
          actual_reps: currentSet * cur.planned_reps,
          is_completed: isLastSet,
          is_skipped: false,
        });

        if (isLastSet) {
          const nextIdx = currentActionIndex + 1;
          set({ currentActionIndex: nextIdx < actions.length ? nextIdx : actions.length, currentSet: 1 });
        } else {
          set({ currentSet: currentSet + 1 });
        }
      },

      finishTraining: async () => {
        const { sessionId } = get();
        if (!sessionId) throw new Error('无会话');
        const report = await trainingApi.finishSession(sessionId);
        set({ lastReport: report });
        return report;
      },
    }),
    {
      name: 'training-session-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        sessionId: state.sessionId,
        planDayTitle: state.planDayTitle,
        actions: state.actions,
        currentActionIndex: state.currentActionIndex,
        currentSet: state.currentSet,
        startedAtMs: state.startedAtMs,
        safetyNotice: state.safetyNotice,
      }),
    }
  )
);
