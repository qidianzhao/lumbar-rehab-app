import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import {
  type AppSettings,
  type UserMe,
  clearCache,
  getCacheSize,
  getMe,
  loadSettings,
  saveSettings,
  updateMe,
} from '@/src/services/settingsService';

export default function SettingsScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cacheSize, setCacheSize] = useState('计算中...');
  const [clearingCache, setClearingCache] = useState(false);

  const [settings, setSettings] = useState<AppSettings>({
    pushEnabled: true,
    trainingReminderTime: '08:00',
    sedentaryEnabled: true,
    sedentaryInterval: 60,
  });
  const [userMe, setUserMe] = useState<UserMe | null>(null);
  const [intervalText, setIntervalText] = useState('60');

  useEffect(() => {
    void (async () => {
      const [s, me, size] = await Promise.all([loadSettings(), getMe().catch(() => null), getCacheSize()]);
      setSettings(s);
      setIntervalText(String(s.sedentaryInterval));
      setUserMe(me);
      setCacheSize(size);
      setLoading(false);
    })();
  }, []);

  async function handleToggle<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
    const next = { ...settings, [key]: value };
    setSettings(next);
    await saveSettings(next);
  }

  async function handleLeaderboardToggle(value: boolean) {
    if (!userMe) return;
    setSaving(true);
    try {
      const updated = await updateMe({ show_in_leaderboard: value });
      setUserMe(updated);
    } catch (e) {
      Alert.alert('保存失败', e instanceof Error ? e.message : '请稍后重试');
    } finally {
      setSaving(false);
    }
  }

  async function handleClearCache() {
    Alert.alert('清除缓存', '确定要清除所有缓存文件吗？', [
      { text: '取消', style: 'cancel' },
      {
        text: '清除',
        style: 'destructive',
        onPress: async () => {
          setClearingCache(true);
          try {
            await clearCache();
            setCacheSize('0 KB');
            Alert.alert('完成', '缓存已清除');
          } catch {
            Alert.alert('失败', '清除缓存失败，请重试');
          } finally {
            setClearingCache(false);
          }
        },
      },
    ]);
  }

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.tint} />
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <FontAwesome name="chevron-left" size={16} color={theme.tint} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.text }]}>设置</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>

        {/* 通知设置 */}
        <Text style={[styles.sectionTitle, { color: theme.text }]}>通知</Text>
        <View style={[styles.card, { borderColor: theme.tabIconDefault }]}>
          <RowSwitch
            label="推送通知"
            value={settings.pushEnabled}
            onValueChange={(v) => handleToggle('pushEnabled', v)}
            theme={theme}
          />
          <Divider color={theme.tabIconDefault} />
          <View style={styles.row}>
            <Text style={[styles.rowLabel, { color: theme.text }]}>训练提醒时间</Text>
            <TextInput
              style={[styles.timeInput, { color: theme.text, borderColor: theme.tabIconDefault }]}
              value={settings.trainingReminderTime}
              onChangeText={(v) => handleToggle('trainingReminderTime', v)}
              placeholder="08:00"
              placeholderTextColor={theme.tabIconDefault}
              maxLength={5}
            />
          </View>
          <Divider color={theme.tabIconDefault} />
          <RowSwitch
            label="久坐提醒"
            value={settings.sedentaryEnabled}
            onValueChange={(v) => handleToggle('sedentaryEnabled', v)}
            theme={theme}
          />
          <Divider color={theme.tabIconDefault} />
          <View style={styles.row}>
            <Text style={[styles.rowLabel, { color: theme.text }]}>久坐提醒间隔（分钟）</Text>
            <TextInput
              style={[styles.timeInput, { color: theme.text, borderColor: theme.tabIconDefault }]}
              value={intervalText}
              onChangeText={setIntervalText}
              onBlur={() => {
                const n = parseInt(intervalText, 10);
                const val = n > 0 ? n : 60;
                setIntervalText(String(val));
                void handleToggle('sedentaryInterval', val);
              }}
              keyboardType="number-pad"
              maxLength={3}
            />
          </View>
        </View>

        {/* 隐私 */}
        <Text style={[styles.sectionTitle, { color: theme.text }]}>隐私</Text>
        <View style={[styles.card, { borderColor: theme.tabIconDefault }]}>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowLabel, { color: theme.text }]}>参与排行榜</Text>
              <Text style={[styles.rowSub, { color: theme.text }]}>关闭后不显示在排行榜中</Text>
            </View>
            {saving ? (
              <ActivityIndicator size="small" color={theme.tint} />
            ) : (
              <Switch
                value={userMe?.show_in_leaderboard ?? true}
                onValueChange={handleLeaderboardToggle}
                trackColor={{ true: theme.tint }}
              />
            )}
          </View>
        </View>

        {/* 缓存管理 */}
        <Text style={[styles.sectionTitle, { color: theme.text }]}>存储</Text>
        <View style={[styles.card, { borderColor: theme.tabIconDefault }]}>
          <View style={styles.row}>
            <Text style={[styles.rowLabel, { color: theme.text }]}>缓存占用</Text>
            <Text style={[styles.rowValue, { color: theme.tabIconDefault }]}>{cacheSize}</Text>
          </View>
          <Divider color={theme.tabIconDefault} />
          <Pressable style={styles.row} onPress={handleClearCache} disabled={clearingCache}>
            {clearingCache ? (
              <ActivityIndicator size="small" color={theme.tint} />
            ) : (
              <Text style={[styles.rowLabel, { color: theme.tint }]}>清除缓存</Text>
            )}
          </Pressable>
        </View>

        {/* 关于 */}
        <Text style={[styles.sectionTitle, { color: theme.text }]}>关于</Text>
        <View style={[styles.card, { borderColor: theme.tabIconDefault }]}>
          <Pressable style={styles.row} onPress={() => router.push('/profile/privacy' as any)}>
            <Text style={[styles.rowLabel, { color: theme.text }]}>隐私政策</Text>
            <FontAwesome name="chevron-right" size={12} color={theme.tabIconDefault} />
          </Pressable>
          <Divider color={theme.tabIconDefault} />
          <Pressable style={styles.row} onPress={() => router.push('/profile/terms' as any)}>
            <Text style={[styles.rowLabel, { color: theme.text }]}>用户协议</Text>
            <FontAwesome name="chevron-right" size={12} color={theme.tabIconDefault} />
          </Pressable>
          <Divider color={theme.tabIconDefault} />
          <Pressable style={styles.row} onPress={() => router.push('/profile/about' as any)}>
            <Text style={[styles.rowLabel, { color: theme.text }]}>关于我们</Text>
            <FontAwesome name="chevron-right" size={12} color={theme.tabIconDefault} />
          </Pressable>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

function RowSwitch({
  label,
  value,
  onValueChange,
  theme,
}: {
  label: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  theme: typeof Colors.light;
}) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { color: theme.text }]}>{label}</Text>
      <Switch value={value} onValueChange={onValueChange} trackColor={{ true: theme.tint }} />
    </View>
  );
}

function Divider({ color }: { color: string }) {
  return <View style={[styles.divider, { backgroundColor: color }]} />;
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: { width: 32, alignItems: 'flex-start' },
  headerTitle: { fontSize: 17, fontWeight: '700' },
  scroll: { padding: 16, paddingBottom: 40 },
  sectionTitle: { fontSize: 13, fontWeight: '600', opacity: 0.5, marginBottom: 8, marginLeft: 4, marginTop: 8 },
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, overflow: 'hidden', marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14 },
  rowLabel: { fontSize: 15, fontWeight: '500' },
  rowSub: { fontSize: 12, opacity: 0.5, marginTop: 2 },
  rowValue: { fontSize: 14 },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 14 },
  timeInput: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 14,
    minWidth: 60,
    textAlign: 'center',
  },
});
