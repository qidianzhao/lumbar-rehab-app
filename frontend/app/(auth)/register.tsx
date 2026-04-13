import { View, Text, StyleSheet } from 'react-native'
export default function RegisterScreen() {
  return (
    <View style={styles.container}>
      <Text>注册页面</Text>
    </View>
  );
}
const styles = StyleSheet.create({ container: { flex: 1, justifyContent: 'center', alignItems: 'center' } });
