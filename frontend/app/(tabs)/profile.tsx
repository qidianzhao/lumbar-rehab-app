import FontAwesome from '@expo/vector-icons/FontAwesome';
import { type Href, useRouter } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useAuthStore } from '@/src/stores/authStore';

type MenuItem = {
  icon: React.ComponentProps<typeof FontAwesome>['name'];
  label: string;
  sub?: string;
  href?: Href;
  onPress?: () => void;
  disabled?: boolean;
};

type MenuGroup = {
  title: string;
  items: MenuItem[];
};

export default function TabProfileScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];

  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const onLogout = () => {
    Alert.alert('退出登录', '确定要退出吗？', [
      { text: '取消', style: 'cancel' },
      {
        text: '退出',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/(auth)/login' as Href);
        },
      },
    ]);
  };

  const groups: MenuGroup[] = [
    {
      title: '训练',
      items: [
        {
          icon: 'heartbeat',
          label: '体能测试',
          sub: '评估6项动作',
          href: '/assessment' as Href,
        },
        {
          icon: 'list-alt',
          label: '训练记录',
          sub: '查看历史训练',
          href: '/(tabs)/records' as Href,
        },
        {
          icon: 'calendar-check-o',
          label: '打卡日历',
          sub: '连续打卡记录',
          href: '/checkin/calendar' as Href,
        },
        {
          icon: 'trophy',
          label: '排行榜',
          sub: '周/月/年打卡排名',
          href: '/checkin/leaderboard' as Href,
        },
      ],
    },
    {
      title: '个人资料',
      items: [
        {
          icon: 'user-md',
          label: '运动档案',
          sub: '身体信息与腰椎情况',
          href: '/profile/health-profile' as Href,
        },
        {
          icon: 'download',
          label: '数据导出',
          sub: '导出训练数据为 PDF',
          href: '/profile/export' as Href,
        },
      ],
    },
    {
      title: '设置',
      items: [
        {
          icon: 'cog',
          label: '应用设置',
          sub: '通知与偏好',
          href: '/profile/settings' as Href,
        },
        {
          icon: 'sign-out',
          label: '退出登录',
          onPress: onLogout,
        },
      ],
    },
  ];

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>

        {/* 用户信息卡 */}
        <View style={[styles.userCard, { borderColor: theme.tabIconDefault }]}>
          <View style={[styles.avatar, { backgroundColor: `${theme.tint}22` }]}>
            <FontAwesome name="user" size={32} color={theme.tint} />
          </View>
          <View style={styles.userInfo}>
            <Text style={[styles.userName, { color: theme.text }]}>
              {user?.phone ? `用户 ${user.phone.slice(-4)}` : '未登录'}
            </Text>
            <Text style={[styles.userSub, { color: theme.text }]}>
              账号：{user?.phone ?? '—'}
            </Text>
          </View>
        </View>

        {/* 菜单分组 */}
        {groups.map((group) => (
          <View key={group.title} style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>{group.title}</Text>
            <View style={[styles.card, { borderColor: theme.tabIconDefault }]}>
              {group.items.map((item, idx) => (
                <View key={item.label}>
                  {idx > 0 && <View style={[styles.divider, { backgroundColor: theme.tabIconDefault }]} />}
                  <Pressable
                    style={[styles.menuItem, item.disabled && styles.menuItemDisabled]}
                    disabled={item.disabled}
                    onPress={() => {
                      if (item.onPress) { item.onPress(); return; }
                      if (item.href) router.push(item.href);
                    }}
                  >
                    <View style={[styles.iconWrap, { backgroundColor: `${theme.tint}15` }]}>
                      <FontAwesome name={item.icon} size={16} color={item.disabled ? theme.tabIconDefault : theme.tint} />
                    </View>
                    <View style={styles.menuText}>
                      <Text style={[styles.menuLabel, { color: item.disabled ? theme.tabIconDefault : theme.text }]}>
                        {item.label}
                      </Text>
                      {item.sub && (
                        <Text style={[styles.menuSub, { color: theme.text }]}>{item.sub}</Text>
                      )}
                    </View>
                    {!item.disabled && (
                      <FontAwesome name="chevron-right" size={12} color={theme.tabIconDefault} />
                    )}
                  </Pressable>
                </View>
              ))}
            </View>
          </View>
        ))}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { padding: 16, paddingBottom: 40 },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: 16,
    gap: 14,
    marginBottom: 20,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userInfo: { flex: 1, gap: 4 },
  userName: { fontSize: 17, fontWeight: '700' },
  userSub: { fontSize: 13, opacity: 0.5 },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 13, fontWeight: '600', opacity: 0.5, marginBottom: 8, marginLeft: 4 },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  menuItemDisabled: { opacity: 0.5 },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuText: { flex: 1, gap: 2 },
  menuLabel: { fontSize: 15, fontWeight: '600' },
  menuSub: { fontSize: 12, opacity: 0.5 },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 60 },
});
