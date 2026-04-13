import { View, Text, StyleSheet } from 'react-native'
export default function RecordsScreen() {
  return (
    <View style={styles.container}>
      <Text>训练记录页</Text>
    </View>
  );
}
const styles = StyleSheet.create({ container: { flex: 1, justifyContent: 'center', alignItems: 'center' } });
