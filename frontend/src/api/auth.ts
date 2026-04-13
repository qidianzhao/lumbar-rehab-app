import type { LoginResponse, RefreshResponse } from '@/src/types/auth';

import { api } from './client';

/** 发送短信验证码 */
export async function sendCode(phone: string): Promise<void> {
  await api.post('/auth/send-code', { phone });
}

/** 验证码登录，返回用户与 token */
export async function login(phone: string, code: string): Promise<LoginResponse> {
  const { data } = await api.post<LoginResponse>('/auth/login', { phone, code });
  return data;
}

/** 使用 refresh_token 换取新的 access_token */
export async function refreshToken(refreshToken: string): Promise<RefreshResponse> {
  const { data } = await api.post<RefreshResponse>('/auth/refresh', {
    refresh_token: refreshToken,
  });
  return data;
}
