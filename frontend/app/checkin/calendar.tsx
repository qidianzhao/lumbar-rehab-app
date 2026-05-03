import { type Href, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { getCheckinCalendar, type CheckinCalendarDay } from '@/src/api/checkin';
import { handleError } from '@/src/utils/errorHandler';

const WEEK_LABELS = ['日', '一', '二', '三', '四', '五', '六'];

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function getFirstWeekday(year: number, month: number): number {
  // 0=Sun ... 6=Sat
  return new Date(year, month - 1, 1).getDay();
}

function toDateStr(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export default function CheckinCalendarScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];

  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);

  const [days, setDays] = useState<CheckinCalendarDay[]>([]);
  const [streak, setStreak] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCalendar = useCallback(async (y: number, m: number) => {
    setLoading(true);
    setError(null);
    try {
      const data = await getCheckinCalendar(y, m);
      setDays(data.days);
      setStreak(data.streak_days);
      setTotal(data.total_days);
    } catch (e) {
      setError(handleError(e, '加载失败'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchCalendar(year, month);
  }, [year, month, fetchCalendar]);

  const prevMonth = () => {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
  };

  const daysInMonth = getDaysInMonth(year, month);
  const firstWeekday = getFirstWeekday(year, month);
  const todayStr = toDateStr(today.getFullYear(), today.getMonth() + 1, today.getDate());

  const checkinSet = new Set(days.filter(d => d.has_checkin).map(d => d.date));
  const sessionMap = new Map(days.map(d => [d.date, d.training_session_ids]));

  // 构建日历格子：前置空格 + 每天
  const cells: Array<{ day: number | null; dateStr: string | null }> = [];
  for (let i = 0; i < firstWeekday; i++) cells.push({ day: null, dateStr: null });
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, dateStr: toDateStr(year, month, d) });
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.background }} contentContainerStyle={styles.scroll}>

      {/* 统计条 */}
      <View style={styles.statsRow}>
        <View style={[styles.statCard, { borderColor: theme.tabIconDefault }]}>
          <Text style={[styles.statNum, { color: theme.tint }]}>{streak}</Text>
          <Text style={[styles.statLabel, { color: theme.text }]}>连续打卡天</Text>
        </View>
        <View style={[styles.statCard, { borderColor: theme.tabIconDefault }]}>
          <Text style={[styles.statNum, { color: theme.tint }]}>{total}</Text>
          <Text style={[styles.statLabel, { color: theme.text }]}>累计打卡天</Text>
        </View>
      </View>

      {/* 月份切换 */}
      <View style={styles.monthNav}>
        <Pressable onPress={prevMonth} style={styles.navBtn} hitSlop={12}>
          <Text style={[styles.navArrow, { color: theme.tint }]}>‹</Text>
        </Pressable>
        <Text style={[styles.monthTitle, { color: theme.text }]}>{year} 年 {month} 月</Text>
        <Pressable onPress={nextMonth} style={styles.navBtn} hitSlop={12}>
          <Text style={[styles.navArrow, { color: theme.tint }]}>›</Text>
        </Pressable>
      </View>

      {/* 星期标题行 */}
      <View style={styles.weekRow}>
        {WEEK_LABELS.map((l, i) => (
          <Text key={i} style={[styles.weekLabel, { color: theme.text }, i === 0 || i === 6 ? { opacity: 0.4 } : {}]}>
            {l}
          </Text>
        ))}
      </View>

      {/* 日历格子 */}
      {loading ? (
        <ActivityIndicator color={theme.tint} style={{ marginTop: 40 }} />
      ) : error ? (
        <Text style={styles.err}>{error}</Text>
      ) : (
        <View style={styles.grid}>
          {cells.map((cell, idx) => {
            if (!cell.day || !cell.dateStr) {
              return <View key={`empty-${idx}`} style={styles.cell} />;
            }
            const dateStr = cell.dateStr;
            const isToday = dateStr === todayStr;
            const isCheckin = checkinSet.has(dateStr);
            const sessionIds = sessionMap.get(dateStr) || [];

            return (
              <Pressable
                key={dateStr}
                style={styles.cell}
                onPress={() => {
                  if (sessionIds.length === 0) return;

                  if (sessionIds.length === 1) {
                    // 单次训练，直接跳转
                    router.push(`/training/report?session_id=${sessionIds[0]}` as unknown as Href);
                  } else {
                    // 多次训练，显示选择列表
                    Alert.alert(
                      '选择训练记录',
                      `${dateStr} 共有 ${sessionIds.length} 次训练`,
                      sessionIds.map((id, idx) => ({
                        text: `训练 ${idx + 1}`,
                        onPress: () => router.push(`/training/report?session_id=${id}` as unknown as Href),
                      })).concat([{ text: '取消', style: 'cancel' }])
                    );
                  }
                }}
              >
                <View
                  style={[
                    styles.dayCircle,
                    isCheckin && { backgroundColor: theme.tint },
                    isToday && !isCheckin && { borderWidth: 1.5, borderColor: theme.tint },
                  ]}
                >
                  <Text
                    style={[
                      styles.dayText,
                      { color: isCheckin ? '#fff' : isToday ? theme.tint : theme.text },
                      (isCheckin || isToday) && { fontWeight: '700' },
                    ]}
                  >
                    {cell.day}
                  </Text>
                </View>
                {isCheckin && (
                  <View style={[styles.dot, { backgroundColor: theme.tint }]} />
                )}
              </Pressable>
            );
          })}
        </View>
      )}

      {/* 图例 */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: theme.tint }]} />
          <Text style={[styles.legendText, { color: theme.text }]}>已打卡</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendCircle, { borderColor: theme.tint }]} />
          <Text style={[styles.legendText, { color: theme.text }]}>今日</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: theme.tabIconDefault }]} />
          <Text style={[styles.legendText, { color: theme.text }]}>未打卡</Text>
        </View>
      </View>

    </ScrollView>
  );
}

const CELL_SIZE = 44;

const styles = StyleSheet.create({
  scroll: { padding: 16, paddingBottom: 40 },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  statCard: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    gap: 4,
  },
  statNum: { fontSize: 28, fontWeight: '900' },
  statLabel: { fontSize: 13, opacity: 0.7 },
  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  navBtn: { padding: 4 },
  navArrow: { fontSize: 28, lineHeight: 32 },
  monthTitle: { fontSize: 17, fontWeight: '700' },
  weekRow: { flexDirection: 'row', marginBottom: 4 },
  weekLabel: { width: `${100 / 7}%`, textAlign: 'center', fontSize: 13, fontWeight: '600', paddingVertical: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: {
    width: `${100 / 7}%`,
    alignItems: 'center',
    paddingVertical: 4,
    gap: 2,
  },
  dayCircle: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    borderRadius: CELL_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayText: { fontSize: 15 },
  dot: { width: 5, height: 5, borderRadius: 3, opacity: 0 }, // 打卡后 dot 通过 isCheckin 控制显示
  legend: { flexDirection: 'row', justifyContent: 'center', gap: 20, marginTop: 20 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 12, height: 12, borderRadius: 6 },
  legendCircle: { width: 12, height: 12, borderRadius: 6, borderWidth: 1.5 },
  legendText: { fontSize: 12, opacity: 0.7 },
  err: { color: '#c62828', textAlign: 'center', marginTop: 40 },
});
