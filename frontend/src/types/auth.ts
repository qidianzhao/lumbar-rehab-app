/** 与后端 /auth/login 响应一致 */

export type AuthUser = {
  id: number;
  phone: string;
  created_at: string;
};

export type LoginResponse = {
  user: AuthUser;
  access_token: string;
  refresh_token: string;
  token_type: string;
};

export type RefreshResponse = {
  access_token: string;
  token_type: string;
};
