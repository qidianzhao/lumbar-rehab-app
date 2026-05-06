import { Stack } from 'expo-router';

export default function AssessmentLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: '体能测试' }} />
      <Stack.Screen name="test" options={{ title: '测试中' }} />
      <Stack.Screen name="result" options={{ title: '测试报告' }} />
    </Stack>
  );
}
