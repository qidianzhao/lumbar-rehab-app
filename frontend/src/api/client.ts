import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import * as SecureStore from 'expo-secure-store';

import { STORAGE_KEYS } from '@/src/constants/authStorage';

function resolveBaseUrl(): string {
  return process.env.EXPO_PUBLIC_API_BASE ?? 'http://localhost:8000/api/v1';
}

export const api = axios.create({
  baseURL: resolveBaseUrl(),
  timeout: 20000,
});

api.interceptors.request.use(
  (config) => {
    console.log(
      '📡 API Request:',
      config.method?.toUpperCase(),
      `${config.baseURL ?? ''}${config.url ?? ''}`,
    );
    return config;
  },
  (error) => Promise.reject(error),
);

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