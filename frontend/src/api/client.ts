import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { STORAGE_KEYS } from '@/src/constants/authStorage';

/**
 * 默认直连本机后端。Android 模拟器访问宿主机请用 10.0.2.2；
 * 真机 Expo Go 请设置 EXPO_PUBLIC_API_BASE=http://<电脑局域网IP>:8000/api/v1
 */
function resolveBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_BASE;
  if (fromEnv) {
    return fromEnv.replace(/\/$/, '');
  }
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:8000/api/v1';
  }
  return 'http://localhost:8000/api/v1';
}

export const api = axios.create({
  baseURL: resolveBaseUrl(),
  timeout: 20000,
});

api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const token = await SecureStore.getItemAsync(STORAGE_KEYS.accessToken);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    if (error.response?.status === 401) {
      try {
        const { useAuthStore } = await import('@/src/stores/authStore');
        await useAuthStore.getState().logout();
        const { router } = await import('expo-router');
        router.replace('/login');
      } catch {
        /* 避免拦截器自身抛错 */
      }
    }
    return Promise.reject(error);
  },
);
