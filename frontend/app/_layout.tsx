import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import 'react-native-reanimated';
import { useRouter } from 'expo-router';

import { useColorScheme } from '@/components/useColorScheme';
import { useAuthStore } from '@/src/stores/authStore';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  // 初始进入认证组（登录），后续可改为 (tabs) 等
  initialRouteName: '(auth)',
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
  });

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return <RootLayoutNav />;
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await useAuthStore.getState().checkAuth();
      if (cancelled) {
        return;
      }
      const { accessToken, user } = useAuthStore.getState();
      if (accessToken && user) {
        router.replace('/(tabs)');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="training" options={{ headerShown: false }} />
        <Stack.Screen name="assessment" options={{ headerShown: false }} />
        <Stack.Screen name="profile" options={{ title: '个人中心' }} />
        <Stack.Screen name="actions" options={{ title: '动作库' }} />
        <Stack.Screen name="plan" options={{ headerShown: false }} />
        <Stack.Screen name="checkin" options={{ title: '打卡' }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
      </Stack>
    </ThemeProvider>
  );
}
