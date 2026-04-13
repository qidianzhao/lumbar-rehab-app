import { View, Text, StyleSheet } from 'react-native'
export default function TrainingScreen() {
  return (
    <View style={styles.container}>
      <Text>训练入口</Text>
    </View>
  );
}
const styles = StyleSheet.create({ container: { flex: 1, justifyContent: 'center', alignItems: 'center' } });
