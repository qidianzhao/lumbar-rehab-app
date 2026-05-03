import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function DisclaimerScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← 返回</Text>
        </Pressable>
        <Text style={styles.headerTitle}>免责声明</Text>
        <View style={styles.placeholder} />
      </View>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <Text style={styles.sectionTitle}>一、服务性质</Text>
        <Text style={styles.paragraph}>
          本应用（以下简称"本应用"）提供的健身训练计划、营养建议、AI助手等功能仅供参考，不构成专业医疗建议。用户在使用本应用前，应充分了解自身健康状况，必要时咨询专业医生或健身教练。
        </Text>

        <Text style={styles.sectionTitle}>二、健康风险提示</Text>
        <Text style={styles.paragraph}>
          1. 运动存在一定风险，用户应根据自身身体状况选择合适的训练强度。如有心脏病、高血压、关节疾病等健康问题，请在医生指导下进行锻炼。
        </Text>
        <Text style={styles.paragraph}>
          2. 训练过程中如出现胸闷、气短、头晕、恶心等不适症状，应立即停止运动并就医。
        </Text>
        <Text style={styles.paragraph}>
          3. 本应用生成的训练计划基于用户提供的信息，无法完全替代专业教练的现场指导。
        </Text>

        <Text style={styles.sectionTitle}>三、用户责任</Text>
        <Text style={styles.paragraph}>
          1. 用户应确保提供的健康信息真实准确，并对自己的训练行为负责。
        </Text>
        <Text style={styles.paragraph}>
          2. 用户应在安全的环境下进行训练，确保场地、器械符合安全标准。
        </Text>
        <Text style={styles.paragraph}>
          3. 未成年人使用本应用应在监护人指导下进行。
        </Text>

        <Text style={styles.sectionTitle}>四、免责条款</Text>
        <Text style={styles.paragraph}>
          1. 因用户自身原因（包括但不限于错误操作、隐瞒健康状况、超负荷训练等）导致的任何损伤或健康问题，本应用不承担责任。
        </Text>
        <Text style={styles.paragraph}>
          2. 本应用不对训练效果做任何保证，实际效果因人而异。
        </Text>
        <Text style={styles.paragraph}>
          3. 因网络故障、设备问题、第三方服务中断等不可抗力因素导致的服务中断或数据丢失，本应用不承担责任。
        </Text>
        <Text style={styles.paragraph}>
          4. 本应用中的AI助手回复由人工智能生成，可能存在不准确或不适用的情况，用户应谨慎参考。
        </Text>

        <Text style={styles.sectionTitle}>五、数据与隐私</Text>
        <Text style={styles.paragraph}>
          1. 本应用收集的用户数据仅用于提供服务，不会未经授权向第三方披露。
        </Text>
        <Text style={styles.paragraph}>
          2. 用户应妥善保管账号密码，因账号泄露导致的损失由用户自行承担。
        </Text>

        <Text style={styles.sectionTitle}>六、其他</Text>
        <Text style={styles.paragraph}>
          1. 本应用保留随时修改本免责声明的权利，修改后的内容将在应用内公布。
        </Text>
        <Text style={styles.paragraph}>
          2. 用户继续使用本应用即表示接受本免责声明的全部内容。
        </Text>
        <Text style={styles.paragraph}>
          3. 本免责声明的解释权归本应用所有。
        </Text>

        <View style={styles.footer}>
          <Text style={styles.footerText}>最后更新时间：2026年5月</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f5f5f5' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
  },
  backBtn: { padding: 4 },
  backText: { fontSize: 16, color: '#2563eb' },
  headerTitle: { fontSize: 18, fontWeight: '600' },
  placeholder: { width: 48 },
  scroll: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginTop: 20,
    marginBottom: 12,
  },
  paragraph: {
    fontSize: 14,
    lineHeight: 22,
    color: '#4b5563',
    marginBottom: 10,
  },
  footer: {
    marginTop: 30,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#e5e5e5',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: '#9ca3af',
  },
});
