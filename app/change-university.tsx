import { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { FontAwesome } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

interface HipolabsUniversity {
  name: string;
  domains: string[];
  web_pages: string[];
  country: string;
  alpha_two_code: string;
  'state-province': string | null;
}

interface UniversityResult {
  id?: string;
  name: string;
  domain?: string;
  isLocal: boolean;
}

export default function ChangeUniversityScreen() {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<UniversityResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedItem, setSelectedItem] = useState<UniversityResult | null>(null);
  const [currentUniversity, setCurrentUniversity] = useState<string | null>(null);
  const { profile, updateProfile } = useAuth();
  const router = useRouter();

  const handleBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/edit-profile');
    }
  }, [router]);

  useEffect(() => {
    if (profile?.university_id) {
      fetchCurrentUniversity();
    }
  }, [profile?.university_id]);

  const fetchCurrentUniversity = async () => {
    const { data } = await supabase
      .from('universities')
      .select('name')
      .eq('id', profile?.university_id)
      .single();

    if (data) {
      setCurrentUniversity(data.name);
    }
  };

  // Debounced search
  useEffect(() => {
    if (search.trim().length < 2) {
      setResults([]);
      return;
    }

    const timeoutId = setTimeout(() => {
      searchUniversities(search.trim());
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [search]);

  const searchUniversities = async (query: string) => {
    setIsSearching(true);

    try {
      const [localResults, apiResults] = await Promise.all([
        searchLocalUniversities(query),
        searchHipolabsAPI(query),
      ]);

      const localNames = new Set(localResults.map((u) => u.name.toLowerCase()));
      const filteredApiResults = apiResults.filter(
        (u) => !localNames.has(u.name.toLowerCase())
      );

      setResults([...localResults, ...filteredApiResults]);
    } catch (error) {
      console.error('Error searching universities:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const searchLocalUniversities = async (query: string): Promise<UniversityResult[]> => {
    const { data, error } = await supabase
      .from('universities')
      .select('id, name, domain')
      .ilike('name', `%${query}%`)
      .limit(10);

    if (error) {
      console.error('Error searching local universities:', error);
      return [];
    }

    return (data || []).map((u) => ({
      id: u.id,
      name: u.name,
      domain: u.domain,
      isLocal: true,
    }));
  };

  const searchHipolabsAPI = async (query: string): Promise<UniversityResult[]> => {
    try {
      const response = await fetch(
        `https://universities.hipolabs.com/search?name=${encodeURIComponent(query)}&country=united+states`
      );
      const data: HipolabsUniversity[] = await response.json();

      return data.slice(0, 20).map((u) => ({
        name: u.name,
        domain: u.domains?.[0],
        isLocal: false,
      }));
    } catch (error) {
      console.error('Error fetching from Hipolabs:', error);
      return [];
    }
  };

  const handleSelect = async (item: UniversityResult) => {
    // Confirm change
    Alert.alert(
      'Change University',
      `Are you sure you want to change your university to ${item.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Change',
          onPress: () => performChange(item),
        },
      ]
    );
  };

  const performChange = async (item: UniversityResult) => {
    setSelectedItem(item);

    try {
      let universityId = item.id;

      // If it's from the API, create it first
      if (!item.isLocal) {
        const { data: newUni, error: createError } = await supabase
          .from('universities')
          .insert({
            name: item.name,
            domain: item.domain || null,
          })
          .select()
          .single();

        if (createError) {
          const { data: existingUni } = await supabase
            .from('universities')
            .select('id')
            .eq('name', item.name)
            .single();

          if (existingUni) {
            universityId = existingUni.id;
          } else {
            throw createError;
          }
        } else {
          universityId = newUni.id;
        }
      }

      const { error: updateError } = await updateProfile({ university_id: universityId });

      if (updateError) {
        throw updateError;
      }

      Alert.alert('Success', 'University updated successfully!', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error) {
      console.error('Error changing university:', error);
      Alert.alert('Error', 'Failed to change university');
      setSelectedItem(null);
    }
  };

  const renderUniversity = ({ item }: { item: UniversityResult }) => {
    const isCurrent = item.name === currentUniversity;

    return (
      <Pressable
        style={[
          styles.universityItem,
          selectedItem?.name === item.name && styles.universityItemSelected,
          isCurrent && styles.universityItemCurrent,
        ]}
        onPress={() => handleSelect(item)}
        disabled={selectedItem !== null || isCurrent}
      >
        <View style={styles.universityInfo}>
          <Text style={styles.universityName}>{item.name}</Text>
          {item.domain && (
            <Text style={styles.universityDomain}>{item.domain}</Text>
          )}
        </View>
        {selectedItem?.name === item.name ? (
          <ActivityIndicator size="small" color="#4A90E2" />
        ) : isCurrent ? (
          <View style={styles.currentBadge}>
            <Text style={styles.currentBadgeText}>Current</Text>
          </View>
        ) : item.isLocal ? (
          <View style={styles.localBadge}>
            <Text style={styles.localBadgeText}>Saved</Text>
          </View>
        ) : null}
      </Pressable>
    );
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Change University',
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
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {currentUniversity && (
          <View style={styles.currentSection}>
            <Text style={styles.currentLabel}>Current University</Text>
            <View style={styles.currentRow}>
              <FontAwesome name="university" size={18} color="#4A90E2" />
              <Text style={styles.currentName}>{currentUniversity}</Text>
            </View>
          </View>
        )}

        <View style={styles.searchContainer}>
          <FontAwesome name="search" size={18} color="#999" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search for a new university..."
            placeholderTextColor="#999"
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {isSearching && (
            <ActivityIndicator size="small" color="#4A90E2" />
          )}
          {search.length > 0 && !isSearching && (
            <Pressable onPress={() => setSearch('')}>
              <FontAwesome name="times-circle" size={18} color="#999" />
            </Pressable>
          )}
        </View>

        {search.length < 2 ? (
          <View style={styles.hintContainer}>
            <Text style={styles.hintText}>
              Search for any US university to change your school
            </Text>
          </View>
        ) : results.length > 0 ? (
          <FlatList
            data={results}
            renderItem={renderUniversity}
            keyExtractor={(item, index) => item.id || `api-${index}-${item.name}`}
            style={styles.list}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          />
        ) : !isSearching ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No universities found</Text>
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  currentSection: {
    padding: 16,
    backgroundColor: '#F8F9FA',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  currentLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  currentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  currentName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingHorizontal: 16,
    margin: 16,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 12,
    fontSize: 16,
    color: '#333',
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
  },
  universityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    marginBottom: 8,
  },
  universityItemSelected: {
    backgroundColor: '#E3F2FD',
    borderColor: '#4A90E2',
    borderWidth: 1,
  },
  universityItemCurrent: {
    backgroundColor: '#E8F5E9',
    opacity: 0.7,
  },
  universityInfo: {
    flex: 1,
    marginRight: 12,
  },
  universityName: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  universityDomain: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  localBadge: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  localBadgeText: {
    fontSize: 11,
    color: '#4CAF50',
    fontWeight: '600',
  },
  currentBadge: {
    backgroundColor: '#4A90E2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  currentBadgeText: {
    fontSize: 11,
    color: '#fff',
    fontWeight: '600',
  },
  hintContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingBottom: 100,
  },
  hintText: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 100,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
  },
});
