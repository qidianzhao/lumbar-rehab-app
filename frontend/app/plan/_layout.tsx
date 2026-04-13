import { Stack } from 'expo-router';

export default function PlanLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerBackTitle: '返回',
      }}
    >
      <Stack.Screen name="generate" options={{ title: '生成训练计划' }} />
      <Stack.Screen name="[id]" options={{ title: '计划详情' }} />
    </Stack>
  );
}
