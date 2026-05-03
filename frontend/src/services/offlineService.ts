/**
 * 离线模式服务
 * 负责视频下载、离线数据存储、数据同步
 */
import * as FileSystem from 'expo-file-system/legacy';
import * as Network from 'expo-network';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { api } from '@/src/api/client';

const VIDEO_CACHE_DIR = `${FileSystem.documentDirectory}videos/`;
const OFFLINE_DATA_KEY = '@offline_data';
const LAST_SYNC_KEY = '@last_sync_at';
const DOWNLOAD_PROGRESS_KEY = '@download_progress';

// ─── 类型定义 ────────────────────────────────────────────

export interface DownloadProgress {
  actionId: number;
  videoUrl: string;
  resumeData: string;
  progress: number;
  timestamp: number;
}

export interface OfflineTrainingRecord {
  action_id: number;
  phase: string;
  planned_sets: number;
  planned_reps: string;
  actual_sets: number;
  actual_reps: string;
  is_completed: boolean;
  is_skipped: boolean;
  difficulty_feedback?: number;
  user_notes?: string;
  pain_reported: boolean;
}

export interface OfflineTrainingSession {
  local_id: string;
  plan_id: number;
  plan_day_id: number;
  pre_check_status: string;
  started_at: string;
  ended_at?: string;
  records: OfflineTrainingRecord[];
  pain_info?: any;
}

export interface OfflineCheckin {
  local_id: string;
  checkin_date: string;
  local_session_id: string;
}

export interface OfflineData {
  training_sessions: OfflineTrainingSession[];
  checkins: OfflineCheckin[];
}

export interface VideoDownloadInfo {
  action_id: number;
  action_name: string;
  video_url: string;
  local_path?: string;
  downloaded: boolean;
  size?: number;
}

// ─── 网络状态检测 ────────────────────────────────────────

export async function isOnline(): Promise<boolean> {
  try {
    const state = await Network.getNetworkStateAsync();
    return state.isConnected === true && state.isInternetReachable === true;
  } catch {
    return false;
  }
}

// ─── 视频下载管理 ────────────────────────────────────────

/**
 * 保存下载进度
 */
async function saveDownloadProgress(actionId: number, videoUrl: string, resumeData: string, progress: number): Promise<void> {
  try {
    const allProgress = await getDownloadProgressMap();
    allProgress[actionId] = {
      actionId,
      videoUrl,
      resumeData,
      progress,
      timestamp: Date.now(),
    };
    await AsyncStorage.setItem(DOWNLOAD_PROGRESS_KEY, JSON.stringify(allProgress));
  } catch (error) {
    console.error('保存下载进度失败:', error);
  }
}

/**
 * 获取所有下载进度
 */
async function getDownloadProgressMap(): Promise<Record<number, DownloadProgress>> {
  try {
    const json = await AsyncStorage.getItem(DOWNLOAD_PROGRESS_KEY);
    if (!json) return {};
    return JSON.parse(json);
  } catch {
    return {};
  }
}

/**
 * 获取单个视频的下载进度
 */
async function getDownloadProgress(actionId: number): Promise<DownloadProgress | null> {
  const allProgress = await getDownloadProgressMap();
  return allProgress[actionId] || null;
}

/**
 * 清除下载进度
 */
async function clearDownloadProgress(actionId: number): Promise<void> {
  try {
    const allProgress = await getDownloadProgressMap();
    delete allProgress[actionId];
    await AsyncStorage.setItem(DOWNLOAD_PROGRESS_KEY, JSON.stringify(allProgress));
  } catch (error) {
    console.error('清除下载进度失败:', error);
  }
}

/**
 * 确保视频缓存目录存在
 */
async function ensureVideoCacheDir(): Promise<void> {
  const dirInfo = await FileSystem.getInfoAsync(VIDEO_CACHE_DIR);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(VIDEO_CACHE_DIR, { intermediates: true });
  }
}

/**
 * 获取视频本地路径
 */
export function getVideoLocalPath(actionId: number): string {
  return `${VIDEO_CACHE_DIR}action_${actionId}.mp4`;
}

/**
 * 检查视频是否已下载
 */
export async function isVideoDownloaded(actionId: number): Promise<boolean> {
  const localPath = getVideoLocalPath(actionId);
  const info = await FileSystem.getInfoAsync(localPath);
  return info.exists;
}

/**
 * 下载单个视频（支持断点续传）
 */
