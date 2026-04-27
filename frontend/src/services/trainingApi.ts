import { api } from '@/src/api/client';

export interface ApiEnvelope<T> {
  code: number;
  message: string;
  data: T | null;
}

export type PreCheckStatus = 'normal' | 'discomfort';

export interface PainInfo {
  body_region: string;
  pain_level: number;
  description?: string | null;
}

export interface SessionCreateBody {
  plan_id: number;
  plan_day_id: number;
  pre_check_status: PreCheckStatus;
  pain_info?: PainInfo | null;
}

export interface SessionStartAction {
  record_id: number;
  action_id: number;
  name: string;
  phase: string;
  planned_sets: number;
  planned_reps: number;
  rest_seconds: number;
  set_duration_seconds: number;
  video_url: string | null;
  tips: string | null;
}

export interface SessionStartData {
  session_id: number;
  plan_day_title: string;
  safety_notice: string | null;
  degraded: boolean;
  actions: SessionStartAction[];
}

export interface RecordSubmitBody {
  record_id?: number | null;
  action_id: number;
  actual_sets: number;
  actual_reps: number;
  is_completed: boolean;
  is_skipped: boolean;
  difficulty_feedback?: number | null;
}

export interface SessionFinishActionDetail {
  action_id: number;
  name: string;
  phase: string;
  planned_sets: number;
  planned_reps: number;
  actual_sets: number;
  actual_reps: number;
  is_completed: boolean;
  is_skipped: boolean;
}

export interface SessionFinishData {
  session_id: number;
  completion_rate: number;
  duration_display: string;
  action_details: SessionFinishActionDetail[];
  ai_summary: string;
  checkin_ok: boolean;
}

export interface SessionHistoryItem {
  id: number;
  plan_id: number;
  plan_day_id: number;
  status: string;
  pre_check_status: string;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  completion_rate: number | null;
}

export interface SessionHistoryData {
  items: SessionHistoryItem[];
  total: number;
  page: number;
  page_size: number;
}

function unwrap<T>(payload: ApiEnvelope<T>): T {
  if (payload.code !== 0 || payload.data === null) {
    throw new Error(payload.message || '请求失败');
  }
  return payload.data;
}

export async function createSession(body: SessionCreateBody): Promise<SessionStartData> {
  const res = await api.post<ApiEnvelope<SessionStartData>>('/training/sessions', body);
  return unwrap(res.data);
}

export async function submitRecord(sessionId: number, data: RecordSubmitBody): Promise<void> {
  const res = await api.post<ApiEnvelope<{ ok: boolean }>>(`/training/sessions/${sessionId}/records`, data);
  unwrap(res.data);
}

export async function finishSession(sessionId: number): Promise<SessionFinishData> {
  const res = await api.post<ApiEnvelope<SessionFinishData>>(`/training/sessions/${sessionId}/finish`);
  return unwrap(res.data);
}

export async function getSessionHistory(page = 1, pageSize = 20): Promise<SessionHistoryData> {
  const res = await api.get<ApiEnvelope<SessionHistoryData>>('/training/sessions/history', {
    params: { page, page_size: pageSize },
  });
  return unwrap(res.data);
}

export async function getSessionReport(sessionId: number): Promise<SessionFinishData> {
  const res = await api.get<ApiEnvelope<SessionFinishData>>(`/training/sessions/${sessionId}/report`);
  return unwrap(res.data);
}
