import { View, Text, StyleSheet } from 'react-native'
export default function ExportScreen() {
  return (
    <View style={styles.container}>
      <Text>数据导出页</Text>
    </View>
  );
}
const styles = StyleSheet.create({ container: { flex: 1, justifyContent: 'center', alignItems: 'center' } });
