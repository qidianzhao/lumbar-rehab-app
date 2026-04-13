import { View, Text, StyleSheet } from 'react-native'
export default function SettingsScreen() {
  return (
    <View style={styles.container}>
      <Text>设置页</Text>
    </View>
  );
}
const styles = StyleSheet.create({ container: { flex: 1, justifyContent: 'center', alignItems: 'center' } });
