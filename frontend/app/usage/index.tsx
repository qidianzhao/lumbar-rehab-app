import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { Stack } from 'expo-router';
import { LineChart } from 'react-native-chart-kit';
import { getUserUsageStats } from '@/src/services/chatApi';
import type { UsageStats } from '@/src/services/chatApi';

const screenWidth = Dimensions.get('window').width;

const usageTypeLabels: Record<string, string> = {
  free_chat: '自由对话',
  training_chat: '训练对话',
  assessment: '体能评估',
  plan_generation: '计划生成',
  training_summary: '训练总结',
};

export default function UsageStatsScreen() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getUserUsageStats(7);
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'AI用量统计' }} />
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>加载中...</Text>
        </View>
      </View>
    );
  }

  if (error || !stats) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'AI用量统计' }} />
        <View style={styles.centerContent}>
          <Text style={styles.errorText}>{error || '加载失败'}</Text>
        </View>
      </View>
    );
  }

  // 准备图表数据
  const chartData = {
    labels: stats.daily.map((d) => {
      const date = new Date(d.date);
      return `${date.getMonth() + 1}/${date.getDate()}`;
    }),
    datasets: [
      {
        data: stats.daily.map((d) => d.count),
        color: (opacity = 1) => `rgba(0, 122, 255, ${opacity})`,
        strokeWidth: 2,
      },
    ],
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'AI用量统计' }} />
      <ScrollView style={styles.scrollView}>
        {/* 总览卡片 */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>总调用次数</Text>
          <Text style={styles.bigNumber}>{stats.total_calls}</Text>
          <View style={styles.tokenRow}>
            <View style={styles.tokenItem}>
              <Text style={styles.tokenLabel}>输入Token</Text>
              <Text style={styles.tokenValue}>{stats.total_input_tokens.toLocaleString()}</Text>
            </View>
            <View style={styles.tokenItem}>
              <Text style={styles.tokenLabel}>输出Token</Text>
              <Text style={styles.tokenValue}>{stats.total_output_tokens.toLocaleString()}</Text>
            </View>
          </View>
        </View>

        {/* 趋势图 */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>最近7天趋势</Text>
          {stats.daily.length > 0 ? (
            <LineChart
              data={chartData}
              width={screenWidth - 48}
              height={220}
              chartConfig={{
                backgroundColor: '#ffffff',
                backgroundGradientFrom: '#ffffff',
                backgroundGradientTo: '#ffffff',
                decimalPlaces: 0,
                color: (opacity = 1) => `rgba(0, 122, 255, ${opacity})`,
                labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                style: {
                  borderRadius: 16,
                },
                propsForDots: {
                  r: '4',
                  strokeWidth: '2',
                  stroke: '#007AFF',
                },
              }}
              bezier
              style={styles.chart}
            />
          ) : (
            <Text style={styles.emptyText}>暂无数据</Text>
          )}
        </View>

        {/* 按类型统计 */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>按类型统计</Text>
          {Object.entries(stats.by_type).length > 0 ? (
            <View style={styles.typeList}>
              {Object.entries(stats.by_type).map(([type, count]) => (
                <View key={type} style={styles.typeItem}>
                  <Text style={styles.typeName}>
                    {usageTypeLabels[type] || type}
                  </Text>
                  <Text style={styles.typeCount}>{count} 次</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.emptyText}>暂无数据</Text>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  errorText: {
    fontSize: 16,
    color: '#ff3b30',
  },
  card: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  bigNumber: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#007AFF',
    textAlign: 'center',
    marginBottom: 16,
  },
  tokenRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  tokenItem: {
    alignItems: 'center',
  },
  tokenLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  tokenValue: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
  },
  chart: {
    marginVertical: 8,
    borderRadius: 16,
  },
  typeList: {
    gap: 12,
  },
  typeItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  typeName: {
    fontSize: 16,
    color: '#333',
  },
  typeCount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 14,
    color: '#999',
    paddingVertical: 20,
  },
});
