import { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import { api } from '@/src/api/client';
import { startRecording, stopRecordingAndRecognize, speakText, stopSpeaking } from '@/src/services/voiceService';

const AI_CHAT_URL = '/ai/chat';

interface AIVoiceChatOptions {
  /** 是否在线（离线时禁用AI功能） */
  isOnline?: boolean;
  /** AI对话上下文信息 */
  getContext: () => Record<string, any>;
  /** 录音启动前的回调 */
  onRecordingStart?: () => void;
  /** 录音结束后的回调 */
  onRecordingEnd?: () => void;
}

interface AIVoiceChatResult {
  /** 是否正在录音 */
  isRecording: boolean;
  /** AI消息内容 */
  aiMessage: string | null;
  /** 是否正在处理AI请求 */
  isProcessing: boolean;
  /** 设置AI消息 */
  setAiMessage: (msg: string | null) => void;
  /** 按下麦克风按钮 */
  onMicPressIn: () => Promise<void>;
  /** 松开麦克风按钮 */
  onMicPressOut: () => Promise<void>;
  /** 发送文本到AI（用于手动输入） */
  sendTextToAI: (text: string) => Promise<void>;
}

/**
 * AI语音聊天Hook
 * 统一处理体能测试和训练会话中的AI语音交互逻辑
 */
export function useAIVoiceChat(options: AIVoiceChatOptions): AIVoiceChatResult {
  const { isOnline = true, getContext, onRecordingStart, onRecordingEnd } = options;

  const [isRecording, setIsRecording] = useState(false);
  const [aiMessage, setAiMessage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const sendTextToAI = useCallback(async (text: string) => {
    if (!text.trim()) return;

    console.log('🎤 发送到AI:', text);
    setAiMessage(`你说：${text}`);
    setIsProcessing(true);

    try {
      const context = getContext();
      const res = await api.post<{ code: number; data: { reply: string } }>(AI_CHAT_URL, {
        messages: [{ role: 'user', content: text }],
        context,
      });

      console.log('AI 回复:', JSON.stringify(res.data));
      const reply = res.data?.data?.reply ?? '';

      if (reply) {
        setAiMessage(reply);
        await speakText(reply);
      } else {
        setAiMessage('AI助手暂时无法回复，请稍后再试');
        await speakText('AI助手暂时无法回复');
      }
    } catch (e) {
      console.log('AI 对话错误:', e);
      let errorMsg = 'AI助手出错了，请稍后再试';

      if (e instanceof Error) {
        if (e.message.includes('超时') || e.message.includes('timeout')) {
          errorMsg = 'AI响应超时，请重试';
        } else if (e.message.includes('网络') || e.message.includes('Network')) {
          errorMsg = '网络连接失败，请检查网络';
        }
      } else if (e && typeof e === 'object' && 'response' in e) {
        const response = (e as { response?: { status?: number } }).response;
        if (response?.status === 401) {
          errorMsg = '登录已过期，请重新登录';
        } else if (response?.status && response.status >= 500) {
          errorMsg = '服务器繁忙，请稍后再试';
        }
      }

      setAiMessage(errorMsg);
      await speakText(errorMsg).catch(() => {});
      Alert.alert('AI交互失败', errorMsg);
    } finally {
      setIsProcessing(false);
    }
  }, [getContext]);

  const onMicPressIn = useCallback(async () => {
    if (!isOnline) {
      Alert.alert('离线模式', 'AI语音功能需要联网使用');
      return;
    }

    setAiMessage(null);
    setIsRecording(true);
    stopSpeaking();
    onRecordingStart?.();

    try {
      await startRecording();
    } catch (e) {
      console.log('录音启动失败:', e);
      setIsRecording(false);
      const errorMsg = '录音启动失败，请检查麦克风权限';
      setAiMessage(errorMsg);
      await speakText(errorMsg);
      Alert.alert('录音失败', e instanceof Error ? e.message : errorMsg);
    }
  }, [isOnline, onRecordingStart]);

  const onMicPressOut = useCallback(async () => {
    if (!isRecording) return;

    setIsRecording(false);
    onRecordingEnd?.();

    try {
      const text = await stopRecordingAndRecognize();

      if (!text) {
        setAiMessage('没听清，请再说一次');
        await speakText('没听清，请再说一次');
        return;
      }

      await sendTextToAI(text);
    } catch (e) {
      console.log('识别错误:', e);
      let errorMsg = '语音识别失败，请重试';

      if (e instanceof Error && e.message.includes('超时')) {
        errorMsg = '语音识别超时，请重试';
      }

      setAiMessage(errorMsg);
      await speakText(errorMsg);
    }
  }, [isRecording, sendTextToAI, onRecordingEnd]);

  return {
    isRecording,
    aiMessage,
    isProcessing,
    setAiMessage,
    onMicPressIn,
    onMicPressOut,
    sendTextToAI,
  };
}
