import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';

export {
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

SplashScreen.preventAutoHideAsync();

function RootLayoutNav() {
  const { user, profile, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

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
  }, [user, profile, isLoading, segments]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(admin)" />
      <Stack.Screen
        name="listing/[id]"
        options={{
          headerShown: true,
          headerTitle: '',
          headerBackTitle: 'Back',
        }}
      />
      <Stack.Screen
        name="chat/[id]"
        options={{
          headerShown: true,
          headerTitle: '',
          headerBackTitle: 'Back',
        }}
      />
      <Stack.Screen
        name="edit-profile"
        options={{
          headerShown: true,
        }}
      />
      <Stack.Screen
        name="settings"
        options={{
          headerShown: true,
        }}
      />
      <Stack.Screen
        name="my-listings"
        options={{
          headerShown: true,
          headerTitle: 'My Listings',
          headerBackTitle: 'Profile',
        }}
      />
      <Stack.Screen
        name="saved"
        options={{
          headerShown: true,
          headerTitle: 'Saved Listings',
          headerBackTitle: 'Profile',
        }}
      />
      <Stack.Screen
        name="change-university"
        options={{
          headerShown: true,
          headerTitle: 'Change University',
          headerBackTitle: 'Back',
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

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <RootLayoutNav />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
