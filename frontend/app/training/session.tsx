import { View, Text, StyleSheet } from 'react-native'
export default function TrainingSessionScreen() {
  return (
    <View style={styles.container}>
      <Text>跟练播放页</Text>
    </View>
  );
}
const styles = StyleSheet.create({ container: { flex: 1, justifyContent: 'center', alignItems: 'center' } });
