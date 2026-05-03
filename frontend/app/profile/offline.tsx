import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import * as offlineService from '@/src/services/offlineService';
import * as planApi from '@/src/services/planApi';
import { logger } from '@/src/utils/logger';

export default function OfflineManagementScreen() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];

  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [cacheSize, setCacheSize] = useState(0);
  const [downloadedCount, setDownloadedCount] = useState(0);
  const [offlineDataCount, setOfflineDataCount] = useState(0);
  const [downloadProgress, setDownloadProgress] = useState({ current: 0, total: 0 });

  const loadStatus = useCallback(async () => {
    setLoading(true);
    try {
      const [online, size, downloaded, offlineData] = await Promise.all([
        offlineService.isOnline(),
        offlineService.getVideoCacheSize(),
        offlineService.getDownloadedVideos(),
        offlineService.getOfflineData(),
      ]);

      setIsOnline(online);
      setCacheSize(size);
      setDownloadedCount(downloaded.length);
      setOfflineDataCount(
        offlineData.training_sessions.length + offlineData.checkins.length
      );
    } catch (error) {
      logger.error('加载状态失败:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadStatus();
    }, [loadStatus])
  );

  const handleDownloadPlanVideos = async () => {
    try {
      // 获取当前训练计划
      const plan = await planApi.getCurrentPlan();
      if (!plan) {
        Alert.alert('提示', '暂无训练计划，无法下载视频');
        return;
      }

      // 收集所有需要下载的视频
      const videos: Array<{ action_id: number; video_url: string }> = [];
      const seen = new Set<number>();

      for (const day of plan.days) {
        for (const exercise of day.exercises) {
          if (!seen.has(exercise.action_id) && exercise.video_url) {
            seen.add(exercise.action_id);
            videos.push({
              action_id: exercise.action_id,
              video_url: exercise.video_url,
            });
          }
        }
      }

      if (videos.length === 0) {
        Alert.alert('提示', '当前计划没有视频需要下载');
        return;
      }

      // 过滤已下载的视频
      const downloaded = await offlineService.getDownloadedVideos();
      const downloadedSet = new Set(downloaded);
      const toDownload = videos.filter((v) => !downloadedSet.has(v.action_id));

      if (toDownload.length === 0) {
        Alert.alert('提示', '所有视频已下载');
        return;
      }

      Alert.alert(
        '下载视频',
        `将下载 ${toDownload.length} 个视频，建议在 Wi-Fi 环境下进行。是否继续？`,
        [
          { text: '取消', style: 'cancel' },
          {
            text: '下载',
            onPress: async () => {
              setDownloading(true);
              setDownloadProgress({ current: 0, total: toDownload.length });
              try {
                await offlineService.downloadVideos(toDownload, (current, total) => {
                  setDownloadProgress({ current, total });
                });
                Alert.alert('成功', '视频下载完成');
                await loadStatus();
              } catch (error) {
                Alert.alert('下载失败', error instanceof Error ? error.message : '请重试');
              } finally {
                setDownloading(false);
                setDownloadProgress({ current: 0, total: 0 });
              }
            },
          },
        ]
      );
    } catch (error) {
      Alert.alert('错误', error instanceof Error ? error.message : '获取训练计划失败');
    }
  };

  const handleClearCache = () => {
    Alert.alert('清空缓存', '确定要删除所有已下载的视频吗？', [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: async () => {
          try {
            await offlineService.clearVideoCache();
            Alert.alert('成功', '视频缓存已清空');
            await loadStatus();
          } catch (error) {
            Alert.alert('失败', error instanceof Error ? error.message : '清空失败');
          }
        },
      },
    ]);
  };

  const handleSync = async () => {
    if (!isOnline) {
      Alert.alert('提示', '当前无网络连接，无法同步数据');
      return;
    }

    if (offlineDataCount === 0) {
      Alert.alert('提示', '没有需要同步的离线数据');
      return;
    }

    setSyncing(true);
    try {
      const result = await offlineService.syncUpload();
      const successCount =
        result.synced_sessions.length + result.synced_checkins.length;
      const errorCount = result.errors.length;

      if (errorCount > 0) {
        // 分类显示错误
        const errorMessages = result.errors.map((err, idx) => `${idx + 1}. ${err}`).join('\n');
        Alert.alert(
          '同步部分完成',
          `✓ 成功同步: ${successCount} 条\n✗ 失败: ${errorCount} 条\n\n失败原因：\n${errorMessages}\n\n建议：\n• 检查网络连接\n• 稍后重试同步`,
          [{ text: '知道了' }]
        );
      } else {
        Alert.alert('同步成功', `✓ 已成功同步 ${successCount} 条数据到服务器`, [{ text: '好的' }]);
      }

      await loadStatus();
    } catch (error) {
      let errorMessage = '同步失败';
      let errorDetail = '';

      if (error && typeof error === 'object' && 'response' in error) {
        // HTTP错误
        const response = (error as { response?: { status?: number } }).response;
        const status = response?.status;
        if (status === 401) {
          errorDetail = '登录已过期，请重新登录';
        } else if (status === 403) {
          errorDetail = '没有权限执行此操作';
        } else if (status === 500) {
          errorDetail = '服务器内部错误，请稍后重试';
        } else if (status && status >= 400 && status < 500) {
          errorDetail = '请求数据格式错误';
        } else if (status) {
          errorDetail = `服务器错误 (${status})`;
        }
      } else if (error instanceof Error) {
        if (error.message.includes('Network')) {
          errorDetail = '网络连接失败，请检查网络设置';
        } else if (error.message.includes('timeout')) {
          errorDetail = '请求超时，请检查网络连接';
        } else {
          errorDetail = error.message;
        }
      } else {
        errorDetail = '未知错误，请重试';
      }

      Alert.alert(
        errorMessage,
        `${errorDetail}\n\n建议：\n• 确保网络连接正常\n• 检查是否已登录\n• 稍后重试`,
        [{ text: '知道了' }]
      );
    } finally {
      setSyncing(false);
    }
  };

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={[styles.title, { color: theme.text }]}>离线模式管理</Text>

        {/* 网络状态 */}
        <View style={[styles.card, { borderColor: theme.tabIconDefault }]}>
          <View style={styles.row}>
            <FontAwesome
              name={isOnline ? 'wifi' : 'chain-broken'}
              size={20}
              color={isOnline ? '#4caf50' : '#f44336'}
            />
            <Text style={[styles.label, { color: theme.text }]}>网络状态</Text>
            <Text style={[styles.value, { color: isOnline ? '#4caf50' : '#f44336' }]}>
              {isOnline ? '在线' : '离线'}
            </Text>
          </View>
        </View>

        {/* 视频缓存 */}
        <Text style={[styles.sectionTitle, { color: theme.text }]}>视频缓存</Text>
        <View style={[styles.card, { borderColor: theme.tabIconDefault }]}>
          <View style={styles.row}>
            <FontAwesome name="video-camera" size={18} color={theme.tint} />
            <Text style={[styles.label, { color: theme.text }]}>已下载视频</Text>
            <Text style={[styles.value, { color: theme.text }]}>{downloadedCount} 个</Text>
          </View>
          <View style={[styles.divider, { backgroundColor: theme.tabIconDefault }]} />
          <View style={styles.row}>
            <FontAwesome name="hdd-o" size={18} color={theme.tint} />
            <Text style={[styles.label, { color: theme.text }]}>缓存大小</Text>
            <Text style={[styles.value, { color: theme.text }]}>{formatSize(cacheSize)}</Text>
          </View>

          {downloading && (
            <>
              <View style={[styles.divider, { backgroundColor: theme.tabIconDefault }]} />
              <View style={styles.progressWrap}>
                <Text style={[styles.progressText, { color: theme.text }]}>
                  下载中: {downloadProgress.current}/{downloadProgress.total}
                </Text>
                <View style={[styles.progressBg, { backgroundColor: `${theme.tint}22` }]}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        backgroundColor: theme.tint,
                        width: `${downloadProgress.total > 0 ? (downloadProgress.current / downloadProgress.total) * 100 : 0}%`,
                      },
                    ]}
                  />
                </View>
              </View>
            </>
          )}

          <View style={styles.btnRow}>
            <Pressable
              style={[styles.btn, { backgroundColor: theme.tint }, downloading && styles.btnDisabled]}
              onPress={handleDownloadPlanVideos}
              disabled={downloading}
            >
              {downloading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <FontAwesome name="download" size={14} color="#fff" />
                  <Text style={styles.btnText}>下载计划视频</Text>
                </>
              )}
            </Pressable>
            <Pressable
              style={[styles.btnOutline, { borderColor: theme.tint }]}
              onPress={handleClearCache}
              disabled={downloading}
            >
              <FontAwesome name="trash-o" size={14} color={theme.tint} />
              <Text style={[styles.btnOutlineText, { color: theme.tint }]}>清空缓存</Text>
            </Pressable>
          </View>
        </View>

        {/* 离线数据同步 */}
        <Text style={[styles.sectionTitle, { color: theme.text }]}>离线数据同步</Text>
        <View style={[styles.card, { borderColor: theme.tabIconDefault }]}>
          <View style={styles.row}>
            <FontAwesome name="database" size={18} color={theme.tint} />
            <Text style={[styles.label, { color: theme.text }]}>待同步数据</Text>
            <Text style={[styles.value, { color: theme.text }]}>{offlineDataCount} 条</Text>
          </View>

          <Pressable
            style={[
              styles.btn,
              { backgroundColor: theme.tint, marginTop: 12 },
              (syncing || !isOnline || offlineDataCount === 0) && styles.btnDisabled,
            ]}
            onPress={handleSync}
            disabled={syncing || !isOnline || offlineDataCount === 0}
          >
            {syncing ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <FontAwesome name="refresh" size={14} color="#fff" />
                <Text style={styles.btnText}>立即同步</Text>
              </>
            )}
          </Pressable>

          {!isOnline && (
            <Text style={[styles.hint, { color: '#f44336' }]}>
              当前离线，无法同步数据
            </Text>
          )}
        </View>

        {/* 说明 */}
        <View style={[styles.infoCard, { backgroundColor: `${theme.tint}11` }]}>
          <FontAwesome name="info-circle" size={16} color={theme.tint} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.infoText, { color: theme.text }]}>
              • 下载视频后可在无网络环境下进行训练{'\n'}
              • 离线训练数据会自动保存在本地{'\n'}
              • 恢复网络后会自动同步到服务器{'\n'}
              • AI语音互动功能需要网络连接
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { padding: 16, paddingBottom: 40 },
  title: { fontSize: 22, fontWeight: '800', marginBottom: 16 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    opacity: 0.5,
    marginTop: 16,
    marginBottom: 8,
    marginLeft: 4,
  },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
  },
  label: { flex: 1, fontSize: 15, fontWeight: '500' },
  value: { fontSize: 15, fontWeight: '700' },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 8 },
  progressWrap: { marginTop: 8, gap: 6 },
  progressText: { fontSize: 13, opacity: 0.7 },
  progressBg: { height: 6, borderRadius: 999, overflow: 'hidden' },
  progressFill: { height: 6, borderRadius: 999 },
  btnRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  btn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 10,
  },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  btnOutline: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  btnOutlineText: { fontSize: 14, fontWeight: '700' },
  hint: { fontSize: 12, textAlign: 'center', marginTop: 8, opacity: 0.7 },
  infoCard: {
    flexDirection: 'row',
    gap: 10,
    padding: 14,
    borderRadius: 12,
    marginTop: 8,
  },
  infoText: { fontSize: 13, lineHeight: 20, opacity: 0.85 },
});
