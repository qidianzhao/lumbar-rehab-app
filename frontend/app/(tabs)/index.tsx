import FontAwesome from '@expo/vector-icons/FontAwesome';
import { type Href, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';

type QuickEntry = {
  icon: React.ComponentProps<typeof FontAwesome>['name'];
  label: string;
  sub: string;
  href: Href;
};

const ENTRIES: QuickEntry[] = [
  {
    icon: 'clipboard',
    label: '体能测试',
    sub: '评估6项动作，生成专属计划',
    href: '/assessment' as Href,
  },
  {
    icon: 'list-alt',
    label: '训练计划',
    sub: '查看和执行当前训练计划',
    href: '/(tabs)/plans' as Href,
  },
  {
    icon: 'user',
    label: '个人中心',
    sub: '健康档案与设置',
    href: '/(tabs)/profile' as Href,
  },
];

export default function HomeScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top']}>
      <View style={styles.container}>
        <Text style={[styles.title, { color: theme.text }]}>腰突康复运动</Text>
        <Text style={[styles.sub, { color: theme.text }]}>选择一项开始</Text>

        {ENTRIES.map((entry) => (
          <Pressable
            key={entry.href as string}
            style={[styles.card, { borderColor: theme.tabIconDefault }]}
            onPress={() => router.push(entry.href)}
          >
            <View style={[styles.iconWrap, { backgroundColor: `${theme.tint}18` }]}>
              <FontAwesome name={entry.icon} size={24} color={theme.tint} />
            </View>
            <View style={styles.cardText}>
              <Text style={[styles.cardLabel, { color: theme.text }]}>{entry.label}</Text>
              <Text style={[styles.cardSub, { color: theme.text }]}>{entry.sub}</Text>
            </View>
            <FontAwesome name="chevron-right" size={14} color={theme.tabIconDefault} />
          </Pressable>
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { flex: 1, padding: 24 },
  title: { fontSize: 24, fontWeight: '800', marginBottom: 4 },
  sub: { fontSize: 14, opacity: 0.6, marginBottom: 24 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    gap: 14,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardText: { flex: 1 },
  cardLabel: { fontSize: 16, fontWeight: '700' },
  cardSub: { fontSize: 13, opacity: 0.6, marginTop: 2 },
});
