import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';

export default function AboutScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <FontAwesome name="chevron-left" size={16} color={theme.tint} />
        </Pressable>
        <Text style={[styles.title, { color: theme.text }]}>关于我们</Text>
        <View style={{ width: 32 }} />
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.logoWrap}>
          <FontAwesome name="heartbeat" size={48} color={theme.tint} />
          <Text style={[styles.appName, { color: theme.text }]}>腰突康复运动</Text>
          <Text style={[styles.version, { color: theme.text }]}>版本 1.0.0</Text>
        </View>
        <Text style={[styles.body, { color: theme.text }]}>
          腰突康复运动 App 专为腰椎间盘突出患者设计，提供科学、个性化的居家康复训练方案。{'\n\n'}
          我们的目标是帮助每一位患者通过系统训练改善症状、恢复日常生活能力。{'\n\n'}
          联系我们：support@ldh-app.com
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  backBtn: { width: 32, alignItems: 'flex-start' },
  title: { fontSize: 17, fontWeight: '700' },
  scroll: { padding: 20, paddingBottom: 40 },
  logoWrap: { alignItems: 'center', marginBottom: 32, gap: 8 },
  appName: { fontSize: 20, fontWeight: '800', marginTop: 8 },
  version: { fontSize: 13, opacity: 0.5 },
  body: { fontSize: 15, lineHeight: 26 },
});
