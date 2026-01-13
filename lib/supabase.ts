import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Database } from './database.types';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://dskotrgrgyalztofzlhr.supabase.co';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRza290cmdyZ3lhbHp0b2Z6bGhyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcxMTk5ODMsImV4cCI6MjA4MjY5NTk4M30.Ah7RY8DVBP1_mxMqEdhZzCg1kAK543CTnHOKqhR8CxU';

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
