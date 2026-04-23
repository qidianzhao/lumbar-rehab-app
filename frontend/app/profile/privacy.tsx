import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';

export default function PrivacyScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <FontAwesome name="chevron-left" size={16} color={theme.tint} />
        </Pressable>
        <Text style={[styles.title, { color: theme.text }]}>隐私政策</Text>
        <View style={{ width: 32 }} />
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={[styles.body, { color: theme.text }]}>
          本应用仅收集您的手机号码用于账号注册与登录，以及您主动填写的健康档案信息（身高、体重、腰椎情况等）和训练数据。{'\n\n'}
          所有数据仅用于为您提供个性化康复训练计划，不会出售或共享给第三方。{'\n\n'}
          您可以随时在「数据导出」页面导出或删除您的数据。{'\n\n'}
          如有疑问，请联系我们：support@ldh-app.com
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
