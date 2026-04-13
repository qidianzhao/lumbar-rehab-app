import { View, Text, StyleSheet } from 'react-native'
export default function HealthProfileScreen() {
  return (
    <View style={styles.container}>
      <Text>运动档案编辑页</Text>
    </View>
  );
}
const styles = StyleSheet.create({ container: { flex: 1, justifyContent: 'center', alignItems: 'center' } });
