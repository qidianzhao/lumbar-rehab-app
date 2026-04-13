import { api } from '@/src/api/client';

export interface ApiEnvelope<T> {
  code: number;
  message: string;
  data: T | null;
}

export interface PlanExercise {
  id: number;
  action_id: number;
  name: string;
  phase: string;
  sets: number;
  reps: number;
  rest_seconds: number;
  sort_order: number;
}

export interface PlanDay {
  id: number;
  week_number: number;
  day_number: number;
  day_type: string;
  title: string;
  estimated_duration: number;
  exercises: PlanExercise[];
}

export interface TrainingPlan {
  id: number;
  user_id: number;
  name: string;
  description: string | null;
  level: string;
  status: string;
  weekly_frequency: number;
  estimated_weeks: number;
  assessment_id: number | null;
  preferred_duration_minutes: number | null;
  created_at: string;
  updated_at: string;
  days: PlanDay[];
  progress_week: number | null;
}

export interface PlanGenerateBody {
  assessment_id?: number | null;
  weekly_frequency: number;
  preferred_duration: number;
}

function unwrap<T>(payload: ApiEnvelope<T>): T {
  if (payload.code !== 0 || payload.data === null) {
    throw new Error(payload.message || '请求失败');
  }
  return payload.data;
}

export async function generatePlan(body: PlanGenerateBody): Promise<TrainingPlan> {
  const res = await api.post<ApiEnvelope<TrainingPlan>>('/plans/generate', body);
  return unwrap(res.data);
}

export async function getCurrentPlan(): Promise<TrainingPlan | null> {
  const res = await api.get<ApiEnvelope<TrainingPlan | null>>('/plans/current');
  if (res.data.code !== 0) {
    throw new Error(res.data.message || '请求失败');
  }
  return res.data.data;
}

export async function getPlanById(planId: number): Promise<TrainingPlan> {
  const res = await api.get<ApiEnvelope<TrainingPlan>>(`/plans/${planId}`);
  return unwrap(res.data);
}

export async function confirmPlan(planId: number): Promise<TrainingPlan> {
  const res = await api.post<ApiEnvelope<TrainingPlan>>(`/plans/${planId}/confirm`);
  return unwrap(res.data);
}
