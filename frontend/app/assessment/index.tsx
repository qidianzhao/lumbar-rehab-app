import FontAwesome from '@expo/vector-icons/FontAwesome';
import { type Href, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';

export default function AssessmentIntroScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.header}>
        <FontAwesome name="clipboard" size={44} color={theme.tint} />
        <Text style={[styles.title, { color: theme.text }]}>体能测试与评估</Text>
        <Text style={[styles.sub, { color: theme.text }]}>
          约 15 分钟 · 6 个动作 · 用于生成更适合你的训练计划
        </Text>
      </View>

      <View style={[styles.card, { borderColor: theme.tabIconDefault }]}>
        <Text style={[styles.cardTitle, { color: theme.text }]}>注意事项</Text>
        <Text style={[styles.item, { color: theme.text }]}>- 量力而行，不追求极限</Text>
        <Text style={[styles.item, { color: theme.text }]}>- 不适/疼痛明显请立即停止</Text>
        <Text style={[styles.item, { color: theme.text }]}>- 动作保持标准姿势，宁少勿乱</Text>
      </View>

      <Pressable
        style={[styles.btn, { backgroundColor: theme.tint }]}
        onPress={() => router.push('/assessment/test' as Href)}
      >
        <Text style={styles.btnText}>开始测试</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, justifyContent: 'center' },
  header: { alignItems: 'center', marginBottom: 22, gap: 8 },
  title: { fontSize: 22, fontWeight: '800' },
  sub: { fontSize: 14, opacity: 0.8, textAlign: 'center', lineHeight: 20 },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 14,
    marginBottom: 22,
  },
  cardTitle: { fontSize: 16, fontWeight: '700', marginBottom: 8 },
  item: { fontSize: 14, lineHeight: 20, opacity: 0.9 },
  btn: { paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  btnText: { color: '#fff', fontSize: 17, fontWeight: '800' },
});
