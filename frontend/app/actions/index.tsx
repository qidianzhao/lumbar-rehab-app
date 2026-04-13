import { View, Text, StyleSheet } from 'react-native'
export default function ActionsListScreen() {
  return (
    <View style={styles.container}>
      <Text>动作库列表页</Text>
    </View>
  );
}
const styles = StyleSheet.create({ container: { flex: 1, justifyContent: 'center', alignItems: 'center' } });
