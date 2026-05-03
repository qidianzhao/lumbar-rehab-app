import FontAwesome from '@expo/vector-icons/FontAwesome';
import { type Href, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { RadarChart } from '@/src/components/RadarChart';
import type { AssessmentReport } from '@/src/services/assessmentApi';
import * as assessmentApi from '@/src/services/assessmentApi';
import { handleError } from '@/src/utils/errorHandler';

const DIMENSION_ORDER: Array<{ key: string; label: string }> = [
  { key: 'core_endurance', label: '核心耐力' },
  { key: 'glute_strength', label: '臀部力量' },
  { key: 'spine_stability', label: '脊柱稳定' },
  { key: 'core_control', label: '核心控制' },
  { key: 'spine_mobility', label: '脊柱灵活' },
  { key: 'flexibility', label: '柔韧性' },
];

function levelLabel(level: string): string {
  if (level === 'BEGINNER') return '初级';
  if (level === 'INTERMEDIATE') return '中级';
  if (level === 'ADVANCED') return '高级';
  return level;
}

export default function AssessmentResultScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<AssessmentReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const latest = await assessmentApi.getLatest();
        if (!cancelled) {
          setReport(latest);
        }
      } catch (e) {
        if (!cancelled) {
          setError(handleError(e, '加载失败'));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params.id]);

  const chart = useMemo(() => {
    const scores = report?.scores ?? {};
    const labels = DIMENSION_ORDER.map((d) => d.label);
    const values = DIMENSION_ORDER.map((d) => Number(scores[d.key] ?? 0));
    return { labels, values };
  }, [report]);

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.tint} />
      </View>
    );
  }

  if (error || !report) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <Text style={{ color: theme.text }}>{error ?? '暂无评估结果'}</Text>
        <Pressable style={[styles.btn, { backgroundColor: theme.tint }]} onPress={() => router.replace('/assessment/result' as Href)}>
          <Text style={styles.btnText}>重试</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <FontAwesome name="check-circle" size={22} color={theme.tint} />
          <Text style={[styles.headerTitle, { color: theme.text }]}>评估完成</Text>
        </View>

        <View style={[styles.card, { borderColor: theme.tabIconDefault }]}>
          <Text style={[styles.level, { color: theme.tint }]}>
            综合评级：{levelLabel(report.overall_level)}
          </Text>
          <Text style={[styles.sub, { color: theme.text }]}>
            建议训练计划等级：{report.suggested_plan_level}
          </Text>
        </View>

        <View style={[styles.card, { borderColor: theme.tabIconDefault }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>维度得分</Text>
          <View style={{ alignItems: 'center', marginVertical: 10 }}>
            <RadarChart
              labels={chart.labels}
              values={chart.values}
              stroke={theme.tint}
              fill={`${theme.tint}33`}
              textColor={theme.text}
              size={300}
            />
          </View>
          <View style={styles.scoreList}>
            {DIMENSION_ORDER.map((d) => (
              <View key={d.key} style={styles.scoreRow}>
                <Text style={[styles.scoreLabel, { color: theme.text }]}>{d.label}</Text>
                <Text style={[styles.scoreValue, { color: theme.tint }]}>
                  {Number(report.scores[d.key] ?? 0)}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <View style={[styles.card, { borderColor: theme.tabIconDefault }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>薄弱环节</Text>
          <Text style={[styles.paragraph, { color: theme.text }]}>
            {report.weak_areas.length ? report.weak_areas.join('、') : '暂无'}
          </Text>
        </View>

        <View style={[styles.card, { borderColor: theme.tabIconDefault }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>AI 综合评价</Text>
          <Text style={[styles.paragraph, { color: theme.text }]}>{report.ai_summary}</Text>
        </View>
      </ScrollView>

      <View style={[styles.footer, { borderTopColor: theme.tabIconDefault, backgroundColor: theme.background }]}>
        <Pressable
          style={[styles.btnOutline, { borderColor: theme.tint }]}
          onPress={() => router.push('/assessment' as Href)}
        >
          <Text style={[styles.btnOutlineText, { color: theme.tint }]}>重新测试</Text>
        </Pressable>
        <Pressable
          style={[styles.btn, { backgroundColor: theme.tint }]}
          onPress={() => router.push('/plans/generate' as Href)}
        >
          <Text style={styles.btnText}>生成训练计划</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 12 },
  scroll: { padding: 16, paddingBottom: 140 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  headerTitle: { fontSize: 18, fontWeight: '800' },
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: 14, marginBottom: 12 },
  level: { fontSize: 18, fontWeight: '900', marginBottom: 6 },
  sub: { fontSize: 14, opacity: 0.85 },
  sectionTitle: { fontSize: 16, fontWeight: '800', marginBottom: 10 },
  paragraph: { fontSize: 14, lineHeight: 20, opacity: 0.9 },
  scoreList: { gap: 8, marginTop: 10 },
  scoreRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  scoreLabel: { fontSize: 14, fontWeight: '600', opacity: 0.9 },
  scoreValue: { fontSize: 14, fontWeight: '900' },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 16,
    paddingBottom: 28,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  btn: { paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '900' },
  btnOutline: { paddingVertical: 14, borderRadius: 12, borderWidth: 1, alignItems: 'center' },
  btnOutlineText: { fontSize: 16, fontWeight: '900' },
});
