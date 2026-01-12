import { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  FlatList,
  Pressable,
  Image,
  ActivityIndicator,
  Modal,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { FontAwesome } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { ListingWithUser } from '@/lib/database.types';

const UNIVERSITY_STORAGE_KEY = '@selected_university';

interface University {
  id: string;
  name: string;
}

interface Filters {
  listingType: 'all' | 'sublet' | 'rental';
  priceMin: string;
  priceMax: string;
  bedrooms: string;
}

export default function SearchScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [listings, setListings] = useState<ListingWithUser[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [universityName, setUniversityName] = useState<string | null>(null);
  const [showAllSchools, setShowAllSchools] = useState(true);
  const [selectedUniversityId, setSelectedUniversityId] = useState<string | null>(null);
  const [selectedUniversityName, setSelectedUniversityName] = useState<string | null>(null);
  const [universities, setUniversities] = useState<University[]>([]);
  const [universitySearch, setUniversitySearch] = useState('');
  const [showUniversityPicker, setShowUniversityPicker] = useState(false);
  const [filters, setFilters] = useState<Filters>({
    listingType: 'all',
    priceMin: '',
    priceMax: '',
    bedrooms: '',
  });
  const { profile } = useAuth();
  const router = useRouter();

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

  // Load saved university selection on mount
  useEffect(() => {
    loadSavedUniversity();
  }, []);

  const loadSavedUniversity = async () => {
    try {
      const saved = await AsyncStorage.getItem(UNIVERSITY_STORAGE_KEY);
      if (saved) {
        const { id, name, showAll } = JSON.parse(saved);
        setSelectedUniversityId(id);
        setSelectedUniversityName(name);
        setShowAllSchools(showAll !== false); // Default to true for search
      }
    } catch (error) {
      console.log('Error loading saved university:', error);
    }
  };

  const saveUniversitySelection = async (id: string | null, name: string | null, showAll: boolean) => {
    try {
      await AsyncStorage.setItem(UNIVERSITY_STORAGE_KEY, JSON.stringify({ id, name, showAll }));
    } catch (error) {
      console.log('Error saving university selection:', error);
    }
  };

  const searchUniversities = async (query: string) => {
    if (query.length < 2) {
      setUniversities([]);
      return;
    }

    try {
      const { data } = await supabase
        .from('universities')
        .select('id, name')
        .ilike('name', `%${query}%`)
        .order('name', { ascending: true })
        .limit(50);

      setUniversities(data || []);
    } catch (error) {
      console.error('Error searching universities:', error);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      searchUniversities(universitySearch);
    }, 300);
    return () => clearTimeout(timer);
  }, [universitySearch]);

  // Clear universities when modal closes
  useEffect(() => {
    if (!showUniversityPicker) {
      setUniversities([]);
      setUniversitySearch('');
    }
  }, [showUniversityPicker]);

  const getDisplayUniversityName = () => {
    // Only show selected university if we have a valid ID to filter by
    if (selectedUniversityId && selectedUniversityName) {
      return selectedUniversityName;
    }
    if (showAllSchools) return 'All Schools';
    return universityName || 'My School';
  };

  const searchListings = async () => {
    setIsLoading(true);
    let query = supabase
      .from('listings')
      .select(`
        *,
        profiles:user_id (id, full_name, avatar_url),
        universities:university_id (id, name)
      `)
      .eq('status', 'active');

    if (searchQuery.trim()) {
      query = query.or(`title.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%,address.ilike.%${searchQuery}%`);
    }

    // Filter by university
    if (selectedUniversityId) {
      query = query.eq('university_id', selectedUniversityId);
    } else if (!showAllSchools && profile?.university_id) {
      query = query.eq('university_id', profile.university_id);
    }

    if (filters.listingType !== 'all') {
      query = query.eq('listing_type', filters.listingType);
    }

    if (filters.priceMin) {
      query = query.gte('price', parseInt(filters.priceMin));
    }

    if (filters.priceMax) {
      query = query.lte('price', parseInt(filters.priceMax));
    }

    if (filters.bedrooms) {
      query = query.eq('bedrooms', parseInt(filters.bedrooms));
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      console.error('Error searching listings:', error);
    } else {
      setListings((data as unknown as ListingWithUser[]) || []);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    searchListings();
  }, [selectedUniversityId, showAllSchools]);

  const applyFilters = () => {
    setShowFilters(false);
    searchListings();
  };

  const resetFilters = () => {
    setFilters({
      listingType: 'all',
      priceMin: '',
      priceMax: '',
      bedrooms: '',
    });
    setSelectedUniversityId(null);
    setSelectedUniversityName(null);
    setShowAllSchools(true);
  };

  const renderListing = ({ item }: { item: ListingWithUser }) => (
    <Pressable
      style={styles.listingCard}
      onPress={() => router.push(`/listing/${item.id}`)}
    >
      <Image
        source={{
          uri: item.images?.[0] || 'https://via.placeholder.com/150',
        }}
        style={styles.listingImage}
      />
      <View style={styles.listingInfo}>
        <Text style={styles.listingPrice}>${item.price}/mo</Text>
        <Text style={styles.listingTitle} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={styles.listingDetails}>
          {item.bedrooms} bed · {item.bathrooms} bath
        </Text>
        {item.address && (
          <Text style={styles.listingAddress} numberOfLines={1}>
            {item.address}
          </Text>
        )}
      </View>
    </Pressable>
  );

  return (
    <View style={styles.container}>
      {/* University Selector */}
      <Pressable
        style={styles.universitySelector}
        onPress={() => setShowUniversityPicker(true)}
      >
        <FontAwesome name="university" size={14} color="#4A90E2" />
        <Text style={styles.universitySelectorText} numberOfLines={1}>
          {getDisplayUniversityName()}
        </Text>
        <FontAwesome name="chevron-down" size={12} color="#999" />
      </Pressable>

      <View style={styles.header}>
        <View style={styles.searchContainer}>
          <FontAwesome name="search" size={18} color="#999" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search listings..."
            placeholderTextColor="#999"
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={searchListings}
            returnKeyType="search"
          />
        </View>
        <Pressable style={styles.filterButton} onPress={() => setShowFilters(true)}>
          <FontAwesome name="sliders" size={20} color="#4A90E2" />
        </Pressable>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4A90E2" />
        </View>
      ) : (
        <FlatList
          data={listings}
          renderItem={renderListing}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <FontAwesome name="search" size={48} color="#ccc" />
              <Text style={styles.emptyTitle}>No listings found</Text>
              <Text style={styles.emptyText}>
                Try adjusting your search or filters
              </Text>
            </View>
          }
        />
      )}

      {/* University Picker Modal */}
      <Modal visible={showUniversityPicker} animationType="slide">
        <View style={styles.universityPickerContainer}>
          <View style={styles.universityPickerContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select School</Text>
              <Pressable onPress={() => {
                setShowUniversityPicker(false);
                setUniversitySearch('');
                setUniversities([]);
              }}>
                <FontAwesome name="close" size={24} color="#333" />
              </Pressable>
            </View>

            <View style={styles.uniSearchContainer}>
              <FontAwesome name="search" size={16} color="#999" />
              <TextInput
                style={styles.uniSearchInput}
                placeholder="Search universities..."
                placeholderTextColor="#999"
                value={universitySearch}
                onChangeText={setUniversitySearch}
                autoFocus
              />
              {universitySearch.length > 0 && (
                <Pressable onPress={() => setUniversitySearch('')}>
                  <FontAwesome name="times-circle" size={16} color="#999" />
                </Pressable>
              )}
            </View>

            <ScrollView style={styles.universityList}>
              <Pressable
                style={styles.universityOption}
                onPress={() => {
                  setSelectedUniversityId(null);
                  setSelectedUniversityName(null);
                  setShowAllSchools(false);
                  saveUniversitySelection(null, null, false);
                  setShowUniversityPicker(false);
                  setUniversitySearch('');
                  setUniversities([]);
                  searchListings();
                }}
              >
                <FontAwesome name="home" size={16} color="#4A90E2" />
                <Text style={styles.universityOptionText}>My School ({universityName})</Text>
              </Pressable>

              <Pressable
                style={styles.universityOption}
                onPress={() => {
                  setSelectedUniversityId(null);
                  setSelectedUniversityName(null);
                  setShowAllSchools(true);
                  saveUniversitySelection(null, null, true);
                  setShowUniversityPicker(false);
                  setUniversitySearch('');
                  setUniversities([]);
                  searchListings();
                }}
              >
                <FontAwesome name="globe" size={16} color="#4A90E2" />
                <Text style={styles.universityOptionText}>All Schools</Text>
              </Pressable>

              {universities.map((uni: University, index: number) => (
                <Pressable
                  key={`${uni.id}-${index}`}
                  style={styles.universityOption}
                  onPress={() => {
                    setSelectedUniversityId(uni.id);
                    setSelectedUniversityName(uni.name);
                    setShowAllSchools(false);
                    saveUniversitySelection(uni.id, uni.name, false);
                    setShowUniversityPicker(false);
                    setUniversitySearch('');
                    setUniversities([]);
                  }}
                >
                  <FontAwesome name="university" size={16} color="#666" />
                  <Text style={styles.universityOptionText}>{uni.name}</Text>
                </Pressable>
              ))}

              {universitySearch.length < 2 && universities.length === 0 && (
                <Text style={styles.noResultsText}>Type at least 2 characters to search</Text>
              )}

              {universitySearch.length >= 2 && universities.length === 0 && (
                <Text style={styles.noResultsText}>No universities found</Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Filter Modal */}
      <Modal visible={showFilters} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filters</Text>
              <Pressable onPress={() => setShowFilters(false)}>
                <FontAwesome name="close" size={24} color="#333" />
              </Pressable>
            </View>

            <ScrollView style={styles.modalBody}>
              <Text style={styles.filterLabel}>Listing Type</Text>
              <View style={styles.filterOptions}>
                {(['all', 'sublet', 'rental'] as const).map((type) => (
                  <Pressable
                    key={type}
                    style={[
                      styles.filterOption,
                      filters.listingType === type && styles.filterOptionActive,
                    ]}
                    onPress={() => setFilters({ ...filters, listingType: type })}
                  >
                    <Text
                      style={[
                        styles.filterOptionText,
                        filters.listingType === type && styles.filterOptionTextActive,
                      ]}
                    >
                      {type === 'all' ? 'All' : type.charAt(0).toUpperCase() + type.slice(1)}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.filterLabel}>Price Range</Text>
              <View style={styles.priceRange}>
                <TextInput
                  style={styles.priceInput}
                  placeholder="Min"
                  placeholderTextColor="#999"
                  value={filters.priceMin}
                  onChangeText={(text) => setFilters({ ...filters, priceMin: text })}
                  keyboardType="numeric"
                />
                <Text style={styles.priceSeparator}>-</Text>
                <TextInput
                  style={styles.priceInput}
                  placeholder="Max"
                  placeholderTextColor="#999"
                  value={filters.priceMax}
                  onChangeText={(text) => setFilters({ ...filters, priceMax: text })}
                  keyboardType="numeric"
                />
              </View>

              <Text style={styles.filterLabel}>Bedrooms</Text>
              <View style={styles.filterOptions}>
                {['', '1', '2', '3', '4'].map((num) => (
                  <Pressable
                    key={num}
                    style={[
                      styles.filterOption,
                      filters.bedrooms === num && styles.filterOptionActive,
                    ]}
                    onPress={() => setFilters({ ...filters, bedrooms: num })}
                  >
                    <Text
                      style={[
                        styles.filterOptionText,
                        filters.bedrooms === num && styles.filterOptionTextActive,
                      ]}
                    >
                      {num === '' ? 'Any' : num === '4' ? '4+' : num}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <Pressable style={styles.resetButton} onPress={resetFilters}>
                <Text style={styles.resetButtonText}>Reset</Text>
              </Pressable>
              <Pressable style={styles.applyButton} onPress={applyFilters}>
                <Text style={styles.applyButtonText}>Apply Filters</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  universitySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    gap: 8,
  },
  universitySelectorText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    gap: 12,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingHorizontal: 14,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 10,
    fontSize: 16,
    color: '#333',
  },
  filterButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: 16,
  },
  listingCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  listingImage: {
    width: 120,
    height: 100,
    backgroundColor: '#f0f0f0',
  },
  listingInfo: {
    flex: 1,
    padding: 12,
  },
  listingPrice: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  listingTitle: {
    fontSize: 14,
    color: '#333',
    marginTop: 2,
  },
  listingDetails: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  listingAddress: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    paddingBottom: 34,
  },
  universityPickerContainer: {
    flex: 1,
    backgroundColor: '#fff',
    paddingTop: 60,
  },
  universityPickerContent: {
    flex: 1,
    paddingBottom: 34,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
  },
  modalBody: {
    padding: 20,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
    marginTop: 16,
  },
  filterOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterOption: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#F5F5F5',
    borderRadius: 20,
  },
  filterOptionActive: {
    backgroundColor: '#4A90E2',
  },
  filterOptionText: {
    fontSize: 14,
    color: '#666',
  },
  filterOptionTextActive: {
    color: '#fff',
  },
  priceRange: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  priceInput: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#333',
  },
  priceSeparator: {
    fontSize: 16,
    color: '#666',
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  resetButton: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
  },
  resetButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  applyButton: {
    flex: 2,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: '#4A90E2',
    borderRadius: 12,
  },
  applyButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  uniSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    marginHorizontal: 20,
    marginBottom: 16,
    paddingHorizontal: 14,
    gap: 10,
  },
  uniSearchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333',
  },
  universityList: {
    flex: 1,
    paddingHorizontal: 20,
  },
  universityOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    gap: 12,
  },
  universityOptionText: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  noResultsText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    paddingVertical: 20,
  },
});
