import { View, Text, StyleSheet } from 'react-native'
export default function DisclaimerScreen() {
  return (
    <View style={styles.container}>
      <Text>免责声明页面</Text>
    </View>
  );
}
const styles = StyleSheet.create({ container: { flex: 1, justifyContent: 'center', alignItems: 'center' } });
