import { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
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

export default function SelectUniversityScreen() {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<UniversityResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedItem, setSelectedItem] = useState<UniversityResult | null>(null);
  const { updateProfile } = useAuth();
  const router = useRouter();

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
      // Search both local database and Hipolabs API in parallel
      const [localResults, apiResults] = await Promise.all([
        searchLocalUniversities(query),
        searchHipolabsAPI(query),
      ]);

      // Combine results, prioritizing local matches
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
        `http://universities.hipolabs.com/search?name=${encodeURIComponent(query)}&country=united+states`
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
    setSelectedItem(item);
    setIsLoading(true);

    try {
      let universityId = item.id;

      // If it's from the API (not local), create it in our database first
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
          // University might already exist (race condition), try to find it
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

      // Update user profile with selected university
      const { error: updateError } = await updateProfile({ university_id: universityId });

      if (updateError) {
        throw updateError;
      }

      router.replace('/(auth)/complete-profile');
    } catch (error) {
      console.error('Error selecting university:', error);
      setSelectedItem(null);
    } finally {
      setIsLoading(false);
    }
  };

  const renderUniversity = ({ item }: { item: UniversityResult }) => (
    <Pressable
      style={[
        styles.universityItem,
        selectedItem?.name === item.name && styles.universityItemSelected,
      ]}
      onPress={() => handleSelect(item)}
      disabled={selectedItem !== null}
    >
      <View style={styles.universityInfo}>
        <Text style={styles.universityName}>{item.name}</Text>
        {item.domain && (
          <Text style={styles.universityDomain}>{item.domain}</Text>
        )}
      </View>
      {selectedItem?.name === item.name ? (
        <ActivityIndicator size="small" color="#4A90E2" />
      ) : item.isLocal ? (
        <View style={styles.localBadge}>
          <Text style={styles.localBadgeText}>Saved</Text>
        </View>
      ) : null}
    </Pressable>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Select Your University</Text>
        <Text style={styles.subtitle}>
          Search for your school to connect with other students
        </Text>

        <View style={styles.searchContainer}>
          <FontAwesome name="search" size={18} color="#999" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search any US university..."
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
            <FontAwesome name="university" size={48} color="#E0E0E0" />
            <Text style={styles.hintText}>
              Start typing to search thousands of US universities
            </Text>
          </View>
        ) : results.length > 0 ? (
          <>
            <Text style={styles.sectionTitle}>
              {results.length} {results.length === 1 ? 'Result' : 'Results'}
            </Text>
            <FlatList
              data={results}
              renderItem={renderUniversity}
              keyExtractor={(item, index) => item.id || `api-${index}-${item.name}`}
              style={styles.list}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            />
          </>
        ) : !isSearching ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No universities found</Text>
            <Text style={styles.emptySubtext}>
              Try a different search term
            </Text>
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 24,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 12,
    fontSize: 16,
    color: '#333',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  list: {
    flex: 1,
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
  hintContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 100,
  },
  hintText: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
    marginTop: 16,
    paddingHorizontal: 32,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 100,
  },
  emptyText: {
    fontSize: 18,
    color: '#666',
    fontWeight: '500',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
  },
});
