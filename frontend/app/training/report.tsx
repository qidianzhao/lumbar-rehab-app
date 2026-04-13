import { View, Text, StyleSheet } from 'react-native'
export default function TrainingReportScreen() {
  return (
    <View style={styles.container}>
      <Text>训练报告页</Text>
    </View>
  );
}
const styles = StyleSheet.create({ container: { flex: 1, justifyContent: 'center', alignItems: 'center' } });
