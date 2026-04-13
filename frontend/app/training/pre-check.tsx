import { View, Text, StyleSheet } from 'react-native'
export default function TrainingPreCheckScreen() {
  return (
    <View style={styles.container}>
      <Text>训练前确认页</Text>
    </View>
  );
}
const styles = StyleSheet.create({ container: { flex: 1, justifyContent: 'center', alignItems: 'center' } });
