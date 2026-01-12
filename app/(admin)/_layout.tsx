import { Stack, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';

export default function AdminLayout() {
  const { profile, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && profile?.role !== 'admin') {
      router.replace('/(tabs)');
    }
  }, [profile, isLoading]);

  if (isLoading || profile?.role !== 'admin') {
    return null;
  }

  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={{
          title: 'Admin Dashboard',
          headerStyle: { backgroundColor: '#333' },
          headerTintColor: '#fff',
        }}
      />
      <Stack.Screen
        name="listings"
        options={{
          title: 'Manage Listings',
          headerStyle: { backgroundColor: '#333' },
          headerTintColor: '#fff',
        }}
      />
      <Stack.Screen
        name="users"
        options={{
          title: 'Manage Users',
          headerStyle: { backgroundColor: '#333' },
          headerTintColor: '#fff',
        }}
      />
    </Stack>
  );
}
