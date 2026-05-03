import { api } from '@/src/api/client';

interface ApiEnvelope<T> {
  code: number;
  message: string;
  data: T | null;
}

export interface CheckinCalendarDay {
  date: string; // 'YYYY-MM-DD'
  has_checkin: boolean;
  training_session_ids: number[]; // 支持每天多次训练
}

export interface CheckinCalendarData {
  year: number;
  month: number;
  days: CheckinCalendarDay[];
  streak_days: number;
  total_days: number;
}

function unwrap<T>(payload: ApiEnvelope<T>): T {
  if (payload.code !== 0 || payload.data === null) {
    throw new Error(payload.message || '请求失败');
  }
  return payload.data;
}

export async function getCheckinCalendar(year: number, month: number): Promise<CheckinCalendarData> {
  const res = await api.get<ApiEnvelope<CheckinCalendarData>>('/checkin/calendar', {
    params: { year, month },
  });
  return unwrap(res.data);
}
