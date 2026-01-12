import { useCallback, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  Alert,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { FontAwesome } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

export default function SettingsScreen() {
  const { signOut } = useAuth();
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/profile');
    }
  }, [router]);

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to delete your account? This will permanently delete all your data including listings, messages, and saved items. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setIsDeleting(true);
            try {
              // Get current user
              const { data: { user } } = await supabase.auth.getUser();
              if (!user) throw new Error('No user found');

              // Get user's avatar URL
              const { data: profile } = await supabase
                .from('profiles')
                .select('avatar_url')
                .eq('id', user.id)
                .single();

              // Get user's listing images
              const { data: listings } = await supabase
                .from('listings')
                .select('images')
                .eq('user_id', user.id);

              // Delete avatar from storage
              if (profile?.avatar_url) {
                const avatarPath = extractStoragePath(profile.avatar_url, 'avatars');
                if (avatarPath) {
                  await supabase.storage.from('avatars').remove([avatarPath]);
                }
              }

              // Delete listing images from storage
              if (listings && listings.length > 0) {
                const imagePaths: string[] = [];
                for (const listing of listings) {
                  if (listing.images && Array.isArray(listing.images)) {
                    for (const imageUrl of listing.images) {
                      const path = extractStoragePath(imageUrl, 'listings');
                      if (path) imagePaths.push(path);
                    }
                  }
                }
                if (imagePaths.length > 0) {
                  await supabase.storage.from('listings').remove(imagePaths);
                }
              }

              // Call the RPC function to delete the user account
              const { error: deleteError } = await supabase.rpc('delete_user_account');

              if (deleteError) {
                throw deleteError;
              }

              // Sign out locally
              await signOut();
              Alert.alert('Account Deleted', 'Your account has been permanently deleted.');
            } catch (error: any) {
              console.error('Delete account error:', error);
              Alert.alert(
                'Error',
                error.message || 'Failed to delete account. Please try again or contact support.'
              );
            } finally {
              setIsDeleting(false);
            }
          },
        },
      ]
    );
  };

  // Helper function to extract storage path from public URL
  const extractStoragePath = (url: string, bucket: string): string | null => {
    try {
      const regex = new RegExp(`/storage/v1/object/public/${bucket}/(.+)$`);
      const match = url.match(regex);
      return match ? match[1] : null;
    } catch {
      return null;
    }
  };

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await signOut();
        },
      },
    ]);
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Settings',
          headerBackVisible: false,
          headerLeft: () => (
            <Pressable
              onPress={handleBack}
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: '#f5f5f5',
                justifyContent: 'center',
                alignItems: 'center',
              }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <FontAwesome name="chevron-left" size={18} color="#333" />
            </Pressable>
          ),
        }}
      />
      <View style={styles.container}>
        {/* Support */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Support</Text>

          <Pressable
            style={styles.settingRow}
            onPress={() => Linking.openURL('mailto:scholarhomes.app@gmail.com')}
          >
            <View style={styles.settingInfo}>
              <FontAwesome name="envelope" size={20} color="#666" />
              <Text style={styles.settingText}>Contact Support</Text>
            </View>
            <FontAwesome name="chevron-right" size={16} color="#999" />
          </Pressable>

          <Pressable
            style={styles.settingRow}
            onPress={() => Linking.openURL('https://scholar-homes.com/privacy')}
          >
            <View style={styles.settingInfo}>
              <FontAwesome name="shield" size={20} color="#666" />
              <Text style={styles.settingText}>Privacy Policy</Text>
            </View>
            <FontAwesome name="chevron-right" size={16} color="#999" />
          </Pressable>

          <Pressable
            style={styles.settingRow}
            onPress={() => Linking.openURL('https://scholar-homes.com/terms')}
          >
            <View style={styles.settingInfo}>
              <FontAwesome name="file-text" size={20} color="#666" />
              <Text style={styles.settingText}>Terms of Service</Text>
            </View>
            <FontAwesome name="chevron-right" size={16} color="#999" />
          </Pressable>
        </View>

        {/* Account */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>

          <Pressable style={styles.settingRow} onPress={handleSignOut}>
            <View style={styles.settingInfo}>
              <FontAwesome name="sign-out" size={20} color="#E74C3C" />
              <Text style={[styles.settingText, { color: '#E74C3C' }]}>Sign Out</Text>
            </View>
          </Pressable>

          <Pressable
            style={[styles.settingRow, isDeleting && styles.settingRowDisabled]}
            onPress={handleDeleteAccount}
            disabled={isDeleting}
          >
            <View style={styles.settingInfo}>
              {isDeleting ? (
                <ActivityIndicator size="small" color="#E74C3C" />
              ) : (
                <FontAwesome name="trash" size={20} color="#E74C3C" />
              )}
              <Text style={[styles.settingText, { color: '#E74C3C' }]}>
                {isDeleting ? 'Deleting...' : 'Delete Account'}
              </Text>
            </View>
          </Pressable>
        </View>

        {/* App Info */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Scholar Homes v1.0.0</Text>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  section: {
    backgroundColor: '#fff',
    marginTop: 16,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingVertical: 12,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  settingRowDisabled: {
    opacity: 0.6,
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  settingText: {
    fontSize: 16,
    color: '#333',
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  footerText: {
    fontSize: 14,
    color: '#999',
  },
});
