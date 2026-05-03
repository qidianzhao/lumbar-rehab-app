import { api } from '@/src/api/client';

export interface ApiEnvelope<T> {
  code: number;
  message: string;
  data: T | null;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ChatRequest {
  messages: ChatMessage[];
  context?: Record<string, any>;
}

export interface ChatResponse {
  reply: string;
}

export interface UsageLimitInfo {
  allowed: boolean;
  used: number;
  limit: number;
  remaining: number;
}

export interface UsageStats {
  total_calls: number;
  total_input_tokens: number;
  total_output_tokens: number;
  by_type: Record<string, number>;
  daily: Array<{ date: string; count: number }>;
}

/**
 * 自由问答 - 每日限制次数
 */
export async function freeChat(messages: ChatMessage[]): Promise<string> {
  try {
    console.log('[chatApi] freeChat request:', JSON.stringify({ messages }));
    const res = await api.post<ApiEnvelope<ChatResponse>>('/ai/free-chat', {
      messages,
    });
    console.log('[chatApi] freeChat response:', JSON.stringify(res.data));
    return unwrap(res.data).reply;
  } catch (error) {
    console.error('[chatApi] freeChat error:', error);
    if (error && typeof error === 'object' && 'response' in error) {
      console.error('[chatApi] error.response:', (error as { response?: unknown }).response);
    }
    if (error instanceof Error) {
      console.error('[chatApi] error.message:', error.message);
    }
    throw error;
  }
}

/**
 * 训练中AI对话 - 不限制次数
 */
export async function trainingChat(
  messages: ChatMessage[],
  context?: Record<string, unknown>
): Promise<string> {
  const res = await api.post<ApiEnvelope<ChatResponse>>('/ai/chat', {
    messages,
    context,
  });
  return unwrap(res.data).reply;
}

/**
 * 获取今日免费对话剩余次数
 */
export async function getUsageLimit(): Promise<UsageLimitInfo> {
  try {
    const res = await api.get<ApiEnvelope<UsageLimitInfo>>('/ai/usage-limit');
    console.log('[chatApi] getUsageLimit response:', JSON.stringify(res.data));
    return unwrap(res.data);
  } catch (error) {
    console.error('[chatApi] getUsageLimit error:', error);
    if (error && typeof error === 'object' && 'response' in error) {
      console.error('[chatApi] error.response:', (error as { response?: unknown }).response);
    }
    if (error instanceof Error) {
      console.error('[chatApi] error.message:', error.message);
    }
    throw error;
  }
}

/**
 * 获取用户最近N天的用量统计
 */
export async function getUserUsageStats(days: number = 7): Promise<UsageStats> {
  const res = await api.get<ApiEnvelope<UsageStats>>(`/ai/usage-stats?days=${days}`);
  return unwrap(res.data);
}

function unwrap<T>(envelope: ApiEnvelope<T>): T {
  console.log('[chatApi] unwrap envelope:', JSON.stringify(envelope));
  if (!envelope || typeof envelope !== 'object') {
    console.error('[chatApi] unwrap: invalid envelope', envelope);
    throw new Error('Invalid API response format');
  }
  if (envelope.code !== 0) {
    throw new Error(envelope.message || 'API request failed');
  }
  if (envelope.data === null || envelope.data === undefined) {
    console.error('[chatApi] unwrap: data is null/undefined');
    throw new Error('API returned null data');
  }
  return envelope.data;
}
