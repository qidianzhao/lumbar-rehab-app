import { View, Text, StyleSheet } from 'react-native'
export default function CheckinCalendarScreen() {
  return (
    <View style={styles.container}>
      <Text>打卡日历页</Text>
    </View>
  );
}
const styles = StyleSheet.create({ container: { flex: 1, justifyContent: 'center', alignItems: 'center' } });
