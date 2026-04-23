import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

import { api } from '@/src/api/client';

export type ExportSection =
  | 'health_profile'
  | 'training_stats'
  | 'pain_records'
  | 'assessment_results';

export const SECTION_LABELS: Record<ExportSection, string> = {
  health_profile: '个人运动档案',
  training_stats: '训练统计',
  pain_records: '疼痛/不适记录',
  assessment_results: '体能测试结果',
};

export const ALL_SECTIONS: ExportSection[] = [
  'health_profile',
  'training_stats',
  'pain_records',
  'assessment_results',
];

export type DateRange = {
  start: Date;
  end: Date;
};

export function getPresetRange(preset: 'week' | 'month'): DateRange {
  const end = new Date();
  const start = new Date();
  if (preset === 'week') {
    start.setDate(end.getDate() - 7);
  } else {
    start.setMonth(end.getMonth() - 1);
  }
  return { start, end };
}

function toDateStr(d: Date): string {
  return d.toISOString().split('T')[0];
}

interface ApiEnvelope<T> {
  code: number;
  message: string;
  data: T | null;
}

interface ExportPdfResponse {
  pdf_url: string;
  expires_at: string;
}

/**
 * 请求后端生成 PDF（Data URL），写入本地临时文件，调用系统分享。
 */
export async function exportAndShare(
  range: DateRange,
  sections: ExportSection[],
): Promise<void> {
  const res = await api.post<ApiEnvelope<ExportPdfResponse>>('/export/pdf', {
    start_date: toDateStr(range.start),
    end_date: toDateStr(range.end),
    include_sections: sections,
  });

  const { data } = res.data;
  if (res.data.code !== 0 || !data) {
    throw new Error(res.data.message || '生成失败');
  }

  const { pdf_url } = data;

  // pdf_url 是 data:application/pdf;base64,xxx 格式
  const base64 = pdf_url.replace(/^data:application\/pdf;base64,/, '');

  const filename = `ldh_report_${toDateStr(range.start)}_${toDateStr(range.end)}.pdf`;
  const fileUri = `${FileSystem.cacheDirectory}${filename}`;

  await FileSystem.writeAsStringAsync(fileUri, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    throw new Error('当前设备不支持分享功能');
  }

  await Sharing.shareAsync(fileUri, {
    mimeType: 'application/pdf',
    dialogTitle: '分享训练报告',
  });
}
