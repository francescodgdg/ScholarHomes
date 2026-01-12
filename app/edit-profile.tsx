import { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  Pressable,
  Image,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Linking,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { FontAwesome } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export default function EditProfileScreen() {
  const { user, profile, updateProfile } = useAuth();
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || '');
  const [universityName, setUniversityName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const router = useRouter();

  const handleBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/profile');
    }
  }, [router]);

  useEffect(() => {
    if (profile?.university_id) {
      fetchUniversityName();
    }
  }, [profile?.university_id]);

  const fetchUniversityName = async () => {
    const { data } = await supabase
      .from('universities')
      .select('name')
      .eq('id', profile?.university_id)
      .single();

    if (data) {
      setUniversityName(data.name);
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      await uploadImage(result.assets[0].uri);
    }
  };

  const compressImage = async (uri: string): Promise<string> => {
    try {
      const result = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 400 } }], // Avatar only needs 400px
        { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
      );
      return result.uri;
    } catch (error) {
      console.error('Error compressing image:', error);
      return uri;
    }
  };

  const uploadImage = async (uri: string) => {
    if (!user) return;

    setIsUploadingImage(true);
    try {
      // Compress avatar before uploading
      const compressedUri = await compressImage(uri);
      const fileName = `${user.id}-${Date.now()}.jpg`;

      // Read file as base64
      const base64 = await FileSystem.readAsStringAsync(compressedUri, {
        encoding: 'base64',
      });

      // Upload using base64 directly
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, decode(base64), {
          contentType: 'image/jpeg',
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('avatars').getPublicUrl(fileName);
      setAvatarUrl(data.publicUrl);
    } catch (error) {
      console.error('Error uploading image:', error);
      Alert.alert('Error', 'Failed to upload image. Please check your connection.');
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleSave = async () => {
    if (!fullName.trim()) {
      Alert.alert('Error', 'Please enter your name');
      return;
    }

    setIsLoading(true);
    const { error } = await updateProfile({
      full_name: fullName.trim(),
      avatar_url: avatarUrl || null,
    });
    setIsLoading(false);

    if (error) {
      Alert.alert('Error', error.message);
    } else {
      Alert.alert('Success', 'Profile updated!', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Edit Profile',
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
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.avatarSection}>
            <Pressable style={styles.avatarContainer} onPress={pickImage}>
              {isUploadingImage ? (
                <ActivityIndicator size="large" color="#4A90E2" />
              ) : avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <FontAwesome name="user" size={40} color="#999" />
                </View>
              )}
              <View style={styles.editBadge}>
                <FontAwesome name="camera" size={12} color="#fff" />
              </View>
            </Pressable>
            <Text style={styles.avatarHint}>Tap to change photo</Text>
          </View>

          <View style={styles.form}>
            <Text style={styles.label}>Full Name</Text>
            <TextInput
              style={styles.input}
              value={fullName}
              onChangeText={setFullName}
              placeholder="Enter your name"
              placeholderTextColor="#999"
              autoCapitalize="words"
            />

            <Text style={styles.label}>Email</Text>
            <View style={styles.disabledInput}>
              <Text style={styles.disabledText}>{profile?.email}</Text>
            </View>
            <Text style={styles.hint}>Email cannot be changed</Text>

            <Text style={styles.label}>University</Text>
            <Pressable
              style={styles.universityRow}
              onPress={() => router.push('/change-university')}
            >
              <View style={styles.universityInfo}>
                <FontAwesome name="university" size={18} color="#4A90E2" />
                <Text style={styles.universityText} numberOfLines={1}>
                  {universityName || 'Not selected'}
                </Text>
              </View>
              <View style={styles.changeButton}>
                <Text style={styles.changeButtonText}>Change</Text>
                <FontAwesome name="chevron-right" size={12} color="#4A90E2" />
              </View>
            </Pressable>
          </View>

          <Pressable
            style={[styles.saveButton, isLoading && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={isLoading || isUploadingImage}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.saveButtonText}>Save Changes</Text>
            )}
          </Pressable>

          {/* Support Section */}
          <View style={styles.supportSection}>
            <Pressable
              style={styles.supportRow}
              onPress={() => Linking.openURL('mailto:scholarhomes.app@gmail.com')}
            >
              <FontAwesome name="envelope" size={18} color="#666" />
              <Text style={styles.supportText}>Contact Support</Text>
              <FontAwesome name="chevron-right" size={14} color="#999" />
            </Pressable>

            <Pressable
              style={styles.supportRow}
              onPress={() => Linking.openURL('https://scholar-homes.com/privacy')}
            >
              <FontAwesome name="shield" size={18} color="#666" />
              <Text style={styles.supportText}>Privacy Policy</Text>
              <FontAwesome name="chevron-right" size={14} color="#999" />
            </Pressable>

            <Pressable
              style={styles.supportRow}
              onPress={() => Linking.openURL('https://scholar-homes.com/terms')}
            >
              <FontAwesome name="file-text" size={18} color="#666" />
              <Text style={styles.supportText}>Terms of Service</Text>
              <FontAwesome name="chevron-right" size={14} color="#999" />
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    padding: 24,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  avatarContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  avatarPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  editBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#4A90E2',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
  },
  avatarHint: {
    fontSize: 14,
    color: '#666',
    marginTop: 12,
  },
  form: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
  },
  input: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#333',
  },
  disabledInput: {
    backgroundColor: '#F0F0F0',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  disabledText: {
    fontSize: 16,
    color: '#999',
  },
  hint: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  universityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  universityInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  universityText: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  changeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  changeButtonText: {
    fontSize: 14,
    color: '#4A90E2',
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: '#4A90E2',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 32,
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  supportSection: {
    marginTop: 32,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 24,
  },
  supportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  supportText: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    marginLeft: 12,
  },
});
