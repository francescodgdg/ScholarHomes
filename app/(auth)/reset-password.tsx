import { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export default function ResetPasswordScreen() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { clearPasswordRecovery, signOut } = useAuth();
  const router = useRouter();

  const handleResetPassword = async () => {
    if (!password || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    // Password validation - must be 8+ chars with lowercase + uppercase OR lowercase + number
    if (password.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters');
      return;
    }

    const hasLowercase = /[a-z]/.test(password);
    const hasUppercase = /[A-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);

    if (!hasLowercase || (!hasUppercase && !hasNumber)) {
      Alert.alert(
        'Error',
        'Password must contain lowercase letters and at least one uppercase letter or number'
      );
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    setIsLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setIsLoading(false);

    if (error) {
      Alert.alert('Error', error.message);
    } else {
      // Clear the password recovery state and sign out
      clearPasswordRecovery();
      await signOut();
      Alert.alert('Success', 'Your password has been reset. Please log in with your new password.', [
        { text: 'OK', onPress: () => router.replace('/(auth)/login') },
      ]);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <View style={styles.content}>
          <View style={styles.iconContainer}>
            <FontAwesome name="lock" size={48} color="#4A90E2" />
          </View>

          <Text style={styles.title}>Reset Password</Text>
          <Text style={styles.subtitle}>Enter your new password below</Text>

          <View style={styles.form}>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder="New Password"
                placeholderTextColor="#999"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                textContentType="oneTimeCode"
                autoComplete="off"
              />
              <Pressable
                style={styles.eyeButton}
                onPress={() => setShowPassword(!showPassword)}
              >
                <FontAwesome
                  name={showPassword ? 'eye' : 'eye-slash'}
                  size={20}
                  color="#999"
                />
              </Pressable>
            </View>
            <Text style={styles.hint}>8+ characters, with uppercase or number</Text>

            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder="Confirm New Password"
                placeholderTextColor="#999"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showPassword}
                textContentType="oneTimeCode"
                autoComplete="off"
              />
            </View>

            <Pressable
              style={[styles.button, isLoading && styles.buttonDisabled]}
              onPress={handleResetPassword}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Reset Password</Text>
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 48,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 32,
  },
  form: {
    gap: 16,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingHorizontal: 16,
  },
  input: {
    flex: 1,
    paddingVertical: 16,
    fontSize: 16,
    color: '#333',
  },
  eyeButton: {
    padding: 8,
  },
  hint: {
    fontSize: 14,
    color: '#666',
    marginTop: -8,
    marginLeft: 4,
  },
  button: {
    backgroundColor: '#4A90E2',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});
