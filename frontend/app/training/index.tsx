import { type Href, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';

export default function TrainingIndexScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Text style={[styles.title, { color: theme.text }]}>训练</Text>
      <Text style={[styles.hint, { color: theme.text }]}>
        请从「计划详情」选择训练日开始；或下方入口仅作流程演示（需自行带上 plan 参数）。
      </Text>
      <Pressable style={[styles.btn, { backgroundColor: theme.tint }]} onPress={() => router.push('/(tabs)/plans' as Href)}>
        <Text style={styles.btnText}>前往计划</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'center' },
  title: { fontSize: 22, fontWeight: '800', marginBottom: 12 },
  hint: { fontSize: 14, lineHeight: 20, opacity: 0.85, marginBottom: 20 },
  btn: { paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
