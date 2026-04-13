import { View, Text, StyleSheet } from 'react-native'
export default function AssessmentTestScreen() {
  return (
    <View style={styles.container}>
      <Text>测试进行页</Text>
    </View>
  );
}
const styles = StyleSheet.create({ container: { flex: 1, justifyContent: 'center', alignItems: 'center' } });
