import { View, Text, StyleSheet } from 'react-native'
export default function AssessmentIntroScreen() {
  return (
    <View style={styles.container}>
      <Text>体能测试引导页</Text>
    </View>
  );
}
const styles = StyleSheet.create({ container: { flex: 1, justifyContent: 'center', alignItems: 'center' } });