export async function downloadVideo(
  actionId: number,
  videoUrl: string,
  onProgress?: (progress: number) => void,
  maxRetries: number = 3
): Promise<string> {
  await ensureVideoCacheDir();
  const localPath = getVideoLocalPath(actionId);

  // 如果已存在，直接返回
  if (await isVideoDownloaded(actionId)) {
    await clearDownloadProgress(actionId);
    return localPath;
  }

  let downloadResumable: FileSystem.DownloadResumable;
  let retryCount = 0;

  // 尝试恢复之前的下载
  const savedProgress = await getDownloadProgress(actionId);
  if (savedProgress && savedProgress.videoUrl === videoUrl && savedProgress.resumeData) {
    try {
      downloadResumable = new FileSystem.DownloadResumable(
        videoUrl,
        localPath,
        {},
        (downloadProgress) => {
          const progress = downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite;
          onProgress?.(progress);
        },
        savedProgress.resumeData
      );
    } catch (error) {
      console.warn('恢复下载失败，将重新开始:', error);
      downloadResumable = FileSystem.createDownloadResumable(
        videoUrl,
        localPath,
        {},
        (downloadProgress) => {
          const progress = downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite;
          onProgress?.(progress);
        }
      );
    }
  } else {
    downloadResumable = FileSystem.createDownloadResumable(
      videoUrl,
      localPath,
      {},
      (downloadProgress) => {
        const progress = downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite;
        onProgress?.(progress);
      }
    );
  }

  while (retryCount < maxRetries) {
    try {
      const result = await downloadResumable.downloadAsync();
      if (!result) {
        throw new Error('下载失败');
      }

      // 下载成功，清除进度记录
      await clearDownloadProgress(actionId);
      return result.uri;
    } catch (error: any) {
      retryCount++;
      console.error(`下载失败 (尝试 ${retryCount}/${maxRetries}):`, error);

      if (retryCount < maxRetries) {
        // 保存当前进度以便续传
        try {
          const resumeData = downloadResumable.savable();
          const progressSnapshot = await downloadResumable.pauseAsync();
          if (progressSnapshot && resumeData) {
            const progress = progressSnapshot.totalBytesWritten / progressSnapshot.totalBytesExpectedToWrite;
            await saveDownloadProgress(actionId, videoUrl, resumeData, progress);
          }
        } catch (saveError) {
          console.warn('保存下载进度失败:', saveError);
        }

        // 等待后重试
        await new Promise(resolve => setTimeout(resolve, 2000 * retryCount));

        // 尝试恢复下载
        try {
          const resumeData = downloadResumable.savable();
          if (resumeData) {
            downloadResumable = new FileSystem.DownloadResumable(
              videoUrl,
              localPath,
              {},
              (downloadProgress) => {
                const progress = downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite;
                onProgress?.(progress);
              },
              resumeData
            );
          }
        } catch (resumeError) {
          console.warn('恢复下载失败，将重新开始:', resumeError);
        }
      } else {
        // 达到最大重试次数，保存进度供用户手动重试
        try {
          const resumeData = downloadResumable.savable();
          const progressSnapshot = await downloadResumable.pauseAsync();
          if (progressSnapshot && resumeData) {
            const progress = progressSnapshot.totalBytesWritten / progressSnapshot.totalBytesExpectedToWrite;
            await saveDownloadProgress(actionId, videoUrl, resumeData, progress);
          }
        } catch (saveError) {
          console.warn('保存下载进度失败:', saveError);
        }
        throw new Error(`下载失败，已重试${maxRetries}次: ${error.message || '未知错误'}`);
      }
    }
  }

  throw new Error('下载失败');
}

/**
 * 批量下载视频
 */
export async function downloadVideos(
  videos: Array<{ action_id: number; video_url: string }>,
  onProgress?: (current: number, total: number, failed: number) => void
): Promise<{ succeeded: number; failed: Array<{ action_id: number; error: string }> }> {
  let completed = 0;
  let failed: Array<{ action_id: number; error: string }> = [];
  const total = videos.length;

  for (const video of videos) {
    try {
      await downloadVideo(video.action_id, video.video_url);
      completed++;
      onProgress?.(completed, total, failed.length);
    } catch (error: any) {
      console.error(`下载视频失败 (action_id=${video.action_id}):`, error);
      failed.push({
        action_id: video.action_id,
        error: error.message || '下载失败',
      });
      onProgress?.(completed, total, failed.length);
    }
  }

  return { succeeded: completed, failed };
}

/**
 * 获取所有未完成的下载
 */
export async function getPendingDownloads(): Promise<DownloadProgress[]> {
  const allProgress = await getDownloadProgressMap();
  return Object.values(allProgress);
}

/**
 * 删除单个视频
 */
export async function deleteVideo(actionId: number): Promise<void> {
  const localPath = getVideoLocalPath(actionId);
  const info = await FileSystem.getInfoAsync(localPath);
  if (info.exists) {
    await FileSystem.deleteAsync(localPath);
  }
}

