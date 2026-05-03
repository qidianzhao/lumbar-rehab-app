import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import {
  ALL_SECTIONS,
  exportAndShare,
  getPresetRange,
  SECTION_LABELS,
  type DateRange,
  type ExportSection,
} from '@/src/services/exportService';
import { handleError } from '@/src/utils/errorHandler';

type Preset = 'week' | 'month' | 'custom';

const PRESET_LABELS: Record<Preset, string> = {
  week: '最近一周',
  month: '最近一月',
  custom: '自定义',
};

// 极简日期选择（纯数字输入，后续可换 DatePicker）
function DateInput({
  label,
  value,
  onChange,
  textColor,
  borderColor,
}: {
  label: string;
  value: Date;
  onChange: (d: Date) => void;
  textColor: string;
  borderColor: string;
}) {
  const str = value.toISOString().split('T')[0];
  return (
    <View style={dateStyles.wrap}>
      <Text style={[dateStyles.label, { color: textColor }]}>{label}</Text>
      <Pressable
        style={[dateStyles.field, { borderColor }]}
        onPress={() => {
          // 简单 Alert 输入，后续替换为日期选择器
          Alert.prompt(
            `选择${label}`,
            '请输入日期（YYYY-MM-DD）',
            (text) => {
              if (!text) return;
              const d = new Date(text);
              if (!isNaN(d.getTime())) onChange(d);
              else Alert.alert('格式错误', '请输入 YYYY-MM-DD 格式');
            },
            'plain-text',
            str,
          );
        }}
      >
        <Text style={[dateStyles.value, { color: textColor }]}>{str}</Text>
      </Pressable>
    </View>
  );
}

export default function ExportScreen() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];

  const [preset, setPreset] = useState<Preset>('week');
  const [customRange, setCustomRange] = useState<DateRange>(getPresetRange('week'));
  const [sections, setSections] = useState<Set<ExportSection>>(new Set(ALL_SECTIONS));
  const [exporting, setExporting] = useState(false);

  const range: DateRange =
    preset === 'custom' ? customRange : getPresetRange(preset === 'month' ? 'month' : 'week');

  const toggleSection = useCallback((s: ExportSection) => {
    setSections((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  }, []);

  const onExport = useCallback(async () => {
    if (sections.size === 0) {
      Alert.alert('提示', '请至少选择一项导出内容');
      return;
    }
    setExporting(true);
    try {
      await exportAndShare(range, Array.from(sections));
    } catch (e) {
      Alert.alert('导出失败', handleError(e, '未知错误'));
    } finally {
      setExporting(false);
    }
  }, [range, sections]);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

        {/* 时间范围 */}
        <Text style={[styles.sectionTitle, { color: theme.text }]}>时间范围</Text>
        <View style={[styles.card, { borderColor: theme.tabIconDefault }]}>
          <View style={styles.presetRow}>
            {(['week', 'month', 'custom'] as Preset[]).map((p) => (
              <Pressable
                key={p}
                style={[
                  styles.presetBtn,
                  { borderColor: theme.tabIconDefault },
                  preset === p && { backgroundColor: theme.tint, borderColor: theme.tint },
                ]}
                onPress={() => setPreset(p)}
              >
                <Text style={[styles.presetLabel, { color: preset === p ? '#fff' : theme.text }]}>
                  {PRESET_LABELS[p]}
                </Text>
              </Pressable>
            ))}
          </View>

          {preset === 'custom' ? (
            <View style={styles.dateRow}>
              <DateInput
                label="开始"
                value={customRange.start}
                onChange={(d) => setCustomRange((r) => ({ ...r, start: d }))}
                textColor={theme.text}
                borderColor={theme.tabIconDefault}
              />
              <Text style={[styles.dateSep, { color: theme.text }]}>至</Text>
              <DateInput
                label="结束"
                value={customRange.end}
                onChange={(d) => setCustomRange((r) => ({ ...r, end: d }))}
                textColor={theme.text}
                borderColor={theme.tabIconDefault}
              />
            </View>
          ) : (
            <Text style={[styles.rangePreview, { color: theme.text }]}>
              {range.start.toLocaleDateString('zh-CN')} —{' '}
              {range.end.toLocaleDateString('zh-CN')}
            </Text>
          )}
        </View>

        {/* 导出内容 */}
        <Text style={[styles.sectionTitle, { color: theme.text }]}>导出内容</Text>
        <View style={[styles.card, { borderColor: theme.tabIconDefault }]}>
          {ALL_SECTIONS.map((s, idx) => (
            <View key={s}>
              {idx > 0 && (
                <View style={[styles.divider, { backgroundColor: theme.tabIconDefault }]} />
              )}
              <View style={styles.sectionRow}>
                <Text style={[styles.sectionLabel, { color: theme.text }]}>
                  {SECTION_LABELS[s]}
                </Text>
                <Switch
                  value={sections.has(s)}
                  onValueChange={() => toggleSection(s)}
                  trackColor={{ true: theme.tint }}
                  thumbColor="#fff"
                />
              </View>
            </View>
          ))}
        </View>

        {/* 生成按钮 */}
        <Pressable
          style={[styles.exportBtn, { backgroundColor: theme.tint }, exporting && styles.exportBtnDisabled]}
          onPress={onExport}
          disabled={exporting}
        >
          {exporting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.exportBtnText}>生成 PDF 并分享</Text>
          )}
        </Pressable>

        <Text style={[styles.hint, { color: theme.text }]}>
          PDF 将通过系统分享菜单发送，可保存至文件或发送到微信等应用
        </Text>

      </ScrollView>
    </SafeAreaView>
  );
}

const dateStyles = StyleSheet.create({
  wrap: { flex: 1, gap: 4 },
  label: { fontSize: 12, opacity: 0.6 },
  field: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 },
  value: { fontSize: 14, fontWeight: '600' },
});

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { padding: 16, paddingBottom: 40 },
  sectionTitle: { fontSize: 13, fontWeight: '600', opacity: 0.5, marginBottom: 8, marginLeft: 4, marginTop: 16 },
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, padding: 14, gap: 12 },
  presetRow: { flexDirection: 'row', gap: 8 },
  presetBtn: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  presetLabel: { fontSize: 13, fontWeight: '600' },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dateSep: { fontSize: 14, opacity: 0.5, marginTop: 16 },
  rangePreview: { fontSize: 13, opacity: 0.65, textAlign: 'center' },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 },
  sectionLabel: { fontSize: 15, fontWeight: '500' },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 2 },
  exportBtn: { marginTop: 24, paddingVertical: 15, borderRadius: 12, alignItems: 'center' },
  exportBtnDisabled: { opacity: 0.6 },
  exportBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  hint: { fontSize: 12, opacity: 0.45, textAlign: 'center', marginTop: 12, lineHeight: 18 },
});
