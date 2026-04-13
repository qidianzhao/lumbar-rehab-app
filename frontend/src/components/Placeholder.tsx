import { View, Text, StyleSheet } from 'react-native';

/** 共享 UI 组件（占位） */
export function Placeholder() {
  return (
    <View style={styles.box}>
      <Text>Placeholder</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { padding: 8 },
});