/**
 * 获取已下载视频列表
 */
export async function getDownloadedVideos(): Promise<number[]> {
  await ensureVideoCacheDir();
  const files = await FileSystem.readDirectoryAsync(VIDEO_CACHE_DIR);
  const actionIds: number[] = [];

  for (const file of files) {
    const match = file.match(/^action_(\d+)\.mp4$/);
    if (match) {
      actionIds.push(parseInt(match[1], 10));
    }
  }

  return actionIds;
}

/**
 * 获取视频缓存总大小（字节）
 */
export async function getVideoCacheSize(): Promise<number> {
  await ensureVideoCacheDir();
  const files = await FileSystem.readDirectoryAsync(VIDEO_CACHE_DIR);
  let totalSize = 0;

  for (const file of files) {
    const filePath = `${VIDEO_CACHE_DIR}${file}`;
    const info = await FileSystem.getInfoAsync(filePath, { size: true });
    if (info.exists && 'size' in info) {
      totalSize += info.size || 0;
    }
  }

  return totalSize;
}

/**
 * 清空所有视频缓存
 */
export async function clearVideoCache(): Promise<void> {
  const dirInfo = await FileSystem.getInfoAsync(VIDEO_CACHE_DIR);
  if (dirInfo.exists) {
    await FileSystem.deleteAsync(VIDEO_CACHE_DIR, { idempotent: true });
  }
}

// ─── 离线数据管理 ────────────────────────────────────────

/**
 * 获取离线数据
 */
export async function getOfflineData(): Promise<OfflineData> {
  try {
    const json = await AsyncStorage.getItem(OFFLINE_DATA_KEY);
    if (!json) {
      return { training_sessions: [], checkins: [] };
    }
    return JSON.parse(json);
  } catch {
    return { training_sessions: [], checkins: [] };
  }
}

/**
 * 保存离线数据
 */
export async function saveOfflineData(data: OfflineData): Promise<void> {
  await AsyncStorage.setItem(OFFLINE_DATA_KEY, JSON.stringify(data));
}

/**
 * 添加离线训练会话
 */
export async function addOfflineSession(session: OfflineTrainingSession): Promise<void> {
  const data = await getOfflineData();
  data.training_sessions.push(session);
  await saveOfflineData(data);
}

/**
 * 添加离线打卡记录
 */
export async function addOfflineCheckin(checkin: OfflineCheckin): Promise<void> {
  const data = await getOfflineData();
  data.checkins.push(checkin);
  await saveOfflineData(data);
}

/**
 * 清空离线数据
 */
export async function clearOfflineData(): Promise<void> {
  await AsyncStorage.removeItem(OFFLINE_DATA_KEY);
}

// ─── 数据同步 ────────────────────────────────────────────

interface ApiEnvelope<T> {
  code: number;
  message: string;
  data: T | null;
}

interface SyncUploadResponse {
  synced_sessions: Array<{ local_id: string; server_id: number }>;
  synced_checkins: Array<{ local_id: string; server_id: number }>;
  errors: string[];
}

/**
 * 上传离线数据到服务器
 */
export async function syncUpload(): Promise<SyncUploadResponse> {
  const data = await getOfflineData();

  if (data.training_sessions.length === 0 && data.checkins.length === 0) {
    return { synced_sessions: [], synced_checkins: [], errors: [] };
  }

  const res = await api.post<ApiEnvelope<SyncUploadResponse>>('/sync/upload', data);

  if (res.data.code !== 0 || !res.data.data) {
    throw new Error(res.data.message || '同步失败');
  }

  // 同步成功后清空本地离线数据
  await clearOfflineData();

  // 更新最后同步时间
  await AsyncStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());

  return res.data.data;
}

/**
 * 从服务器拉取最新数据
 */
export async function syncPull(): Promise<any> {
  const lastSyncAt = await AsyncStorage.getItem(LAST_SYNC_KEY);

  const res = await api.get<ApiEnvelope<any>>('/sync/pull', {
    params: lastSyncAt ? { last_sync_at: lastSyncAt } : {},
  });

  if (res.data.code !== 0 || !res.data.data) {
    throw new Error(res.data.message || '拉取数据失败');
  }

  // 更新最后同步时间
  await AsyncStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());

  return res.data.data;
}

/**
 * 自动同步（如果在线）
 */
export async function autoSync(): Promise<void> {
  if (!(await isOnline())) {
    return;
  }

  try {
    await syncUpload();
    await syncPull();
  } catch (error) {
    console.error('自动同步失败:', error);
  }
}
