import { Stack } from 'expo-router';

export default function PlansLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: '训练计划' }} />
      <Stack.Screen name="generate" options={{ title: '生成计划' }} />
    </Stack>
  );
}
