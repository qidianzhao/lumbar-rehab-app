import { View, Text, StyleSheet } from 'react-native'
export default function TabProfileScreen() {
  return (
    <View style={styles.container}>
      <Text>个人中心页</Text>
    </View>
  );
}
const styles = StyleSheet.create({ container: { flex: 1, justifyContent: 'center', alignItems: 'center' } });
