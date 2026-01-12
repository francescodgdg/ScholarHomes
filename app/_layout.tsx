import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';

export {
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

SplashScreen.preventAutoHideAsync();

function RootLayoutNav({ fontsLoaded }: { fontsLoaded: boolean }) {
  const { user, profile, isLoading, isPasswordRecovery } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const [appReady, setAppReady] = useState(false);
  const [navigationReady, setNavigationReady] = useState(false);

  // Hide splash screen only when both fonts AND auth are loaded
  useEffect(() => {
    if (fontsLoaded && !isLoading && !appReady) {
      setAppReady(true);
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, isLoading, appReady]);

  useEffect(() => {
    if (isLoading) return;

    // Handle password recovery - redirect to reset password screen
    if (isPasswordRecovery) {
      router.replace('/(auth)/reset-password');
      setNavigationReady(true);
      return;
    }

    const inAuthGroup = segments[0] === '(auth)';
    const inAdminGroup = segments[0] === '(admin)';

    if (!user) {
      // Not signed in, redirect to welcome
      if (!inAuthGroup) {
        router.replace('/(auth)/welcome');
      }
    } else if (!profile?.university_id || !profile?.full_name) {
      // Signed in but profile incomplete
      if (segments[1] !== 'select-university' && segments[1] !== 'complete-profile') {
        router.replace('/(auth)/select-university');
      }
    } else {
      // Signed in with complete profile
      // If in auth group, go to tabs
      if (inAuthGroup) {
        router.replace('/(tabs)');
      }
      // If in admin group but not admin, go to tabs
      if (inAdminGroup && profile?.role !== 'admin') {
        router.replace('/(tabs)');
      }
    }

    // Mark navigation as ready after initial routing decision
    setNavigationReady(true);
  }, [user, profile, isLoading, isPasswordRecovery, segments]);

  // Don't render navigation until we've determined the correct route
  if (!navigationReady) {
    return null;
  }

  return (
    <Stack screenOptions={{ headerShown: false, headerBackTitleVisible: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(admin)" />
      <Stack.Screen
        name="listing/[id]"
        options={{
          headerShown: true,
          headerBackVisible: false,
          headerTitle: '',
        }}
      />
      <Stack.Screen
        name="chat/[id]"
        options={{
          headerShown: true,
          headerBackVisible: false,
          headerTitle: '',
        }}
      />
      <Stack.Screen
        name="edit-profile"
        options={{
          headerShown: true,
          headerBackVisible: false,
        }}
      />
      <Stack.Screen
        name="settings"
        options={{
          headerShown: true,
          headerBackVisible: false,
        }}
      />
      <Stack.Screen
        name="my-listings"
        options={{
          headerShown: true,
          headerBackVisible: false,
          headerTitle: 'My Listings',
        }}
      />
      <Stack.Screen
        name="saved"
        options={{
          headerShown: true,
          headerBackVisible: false,
          headerTitle: 'Saved Listings',
        }}
      />
      <Stack.Screen
        name="change-university"
        options={{
          headerShown: true,
          headerBackVisible: false,
          headerTitle: 'Change University',
        }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
  });

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  // Don't render until fonts are loaded, but keep splash screen visible
  if (!loaded) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <RootLayoutNav fontsLoaded={loaded} />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
