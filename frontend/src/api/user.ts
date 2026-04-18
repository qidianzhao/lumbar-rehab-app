import { api } from './client';

interface ApiEnvelope<T> {
  code: number;
  message: string;
  data: T | null;
}

export type HealthProfile = {
  height: number | null;
  weight: number | null;
  disc_segments: string[];
  disc_severity: string | null;
  other_conditions: string[];
  daily_sitting_hours: string | null;
  exercise_habit: string | null;
  is_complete: boolean;
};

function unwrap<T>(payload: ApiEnvelope<T>): T {
  if (payload.code !== 0 || payload.data === null) {
    throw new Error(payload.message || '请求失败');
  }
  return payload.data;
}

export async function getUserHealthProfile(): Promise<HealthProfile> {
  const res = await api.get<ApiEnvelope<HealthProfile>>('/users/me/health-profile');
  return unwrap(res.data);
}

export async function updateUserHealthProfile(payload: Omit<HealthProfile, 'is_complete'>): Promise<void> {
  await api.put('/users/me/health-profile', payload);
}
