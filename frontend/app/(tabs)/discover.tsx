import FontAwesome from '@expo/vector-icons/FontAwesome';
import { type Href, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import {
  getLeaderboard,
  getMedalEmoji,
  PERIOD_LABELS,
  PERIODS,
  type LeaderboardData,
  type LeaderboardEntry,
  type LeaderboardPeriod,
} from '@/src/services/leaderboardService';

type ContentSection = {
  icon: React.ComponentProps<typeof FontAwesome>['name'];
  title: string;
  description: string;
  badge?: string;
  onPress: () => void;
};

function PeriodTabs({
  active,
  onChange,
  tint,
  text,
  border,
}: {
  active: LeaderboardPeriod;
  onChange: (p: LeaderboardPeriod) => void;
  tint: string;
  text: string;
  border: string;
}) {
  return (
    <View style={[tabStyles.wrap, { borderColor: border }]}>
      {PERIODS.map((p) => (
        <Pressable
          key={p}
          style={[tabStyles.tab, active === p && { backgroundColor: tint }]}
          onPress={() => onChange(p)}
        >
          <Text style={[tabStyles.label, { color: active === p ? '#fff' : text }]}>
            {PERIOD_LABELS[p]}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

function EntryRow({
  entry,
  tint,
  text,
  border,
}: {
  entry: LeaderboardEntry;
  tint: string;
  text: string;
  border: string;
}) {
  const medal = getMedalEmoji(entry.rank);
  return (
    <View
      style={[
        rowStyles.wrap,
        { borderColor: border },
        entry.is_me && { borderColor: tint, borderWidth: 1.5 },
      ]}
    >
      <View style={rowStyles.rankWrap}>
        {medal ? (
          <Text style={rowStyles.medal}>{medal}</Text>
        ) : (
          <Text style={[rowStyles.rankNum, { color: text }]}>{entry.rank}</Text>
        )}
      </View>
      <View style={rowStyles.info}>
        <Text style={[rowStyles.name, { color: text }]}>
          {entry.display_name}
          {entry.is_me && <Text style={{ color: tint }}> （我）</Text>}
        </Text>
        <Text style={[rowStyles.sub, { color: text }]}>
          连续 {entry.streak_days} 天
        </Text>
      </View>
      <View style={rowStyles.daysWrap}>
        <Text style={[rowStyles.daysNum, { color: tint }]}>{entry.checkin_days}</Text>
        <Text style={[rowStyles.daysSub, { color: text }]}>天</Text>
      </View>
    </View>
  );
}

export default function DiscoverScreen() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  const router = useRouter();

  const [period, setPeriod] = useState<LeaderboardPeriod>('week');
  const [data, setData] = useState<LeaderboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      getLeaderboard(period)
        .then(setData)
        .catch(() => setData(null))
        .finally(() => {
          setLoading(false);
          setRefreshing(false);
        });
    },
    [period]
  );

  const onRefresh = useCallback(() => load(true), [load]);

  const contentSections: ContentSection[] = [
    {
      icon: 'book',
      title: '康复知识',
      description: '腰椎间盘突出症科普与康复指南',
      badge: '即将上线',
      onPress: () => {},
    },
    {
      icon: 'lightbulb-o',
      title: '训练技巧',
      description: '动作要领、常见错误与改进建议',
      badge: '即将上线',
      onPress: () => {},
    },
    {
      icon: 'heart',
      title: '健康资讯',
      description: '运动康复、健康生活方式分享',
      badge: '即将上线',
      onPress: () => {},
    },
  ];

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Text style={[styles.title, { color: theme.text }]}>发现</Text>

        {/* 排行榜 */}
        <View style={[styles.card, { borderColor: theme.tabIconDefault }]}>
          <View style={styles.cardHeader}>
            <FontAwesome name="trophy" size={20} color={theme.tint} />
            <Text style={[styles.cardTitle, { color: theme.text }]}>打卡排行榜</Text>
          </View>

          <PeriodTabs
            active={period}
            onChange={(p) => {
              setPeriod(p);
              setLoading(true);
              getLeaderboard(p)
                .then(setData)
                .catch(() => setData(null))
                .finally(() => setLoading(false));
            }}
            tint={theme.tint}
            text={theme.text}
            border={theme.tabIconDefault}
          />

          {loading && (
            <View style={styles.loadingWrap}>
              <ActivityIndicator color={theme.tint} />
            </View>
          )}

          {!loading && data && (
            <>
              {data.entries.length === 0 ? (
                <View style={styles.emptyWrap}>
                  <Text style={[styles.emptyText, { color: theme.text }]}>暂无数据</Text>
                </View>
              ) : (
                <View style={styles.listWrap}>
                  {data.entries.map((entry) => (
                    <EntryRow
                      key={entry.user_id}
                      entry={entry}
                      tint={theme.tint}
                      text={theme.text}
                      border={theme.tabIconDefault}
                    />
                  ))}
                </View>
              )}

              {data.my_entry && !data.entries.some((e) => e.is_me) && (
                <View style={styles.myEntryWrap}>
                  <Text style={[styles.myEntryLabel, { color: theme.text }]}>我的排名</Text>
                  <EntryRow
                    entry={data.my_entry}
                    tint={theme.tint}
                    text={theme.text}
                    border={theme.tabIconDefault}
                  />
                </View>
              )}
            </>
          )}

          <Pressable
            style={[styles.viewAllBtn, { borderColor: theme.tabIconDefault }]}
            onPress={() => router.push('/checkin/leaderboard' as Href)}
          >
            <Text style={[styles.viewAllText, { color: theme.tint }]}>查看完整榜单</Text>
            <FontAwesome name="chevron-right" size={12} color={theme.tint} />
          </Pressable>
        </View>

        {/* 内容板块 */}
        <View style={styles.contentSection}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>学习与分享</Text>
          {contentSections.map((section) => (
            <Pressable
              key={section.title}
              style={[
                styles.contentCard,
                { borderColor: theme.tabIconDefault },
                section.badge && styles.contentCardDisabled,
              ]}
              onPress={section.onPress}
              disabled={!!section.badge}
            >
              <View style={[styles.contentIcon, { backgroundColor: `${theme.tint}15` }]}>
                <FontAwesome
                  name={section.icon}
                  size={24}
                  color={section.badge ? theme.tabIconDefault : theme.tint}
                />
              </View>
              <View style={styles.contentText}>
                <View style={styles.contentTitleRow}>
                  <Text
                    style={[
                      styles.contentTitle,
                      { color: section.badge ? theme.tabIconDefault : theme.text },
                    ]}
                  >
                    {section.title}
                  </Text>
                  {section.badge && (
                    <View style={[styles.badge, { backgroundColor: `${theme.tint}15` }]}>
                      <Text style={[styles.badgeText, { color: theme.tint }]}>{section.badge}</Text>
                    </View>
                  )}
                </View>
                <Text
                  style={[
                    styles.contentDesc,
                    { color: section.badge ? theme.tabIconDefault : theme.text },
                  ]}
                >
                  {section.description}
                </Text>
              </View>
              {!section.badge && (
                <FontAwesome name="chevron-right" size={14} color={theme.tabIconDefault} />
              )}
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { padding: 16, paddingBottom: 40 },
  title: { fontSize: 28, fontWeight: '700', marginBottom: 20 },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  cardTitle: { fontSize: 18, fontWeight: '700' },
  loadingWrap: { paddingVertical: 40, alignItems: 'center' },
  emptyWrap: { paddingVertical: 40, alignItems: 'center' },
  emptyText: { fontSize: 14, opacity: 0.5 },
  listWrap: { marginTop: 12, gap: 8 },
  myEntryWrap: { marginTop: 16, paddingTop: 16, borderTopWidth: StyleSheet.hairlineWidth },
  myEntryLabel: { fontSize: 13, fontWeight: '600', opacity: 0.5, marginBottom: 8 },
  viewAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    marginTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  viewAllText: { fontSize: 14, fontWeight: '600' },
  contentSection: { gap: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  contentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: 16,
    gap: 12,
  },
  contentCardDisabled: { opacity: 0.6 },
  contentIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentText: { flex: 1, gap: 4 },
  contentTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  contentTitle: { fontSize: 16, fontWeight: '600' },
  contentDesc: { fontSize: 13, opacity: 0.6, lineHeight: 18 },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: { fontSize: 11, fontWeight: '600' },
});

const tabStyles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    overflow: 'hidden',
  },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center' },
  label: { fontSize: 14, fontWeight: '600' },
});

const rowStyles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    padding: 12,
    gap: 12,
  },
  rankWrap: { width: 32, alignItems: 'center' },
  medal: { fontSize: 24 },
  rankNum: { fontSize: 16, fontWeight: '700' },
  info: { flex: 1, gap: 2 },
  name: { fontSize: 15, fontWeight: '600' },
  sub: { fontSize: 12, opacity: 0.5 },
  daysWrap: { alignItems: 'flex-end' },
  daysNum: { fontSize: 20, fontWeight: '700' },
  daysSub: { fontSize: 12, opacity: 0.5 },
});
