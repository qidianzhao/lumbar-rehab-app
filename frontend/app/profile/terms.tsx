import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';

export default function TermsScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <FontAwesome name="chevron-left" size={16} color={theme.tint} />
        </Pressable>
        <Text style={[styles.title, { color: theme.text }]}>用户协议</Text>
        <View style={{ width: 32 }} />
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={[styles.body, { color: theme.text }]}>
          欢迎使用腰突康复运动 App。使用本应用即表示您同意以下条款：{'\n\n'}
          1. 本应用提供的训练计划仅供参考，不构成医疗建议。如有严重症状，请及时就医。{'\n\n'}
          2. 您需对自己的训练安全负责，训练前请确认身体状况。{'\n\n'}
          3. 禁止将本应用用于任何商业目的或非法用途。{'\n\n'}
          4. 我们保留随时修改服务条款的权利，修改后继续使用即视为同意。{'\n\n'}
          如有疑问，请联系：support@ldh-app.com
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
  body: { fontSize: 15, lineHeight: 26 },
});
