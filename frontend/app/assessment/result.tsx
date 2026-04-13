import { View, Text, StyleSheet } from 'react-native'
export default function AssessmentResultScreen() {
  return (
    <View style={styles.container}>
      <Text>测试结果页</Text>
    </View>
  );
}
const styles = StyleSheet.create({ container: { flex: 1, justifyContent: 'center', alignItems: 'center' } });
