import { api } from '@/src/api/client';

export interface ApiEnvelope<T> {
  code: number;
  message: string;
  data: T | null;
}

export interface AIQuota {
  used_today: number;
  remaining: number;
  daily_limit: number;
}

function unwrap<T>(payload: ApiEnvelope<T>): T {
  if (payload.code !== 0 || payload.data === null) {
    throw new Error(payload.message || '请求失败');
  }
  return payload.data;
}

export async function getAIQuota(): Promise<AIQuota> {
  const res = await api.get<ApiEnvelope<AIQuota>>('/ai/quota');
  return unwrap(res.data);
}
