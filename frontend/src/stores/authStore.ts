import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';

import * as authApi from '@/src/api/auth';
import { STORAGE_KEYS } from '@/src/constants/authStorage';
import type { AuthUser } from '@/src/types/auth';

type AuthState = {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  isLoading: boolean;
  /** 验证码登录并持久化 token */
  login: (phone: string, code: string) => Promise<void>;
  /** 清除本地凭证与内存状态 */
  logout: () => Promise<void>;
  /** 启动时从 SecureStore 恢复会话 */
  checkAuth: () => Promise<void>;
};

async function persistSession(
  user: AuthUser,
  accessToken: string,
  refreshToken: string,
): Promise<void> {
  await SecureStore.setItemAsync(STORAGE_KEYS.accessToken, accessToken);
  await SecureStore.setItemAsync(STORAGE_KEYS.refreshToken, refreshToken);
  await SecureStore.setItemAsync(STORAGE_KEYS.user, JSON.stringify(user));
}

async function clearSession(): Promise<void> {
  for (const key of Object.values(STORAGE_KEYS)) {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch {
      /* 键不存在时忽略 */
    }
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  isLoading: false,

  login: async (phone: string, code: string) => {
    set({ isLoading: true });
    try {
      const res = await authApi.login(phone, code);
      await persistSession(res.user, res.access_token, res.refresh_token);
      set({
        user: res.user,
        accessToken: res.access_token,
        refreshToken: res.refresh_token,
        isLoading: false,
      });
    } catch (e) {
      set({ isLoading: false });
      throw e;
    }
  },

  logout: async () => {
    await clearSession();
    set({
      user: null,
      accessToken: null,
      refreshToken: null,
      isLoading: false,
    });
  },

  checkAuth: async () => {
    set({ isLoading: true });
    try {
      const access = await SecureStore.getItemAsync(STORAGE_KEYS.accessToken);
      const refresh = await SecureStore.getItemAsync(STORAGE_KEYS.refreshToken);
      const userJson = await SecureStore.getItemAsync(STORAGE_KEYS.user);
      if (access && refresh && userJson) {
        set({
          accessToken: access,
          refreshToken: refresh,
          user: JSON.parse(userJson) as AuthUser,
          isLoading: false,
        });
      } else {
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isLoading: false,
        });
      }
    } catch {
      set({
        user: null,
        accessToken: null,
        refreshToken: null,
        isLoading: false,
      });
    }
  },
}));
