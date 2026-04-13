import { View, Text, StyleSheet } from 'react-native'
export default function CheckinLeaderboardScreen() {
  return (
    <View style={styles.container}>
      <Text>排行榜页</Text>
    </View>
  );
}
const styles = StyleSheet.create({ container: { flex: 1, justifyContent: 'center', alignItems: 'center' } });
