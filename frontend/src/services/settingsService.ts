import * as SecureStore from 'expo-secure-store';
import * as FileSystem from 'expo-file-system/legacy';

import { api } from '@/src/api/client';

interface ApiEnvelope<T> {
  code: number;
  message: string;
  data: T | null;
}

export interface UserMe {
  id: number;
  phone: string;
  show_in_leaderboard: boolean;
}

function unwrap<T>(payload: ApiEnvelope<T>): T {
  if (payload.code !== 0 || payload.data === null) {
    throw new Error(payload.message || '请求失败');
  }
  return payload.data;
}

export async function getMe(): Promise<UserMe> {
  const res = await api.get<ApiEnvelope<UserMe>>('/users/me');
  return unwrap(res.data);
}

export async function updateMe(payload: Partial<Pick<UserMe, 'show_in_leaderboard'>>): Promise<UserMe> {
  const res = await api.put<ApiEnvelope<UserMe>>('/users/me', payload);
  return unwrap(res.data);
}

const SETTINGS_KEY = 'app_settings';

export interface AppSettings {
  pushEnabled: boolean;
  trainingReminderTime: string; // "HH:mm"
  sedentaryEnabled: boolean;
  sedentaryInterval: number; // minutes
}

const DEFAULT_SETTINGS: AppSettings = {
  pushEnabled: true,
  trainingReminderTime: '08:00',
  sedentaryEnabled: true,
  sedentaryInterval: 60,
};

export async function loadSettings(): Promise<AppSettings> {
  try {
    const raw = await SecureStore.getItemAsync(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  await SecureStore.setItemAsync(SETTINGS_KEY, JSON.stringify(settings));
}

export async function getCacheSize(): Promise<string> {
  try {
    const dir = FileSystem.cacheDirectory;
    if (!dir) return '0 KB';
    const info = await FileSystem.getInfoAsync(dir);
    if (info.exists && 'size' in info && typeof info.size === 'number') {
      const mb = info.size / 1024 / 1024;
      return mb < 1 ? `${(mb * 1024).toFixed(0)} KB` : `${mb.toFixed(1)} MB`;
    }
    return '0 KB';
  } catch {
    return '未知';
  }
}

export async function clearCache(): Promise<void> {
  const dir = FileSystem.cacheDirectory;
  if (!dir) return;
  const info = await FileSystem.getInfoAsync(dir);
  if (info.exists) {
    await FileSystem.deleteAsync(dir, { idempotent: true });
  }
}

