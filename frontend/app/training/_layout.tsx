import { Stack } from 'expo-router';

export default function TrainingLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: '训练' }} />
      <Stack.Screen name="pre-check" options={{ title: '训练前确认' }} />
      <Stack.Screen name="session" options={{ headerShown: false, title: '跟练' }} />
      <Stack.Screen name="report" options={{ headerShown: false, title: '训练报告' }} />
    </Stack>
  );
}
