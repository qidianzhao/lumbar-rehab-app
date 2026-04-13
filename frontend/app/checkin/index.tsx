import { View, Text, StyleSheet } from 'react-native'
export default function CheckinScreen() {
  return (
    <View style={styles.container}>
      <Text>打卡</Text>
    </View>
  );
}
const styles = StyleSheet.create({ container: { flex: 1, justifyContent: 'center', alignItems: 'center' } });
