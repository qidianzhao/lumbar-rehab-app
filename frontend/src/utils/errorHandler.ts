import { Alert } from 'react-native';
import type { AxiosError } from 'axios';

export interface ErrorInfo {
  message: string;
  code?: string;
  statusCode?: number;
}

/**
 * 统一错误处理工具
 * 将各种类型的错误转换为用户友好的错误信息
 */
export function handleError(error: unknown, context?: string): ErrorInfo {
  // Axios错误
  if (isAxiosError(error)) {
    const axiosError = error as AxiosError<any>;
    const statusCode = axiosError.response?.status;
    const responseData = axiosError.response?.data;

    // 优先使用后端返回的错误信息
    if (responseData?.message) {
      return {
        message: responseData.message,
        code: responseData.code,
        statusCode,
      };
    }

    // 根据HTTP状态码返回友好提示
    switch (statusCode) {
      case 400:
        return { message: '请求参数错误', statusCode };
      case 401:
        return { message: '登录已过期，请重新登录', statusCode };
      case 403:
        return { message: '没有权限执行此操作', statusCode };
      case 404:
        return { message: '请求的资源不存在', statusCode };
      case 409:
        return { message: '数据冲突，请刷新后重试', statusCode };
      case 422:
        return { message: '数据验证失败', statusCode };
      case 429:
        return { message: '请求过于频繁，请稍后再试', statusCode };
      case 500:
      case 502:
      case 503:
        return { message: '服务器繁忙，请稍后再试', statusCode };
      case 504:
        return { message: '请求超时，请检查网络连接', statusCode };
      default:
        if (axiosError.code === 'ECONNABORTED' || axiosError.message?.includes('timeout')) {
          return { message: '请求超时，请重试', code: 'TIMEOUT' };
        }
        if (axiosError.code === 'ERR_NETWORK' || axiosError.message?.includes('Network')) {
          return { message: '网络连接失败，请检查网络', code: 'NETWORK_ERROR' };
        }
        return { message: axiosError.message || '网络请求失败', statusCode };
    }
  }

  // 标准Error对象
  if (error instanceof Error) {
    // 特殊错误类型处理
    if (error.message.includes('超时') || error.message.includes('timeout')) {
      return { message: '操作超时，请重试', code: 'TIMEOUT' };
    }
    if (error.message.includes('网络') || error.message.includes('Network')) {
      return { message: '网络连接失败，请检查网络', code: 'NETWORK_ERROR' };
    }
    if (error.message.includes('权限') || error.message.includes('permission')) {
      return { message: '权限不足，请检查应用权限设置', code: 'PERMISSION_DENIED' };
    }

    return { message: error.message };
  }

  // 字符串错误
  if (typeof error === 'string') {
    return { message: error };
  }

  // 未知错误
  const fallbackMessage = context ? `${context}失败` : '操作失败，请重试';
  return { message: fallbackMessage, code: 'UNKNOWN_ERROR' };
}

/**
 * 显示错误提示对话框
 */
export function showErrorAlert(error: unknown, title: string = '错误', context?: string): void {
  const errorInfo = handleError(error, context);
  Alert.alert(title, errorInfo.message);
}

/**
 * 获取简短的错误消息（用于内联显示）
 */
export function getErrorMessage(error: unknown, fallback: string = '操作失败'): string {
  const errorInfo = handleError(error);
  return errorInfo.message || fallback;
}

/**
 * 判断是否为网络错误
 */
export function isNetworkError(error: unknown): boolean {
  const errorInfo = handleError(error);
  return errorInfo.code === 'NETWORK_ERROR' || errorInfo.code === 'TIMEOUT';
}

/**
 * 判断是否为认证错误
 */
export function isAuthError(error: unknown): boolean {
  const errorInfo = handleError(error);
  return errorInfo.statusCode === 401;
}

/**
 * 类型守卫：判断是否为Axios错误
 */
function isAxiosError(error: unknown): error is AxiosError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'isAxiosError' in error &&
    (error as any).isAxiosError === true
  );
}

/**
 * 异步操作错误处理包装器
 * 自动处理loading状态和错误状态
 */
export async function withErrorHandling<T>(
  operation: () => Promise<T>,
  options: {
    setLoading?: (loading: boolean) => void;
    setError?: (error: string | null) => void;
    onError?: (error: ErrorInfo) => void;
    context?: string;
    showAlert?: boolean;
  } = {}
): Promise<T | null> {
  const { setLoading, setError, onError, context, showAlert = false } = options;

  try {
    setLoading?.(true);
    setError?.(null);
    const result = await operation();
    return result;
  } catch (error) {
    const errorInfo = handleError(error, context);
    setError?.(errorInfo.message);
    onError?.(errorInfo);

    if (showAlert) {
      showErrorAlert(error, '操作失败', context);
    }

    return null;
  } finally {
    setLoading?.(false);
  }
}
