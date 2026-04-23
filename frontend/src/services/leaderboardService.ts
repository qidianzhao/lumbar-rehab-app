import { api } from '@/src/api/client';

export type LeaderboardPeriod = 'WEEK' | 'MONTH' | 'YEAR';

export interface LeaderboardEntry {
  rank: number;
  user_id: number;
  display_name: string;
  checkin_days: number;
  streak_days: number;
  is_me: boolean;
}

export interface LeaderboardData {
  period: string;
  entries: LeaderboardEntry[];
  my_rank: number | null;
  my_entry: LeaderboardEntry | null;
}

interface ApiEnvelope<T> {
  code: number;
  message: string;
  data: T | null;
}

export async function getLeaderboard(period: LeaderboardPeriod): Promise<LeaderboardData> {
  const res = await api.get<ApiEnvelope<LeaderboardData>>('/checkin/leaderboard', {
    params: { period },
  });
  const { data } = res.data;
  if (res.data.code !== 0 || data === null) {
    throw new Error(res.data.message || '加载失败');
  }
  return data;
}

export const PERIOD_LABELS: Record<LeaderboardPeriod, string> = {
  WEEK: '周榜',
  MONTH: '月榜',
  YEAR: '年榜',
};

export const PERIODS: LeaderboardPeriod[] = ['WEEK', 'MONTH', 'YEAR'];

/** 1-3名 → 金银铜标识 */
export function getMedalEmoji(rank: number): string | null {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return null;
}
