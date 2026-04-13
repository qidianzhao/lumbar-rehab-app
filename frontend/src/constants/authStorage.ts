/** SecureStore 键名（与业务逻辑解耦，供 client 拦截器使用） */
export const STORAGE_KEYS = {
  accessToken: 'auth_access_token',
  refreshToken: 'auth_refresh_token',
  user: 'auth_user',
} as const;
