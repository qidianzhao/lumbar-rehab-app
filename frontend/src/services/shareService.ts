import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

import { api } from '@/src/api/client';

interface ApiEnvelope<T> {
  code: number;
  message: string;
  data: T | null;
}

interface ShareCardResponse {
  image_url: string;
  card_type: string;
  session_id: number;
}

export async function shareTrainingReport(sessionId: number): Promise<void> {
  try {
    const res = await api.post<ApiEnvelope<ShareCardResponse>>('/share/card', {
      card_type: 'TRAINING_REPORT',
      session_id: sessionId,
    });

    const { data } = res.data;
    if (res.data.code !== 0 || !data) {
      throw new Error(res.data.message || '生成分享卡片失败');
    }

    const base64 = data.image_url.replace(/^data:image\/png;base64,/, '');
    const fileUri = `${FileSystem.cacheDirectory}share_card_${sessionId}.png`;

    await FileSystem.writeAsStringAsync(fileUri, base64, {
      encoding: 'base64',
    });

    const canShare = await Sharing.isAvailableAsync();
    if (!canShare) {
      throw new Error('当前设备不支持分享功能');
    }

    await Sharing.shareAsync(fileUri, {
      mimeType: 'image/png',
      dialogTitle: '分享训练报告',
    });
  } catch (error) {
    // 清理可能创建的临时文件
    const fileUri = `${FileSystem.cacheDirectory}share_card_${sessionId}.png`;
    try {
      await FileSystem.deleteAsync(fileUri, { idempotent: true });
    } catch {
      // 忽略清理错误
    }
    throw error;
  }
}
