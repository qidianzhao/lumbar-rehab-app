import { Stack } from 'expo-router';

export default function ChatLayout() {
  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={{
          title: 'AI问答助手',
          headerShown: true,
        }}
      />
    </Stack>
  );
}
