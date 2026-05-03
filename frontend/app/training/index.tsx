import { type Href, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useTrainingStore } from '@/src/stores/trainingStore';

export default function TrainingIndexScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];

  const sessionId = useTrainingStore((s) => s.sessionId);
  const planDayTitle = useTrainingStore((s) => s.planDayTitle);
  const currentActionIndex = useTrainingStore((s) => s.currentActionIndex);
  const actions = useTrainingStore((s) => s.actions);
  const reset = useTrainingStore((s) => s.reset);

  const hasUnfinishedSession = sessionId && actions.length > 0 && currentActionIndex < actions.length;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Text style={[styles.title, { color: theme.text }]}>训练</Text>

      {hasUnfinishedSession ? (
        <>
          <View style={[styles.card, { borderColor: theme.tint, backgroundColor: `${theme.tint}11` }]}>
            <View style={styles.progressNotice}>
              <FontAwesome name="info-circle" size={20} color={theme.tint} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.progressTitle, { color: theme.tint }]}>
                  检测到未完成的训练
                </Text>
                <Text style={[styles.progressText, { color: theme.tint }]}>
                  {planDayTitle} - 第 {currentActionIndex + 1}/{actions.length} 个动作
                </Text>
              </View>
            </View>
          </View>

          <Pressable
            style={[styles.btn, { backgroundColor: theme.tint }]}
            onPress={() => router.push('/training/session' as Href)}
          >
            <Text style={styles.btnText}>继续训练</Text>
          </Pressable>

          <Pressable
            style={[styles.btnOutline, { borderColor: theme.tabIconDefault }]}
            onPress={() => {
              reset();
              router.push('/(tabs)/program' as Href);
            }}
          >
            <Text style={[styles.btnOutlineText, { color: theme.text }]}>放弃并重新开始</Text>
          </Pressable>
        </>
      ) : (
        <>
          <Text style={[styles.hint, { color: theme.text }]}>
            请从「计划详情」选择训练日开始；或下方入口仅作流程演示（需自行带上 plan 参数）。
          </Text>
          <Pressable style={[styles.btn, { backgroundColor: theme.tint }]} onPress={() => router.push('/(tabs)/program' as Href)}>
            <Text style={styles.btnText}>前往方案</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'center' },
  title: { fontSize: 22, fontWeight: '800', marginBottom: 12 },
  hint: { fontSize: 14, lineHeight: 20, opacity: 0.85, marginBottom: 20 },
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  progressNotice: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  progressTitle: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  progressText: { fontSize: 14, lineHeight: 20 },
  btn: { paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  btnOutline: { paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginTop: 12, borderWidth: 1 },
  btnOutlineText: { fontSize: 16, fontWeight: '700' },
});
