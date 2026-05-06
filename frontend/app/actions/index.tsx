import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { handleError } from '@/src/utils/errorHandler';

const API = process.env.EXPO_PUBLIC_API_BASE ?? 'http://localhost:8000/api/v1';

type Action = {
  id: number;
  name: string;
  category: string;
  phase: string;
  difficulty_level: number;
  description: string | null;
  video_url: string | null;
  thumbnail_url: string | null;
};

const CATEGORY_CONFIG = [
  { key: 'core', label: '核心训练', icon: 'heartbeat', color: '#FF5722' },
  { key: 'stretch', label: '拉伸放松', icon: 'hand-peace-o', color: '#4CAF50' },
  { key: 'eye', label: '眼部保健', icon: 'eye', color: '#2196F3' },
  { key: 'warmup', label: '热身准备', icon: 'fire', color: '#FF9800' },
] as const;

export default function ActionsLibraryScreen() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [actions, setActions] = useState<Action[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`${API}/actions`);
        const data = await response.json();
        if (!cancelled) {
          setActions(data);
        }
      } catch (e) {
        if (!cancelled) {
          const errorInfo = handleError(e, '加载动作库失败');
          setError(errorInfo.message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useFocusEffect(load);

  // 按分类分组
  const groupedActions = CATEGORY_CONFIG.map((cat) => ({
    ...cat,
    actions: actions.filter((a) => (a.category || a.phase) === cat.key).slice(0, 4),
  }));

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={[styles.title, { color: theme.text }]}>动作库</Text>

        {loading && (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={theme.tint} />
            <Text style={[styles.loadingText, { color: theme.text }]}>加载中...</Text>
          </View>
        )}

        {!loading && error && (
          <View style={[styles.errorCard, { borderColor: theme.tabIconDefault }]}>
            <FontAwesome name="exclamation-circle" size={24} color="#e53935" />
            <Text style={[styles.errorText, { color: theme.text }]}>{error}</Text>
            <Pressable style={[styles.retryBtn, { backgroundColor: theme.tint }]} onPress={load}>
              <Text style={styles.retryText}>重试</Text>
            </Pressable>
          </View>
        )}

        {!loading && !error && (
          <View style={styles.categoryList}>
            {groupedActions.map((category) => (
              <View key={category.key} style={styles.categorySection}>
                <View style={styles.categoryHeader}>
                  <View style={styles.categoryTitleRow}>
                    <View style={[styles.categoryIcon, { backgroundColor: `${category.color}15` }]}>
                      <FontAwesome name={category.icon} size={20} color={category.color} />
                    </View>
                    <Text style={[styles.categoryTitle, { color: theme.text }]}>
                      {category.label}
                    </Text>
                  </View>
                  {category.actions.length > 0 && (
                    <Pressable
                      style={styles.moreBtn}
                      onPress={() => alert(`查看更多${category.label}`)}
                    >
                      <Text style={[styles.moreText, { color: theme.tint }]}>更多</Text>
                      <FontAwesome name="chevron-right" size={12} color={theme.tint} />
                    </Pressable>
                  )}
                </View>

                {category.actions.length === 0 ? (
                  <View style={[styles.emptyCategory, { borderColor: theme.tabIconDefault }]}>
                    <Text style={[styles.emptyText, { color: theme.text }]}>
                      暂无{category.label}动作
                    </Text>
                  </View>
                ) : (
                  <View style={styles.actionGrid}>
                    {category.actions.map((action) => (
                      <Pressable
                        key={action.id}
                        style={[styles.actionCard, { borderColor: theme.tabIconDefault }]}
                        onPress={() => alert(`播放：${action.name}`)}
                      >
                        <View style={[styles.thumbnail, { backgroundColor: theme.tabIconDefault + '20' }]}>
                          {action.thumbnail_url ? (
                            <Image
                              source={{ uri: action.thumbnail_url }}
                              style={styles.thumbnailImage}
                              resizeMode="cover"
                            />
                          ) : (
                            <FontAwesome name="play-circle" size={32} color={theme.tabIconDefault} />
                          )}
                        </View>

                        <Text style={[styles.actionName, { color: theme.text }]} numberOfLines={2}>
                          {action.name}
                        </Text>

                        <View style={styles.difficultyRow}>
                          {Array.from({ length: action.difficulty_level }).map((_, i) => (
                            <FontAwesome key={i} name="star" size={10} color={category.color} />
                          ))}
                        </View>
                      </Pressable>
                    ))}
                  </View>
                )}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { padding: 16, paddingBottom: 40 },
  title: { fontSize: 28, fontWeight: '700', marginBottom: 20 },
  loadingWrap: { alignItems: 'center', paddingVertical: 40, gap: 12 },
  loadingText: { fontSize: 14, opacity: 0.5 },
  errorCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: 24,
    alignItems: 'center',
    gap: 12,
  },
  errorText: { fontSize: 14, textAlign: 'center' },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, marginTop: 8 },
  retryText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  categoryList: { gap: 24 },
  categorySection: { gap: 12 },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  categoryTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  categoryIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryTitle: { fontSize: 18, fontWeight: '700' },
  moreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  moreText: { fontSize: 14, fontWeight: '600' },
  emptyCategory: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
  },
  emptyText: { fontSize: 14, opacity: 0.5 },
  actionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  actionCard: {
    width: '48%',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 10,
    gap: 8,
  },
  thumbnail: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  thumbnailImage: { width: '100%', height: '100%' },
  actionName: { fontSize: 14, fontWeight: '600', lineHeight: 18 },
  difficultyRow: { flexDirection: 'row', gap: 2 },
});

