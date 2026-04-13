import { api } from '@/src/api/client';

export interface ApiEnvelope<T> {
  code: number;
  message: string;
  data: T | null;
}

export type MetricType = 'seconds' | 'reps' | 'rating_1_5';

export interface AssessmentTestItem {
  action_id: number;
  name: string;
  dimension: string;
  metric_type: MetricType;
  prompt: string;
}

export interface TestItemSubmit {
  action_id: number;
  metric_value: number;
  user_notes?: string | null;
}

export interface AssessmentSubmitBody {
  items: TestItemSubmit[];
}

export interface AssessmentItem {
  id: number;
  action_id: number;
  dimension: string;
  metric_type: MetricType | string;
  metric_value: number;
  user_notes: string | null;
}

export interface AssessmentReport {
  id: number;
  user_id: number;
  overall_level: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | string;
  scores: Record<string, number>;
  weak_areas: string[];
  ai_summary: string;
  suggested_plan_level: 'beginner' | 'intermediate' | 'advanced' | string;
  created_at: string;
  items: AssessmentItem[];
}

export interface AssessmentHistoryItem {
  id: number;
  overall_level: string;
  suggested_plan_level: string;
  created_at: string;
  scores: Record<string, number>;
  weak_areas: string[];
}

export interface AssessmentHistory {
  items: AssessmentHistoryItem[];
}

function unwrap<T>(payload: ApiEnvelope<T>): T {
  if (payload.code !== 0 || payload.data === null) {
    throw new Error(payload.message || '请求失败');
  }
  return payload.data;
}

export async function getTestItems(): Promise<AssessmentTestItem[]> {
  const res = await api.get<ApiEnvelope<AssessmentTestItem[]>>('/assessment/test-items');
  return unwrap(res.data);
}

export async function submitAssessment(body: AssessmentSubmitBody): Promise<AssessmentReport> {
  const res = await api.post<ApiEnvelope<AssessmentReport>>('/assessment/submit', body);
  return unwrap(res.data);
}

export async function getHistory(): Promise<AssessmentHistory> {
  const res = await api.get<ApiEnvelope<AssessmentHistory>>('/assessment/history');
  return unwrap(res.data);
}

export async function getLatest(): Promise<AssessmentReport | null> {
  const res = await api.get<ApiEnvelope<AssessmentReport | null>>('/assessment/latest');
  if (res.data.code !== 0) {
    throw new Error(res.data.message || '请求失败');
  }
  return res.data.data;
}

