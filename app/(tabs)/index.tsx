import { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  Pressable,
  Image,
  RefreshControl,
  ActivityIndicator,
  Modal,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { FontAwesome } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

const UNIVERSITY_STORAGE_KEY = '@selected_university';

interface University {
  id: string;
  name: string;
}

interface Listing {
  id: string;
  title: string;
  price: number;
  bedrooms: number;
  bathrooms: number;
  images: string[];
  listing_type: 'sublet' | 'rental';
  amenities: string[];
  created_at: string;
  profiles: {
    full_name: string | null;
    avatar_url: string | null;
  } | null;
}

type SortOption = 'newest' | 'price_low' | 'price_high';
type ListingTypeFilter = 'all' | 'sublet' | 'rental';

interface AdvancedFilters {
  priceMin: string;
  priceMax: string;
  bedrooms: string;
  bathrooms: string;
  amenities: string[];
}

const AMENITY_OPTIONS = [
  'Furnished',
  'Pet Friendly',
  'Parking',
  'In-unit Laundry',
  'Utilities Included',
  'Air Conditioning',
  'Dishwasher',
  'Gym Access',
];

const defaultFilters: AdvancedFilters = {
  priceMin: '',
  priceMax: '',
  bedrooms: '',
  bathrooms: '',
  amenities: [],
};

export default function HomeScreen() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [universityName, setUniversityName] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [listingType, setListingType] = useState<ListingTypeFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  // Advanced filters (applied on "Apply" click)
  const [filters, setFilters] = useState<AdvancedFilters>(defaultFilters);
  const [tempFilters, setTempFilters] = useState<AdvancedFilters>(defaultFilters);
  const [showAllSchools, setShowAllSchools] = useState(false);
  const [selectedUniversityId, setSelectedUniversityId] = useState<string | null>(null);
  const [selectedUniversityName, setSelectedUniversityName] = useState<string | null>(null);
  const [universities, setUniversities] = useState<University[]>([]);
  const [universitySearch, setUniversitySearch] = useState('');
  const [showUniversityPicker, setShowUniversityPicker] = useState(false);
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
        setShowAllSchools(showAll || false);
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

  const fetchListings = useCallback(async () => {
    let query = supabase
      .from('listings')
      .select(`
        id,
        title,
        price,
        bedrooms,
        bathrooms,
        images,
        listing_type,
        amenities,
        created_at,
        profiles (full_name, avatar_url)
      `)
      .eq('status', 'active');

    // Filter by search query
    if (searchQuery.trim()) {
      query = query.or(`title.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%,address.ilike.%${searchQuery}%`);
    }

    // Filter by university
    if (selectedUniversityId) {
      query = query.eq('university_id', selectedUniversityId);
    } else if (!showAllSchools && profile?.university_id) {
      query = query.eq('university_id', profile.university_id);
    }

    // Filter by listing type
    if (listingType !== 'all') {
      query = query.eq('listing_type', listingType);
    }

    // Advanced filters
    if (filters.priceMin) {
      query = query.gte('price', parseInt(filters.priceMin));
    }
    if (filters.priceMax) {
      query = query.lte('price', parseInt(filters.priceMax));
    }
    if (filters.bedrooms) {
      query = query.gte('bedrooms', parseInt(filters.bedrooms));
    }
    if (filters.bathrooms) {
      query = query.gte('bathrooms', parseInt(filters.bathrooms));
    }
    // Filter by amenities (must contain all selected amenities)
    if (filters.amenities.length > 0) {
      query = query.contains('amenities', filters.amenities);
    }

    // Apply sorting
    if (sortBy === 'newest') {
      query = query.order('created_at', { ascending: false });
    } else if (sortBy === 'price_low') {
      query = query.order('price', { ascending: true });
    } else if (sortBy === 'price_high') {
      query = query.order('price', { ascending: false });
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching listings:', error);
    } else {
      setListings(data || []);
    }
    setIsLoading(false);
    setIsRefreshing(false);
  }, [profile?.university_id, sortBy, listingType, showAllSchools, selectedUniversityId, filters, searchQuery]);

  useEffect(() => {
    fetchListings();
  }, [fetchListings]);

  const onRefresh = () => {
    setIsRefreshing(true);
    fetchListings();
  };

  const getActiveFilterCount = () => {
    let count = 0;
    if (filters.priceMin || filters.priceMax) count++;
    if (filters.bedrooms) count++;
    if (filters.bathrooms) count++;
    if (filters.amenities.length > 0) count += filters.amenities.length;
    return count;
  };

  const toggleTempAmenity = (amenity: string) => {
    setTempFilters(prev => ({
      ...prev,
      amenities: prev.amenities.includes(amenity)
        ? prev.amenities.filter(a => a !== amenity)
        : [...prev.amenities, amenity]
    }));
  };

  const getDisplayUniversityName = () => {
    // Only show selected university if we have a valid ID to filter by
    if (selectedUniversityId && selectedUniversityName) {
      return selectedUniversityName;
    }
    if (showAllSchools) return 'All Schools';
    return universityName || 'Select a School';
  };

  const renderListing = ({ item }: { item: Listing }) => (
    <Pressable
      style={styles.listingCard}
      onPress={() => router.push(`/listing/${item.id}`)}
    >
      {item.images?.length > 0 && (
        <Image
          source={{ uri: item.images[0] }}
          style={styles.listingImage}
        />
      )}
      <View style={[styles.listingBadge, !item.images?.length && styles.listingBadgeNoImage]}>
        <Text style={styles.badgeText}>
          {item.listing_type === 'sublet' ? 'Sublet' : 'Rental'}
        </Text>
      </View>
      <View style={styles.listingInfo}>
        <Text style={styles.listingPrice}>${item.price}/mo</Text>
        <Text style={styles.listingTitle} numberOfLines={1}>
          {item.title}
        </Text>
        <View style={styles.listingMeta}>
          <FontAwesome name="bed" size={12} color="#666" />
          <Text style={styles.metaText}>{item.bedrooms} bed</Text>
          <FontAwesome name="bath" size={12} color="#666" style={{ marginLeft: 12 }} />
          <Text style={styles.metaText}>{item.bathrooms} bath</Text>
        </View>
      </View>
    </Pressable>
  );

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4A90E2" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header with university and filters */}
      <View style={styles.header}>
        <Pressable
          style={styles.universityHeader}
          onPress={() => setShowUniversityPicker(true)}
        >
          <FontAwesome name="university" size={16} color="#4A90E2" />
          <Text style={styles.universityName} numberOfLines={1}>
            {getDisplayUniversityName()}
          </Text>
          <FontAwesome name="chevron-down" size={12} color="#999" />
        </Pressable>
        <Pressable
          style={styles.filterButton}
          onPress={() => {
            setTempFilters(filters);
            setShowFilters(true);
          }}
        >
          <FontAwesome name="sliders" size={18} color="#4A90E2" />
          {getActiveFilterCount() > 0 && (
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeText}>{getActiveFilterCount()}</Text>
            </View>
          )}
        </Pressable>
      </View>

      {/* Search Bar */}
      <View style={styles.searchBarContainer}>
        <FontAwesome name="search" size={16} color="#999" style={styles.searchIcon} />
        <TextInput
          style={styles.searchBar}
          placeholder="Search listings..."
          placeholderTextColor="#999"
          value={searchQuery}
          onChangeText={setSearchQuery}
          returnKeyType="search"
        />
        {searchQuery.length > 0 && (
          <Pressable onPress={() => setSearchQuery('')} style={styles.clearSearch}>
            <FontAwesome name="times-circle" size={16} color="#999" />
          </Pressable>
        )}
      </View>

      {/* Quick filter chips */}
      <View style={styles.chipsWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipsContainer}
          contentContainerStyle={styles.chipsContent}
        >
          <Pressable
            style={[styles.chip, listingType === 'all' && styles.chipActive]}
            onPress={() => setListingType('all')}
          >
            <Text style={[styles.chipText, listingType === 'all' && styles.chipTextActive]}>
              All
            </Text>
          </Pressable>
          <Pressable
            style={[styles.chip, listingType === 'sublet' && styles.chipActive]}
            onPress={() => setListingType('sublet')}
          >
            <Text style={[styles.chipText, listingType === 'sublet' && styles.chipTextActive]}>
              Sublets
            </Text>
          </Pressable>
          <Pressable
            style={[styles.chip, listingType === 'rental' && styles.chipActive]}
            onPress={() => setListingType('rental')}
          >
            <Text style={[styles.chipText, listingType === 'rental' && styles.chipTextActive]}>
              Rentals
            </Text>
          </Pressable>
          <View style={styles.chipDivider} />
          <Pressable
            style={[styles.chip, sortBy === 'newest' && styles.chipActive]}
            onPress={() => setSortBy('newest')}
          >
            <Text style={[styles.chipText, sortBy === 'newest' && styles.chipTextActive]}>
              Newest
            </Text>
          </Pressable>
          <Pressable
            style={[styles.chip, sortBy === 'price_low' && styles.chipActive]}
            onPress={() => setSortBy('price_low')}
          >
            <Text style={[styles.chipText, sortBy === 'price_low' && styles.chipTextActive]}>
              $ Low
            </Text>
          </Pressable>
          <Pressable
            style={[styles.chip, sortBy === 'price_high' && styles.chipActive]}
            onPress={() => setSortBy('price_high')}
          >
            <Text style={[styles.chipText, sortBy === 'price_high' && styles.chipTextActive]}>
              $ High
            </Text>
          </Pressable>
        </ScrollView>
        <LinearGradient
          colors={['rgba(255,255,255,0)', 'rgba(255,255,255,1)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.chipsFade}
          pointerEvents="none"
        />
      </View>

      {/* Listings count */}
      <View style={styles.resultsHeader}>
        <Text style={styles.resultsCount}>
          {listings.length} listing{listings.length !== 1 ? 's' : ''} available
        </Text>
      </View>

      {/* Listings grid */}
      <FlatList
        data={listings}
        renderItem={renderListing}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <FontAwesome name="home" size={48} color="#ccc" />
            <Text style={styles.emptyText}>No listings available</Text>
            <Text style={styles.emptySubtext}>
              {showAllSchools
                ? 'Check back later for new listings'
                : 'Try viewing all schools or check back later'}
            </Text>
            {!showAllSchools && (
              <Pressable
                style={styles.viewAllButton}
                onPress={() => {
                  setShowAllSchools(true);
                  setSelectedUniversityId(null);
                  setSelectedUniversityName(null);
                  saveUniversitySelection(null, null, true);
                }}
              >
                <Text style={styles.viewAllButtonText}>View All Schools</Text>
              </Pressable>
            )}
          </View>
        }
      />

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

            <View style={styles.searchContainer}>
              <FontAwesome name="search" size={16} color="#999" />
              <TextInput
                style={styles.searchInput}
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

            <ScrollView style={styles.universityList} keyboardShouldPersistTaps="handled">
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
                }}
              >
                <FontAwesome name="globe" size={16} color="#4A90E2" />
                <Text style={styles.universityOptionText}>All Schools</Text>
              </Pressable>

              {universities.map((uni: any, index: number) => (
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

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {/* Price Range */}
              <Text style={styles.filterLabel}>Price Range</Text>
              <View style={styles.priceRangeContainer}>
                <View style={styles.priceInputContainer}>
                  <Text style={styles.priceInputLabel}>Min</Text>
                  <TextInput
                    style={styles.priceInput}
                    placeholder="$0"
                    placeholderTextColor="#999"
                    keyboardType="numeric"
                    value={tempFilters.priceMin}
                    onChangeText={(text) => setTempFilters(prev => ({ ...prev, priceMin: text }))}
                  />
                </View>
                <Text style={styles.priceSeparator}>–</Text>
                <View style={styles.priceInputContainer}>
                  <Text style={styles.priceInputLabel}>Max</Text>
                  <TextInput
                    style={styles.priceInput}
                    placeholder="Any"
                    placeholderTextColor="#999"
                    keyboardType="numeric"
                    value={tempFilters.priceMax}
                    onChangeText={(text) => setTempFilters(prev => ({ ...prev, priceMax: text }))}
                  />
                </View>
              </View>

              {/* Bedrooms */}
              <Text style={styles.filterLabel}>Bedrooms</Text>
              <View style={styles.filterOptions}>
                {['', '1', '2', '3', '4'].map((num) => (
                  <Pressable
                    key={`bed-${num}`}
                    style={[styles.filterOption, tempFilters.bedrooms === num && styles.filterOptionActive]}
                    onPress={() => setTempFilters(prev => ({ ...prev, bedrooms: num }))}
                  >
                    <Text style={[styles.filterOptionText, tempFilters.bedrooms === num && styles.filterOptionTextActive]}>
                      {num === '' ? 'Any' : num === '4' ? '4+' : `${num}+`}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {/* Bathrooms */}
              <Text style={styles.filterLabel}>Bathrooms</Text>
              <View style={styles.filterOptions}>
                {['', '1', '2', '3'].map((num) => (
                  <Pressable
                    key={`bath-${num}`}
                    style={[styles.filterOption, tempFilters.bathrooms === num && styles.filterOptionActive]}
                    onPress={() => setTempFilters(prev => ({ ...prev, bathrooms: num }))}
                  >
                    <Text style={[styles.filterOptionText, tempFilters.bathrooms === num && styles.filterOptionTextActive]}>
                      {num === '' ? 'Any' : num === '3' ? '3+' : `${num}+`}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {/* Amenities */}
              <Text style={styles.filterLabel}>Amenities</Text>
              <View style={styles.amenitiesGrid}>
                {AMENITY_OPTIONS.map((amenity) => (
                  <Pressable
                    key={amenity}
                    style={[
                      styles.amenityChip,
                      tempFilters.amenities.includes(amenity) && styles.amenityChipActive,
                    ]}
                    onPress={() => toggleTempAmenity(amenity)}
                  >
                    <FontAwesome
                      name={tempFilters.amenities.includes(amenity) ? 'check-square' : 'square-o'}
                      size={16}
                      color={tempFilters.amenities.includes(amenity) ? '#4A90E2' : '#666'}
                    />
                    <Text
                      style={[
                        styles.amenityChipText,
                        tempFilters.amenities.includes(amenity) && styles.amenityChipTextActive,
                      ]}
                    >
                      {amenity}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <Pressable
                style={styles.resetButton}
                onPress={() => setTempFilters(defaultFilters)}
              >
                <Text style={styles.resetButtonText}>Reset</Text>
              </Pressable>
              <Pressable
                style={styles.applyButton}
                onPress={() => {
                  setFilters(tempFilters);
                  setShowFilters(false);
                }}
              >
                <Text style={styles.applyButtonText}>Apply</Text>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  universityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 8,
    marginRight: 12,
  },
  universityName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  filterButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 20,
    position: 'relative',
  },
  filterBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#E74C3C',
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 10,
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchBar: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333',
  },
  clearSearch: {
    padding: 4,
  },
  chipsWrapper: {
    position: 'relative',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  chipsContainer: {
    maxHeight: 52,
  },
  chipsFade: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 1,
    width: 40,
  },
  chipsContent: {
    paddingLeft: 12,
    paddingRight: 48,
    paddingVertical: 10,
    alignItems: 'center',
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#F5F5F5',
    borderRadius: 20,
    marginRight: 8,
  },
  chipActive: {
    backgroundColor: '#4A90E2',
  },
  chipText: {
    fontSize: 13,
    color: '#666',
    fontWeight: '500',
  },
  chipTextActive: {
    color: '#fff',
  },
  chipDivider: {
    width: 1,
    height: 20,
    backgroundColor: '#e0e0e0',
    marginHorizontal: 4,
  },
  resultsHeader: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#F8F9FA',
  },
  resultsCount: {
    fontSize: 13,
    color: '#666',
  },
  listContent: {
    padding: 8,
  },
  row: {
    justifyContent: 'space-between',
  },
  listingCard: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  listingImage: {
    width: '100%',
    height: 120,
    backgroundColor: '#f0f0f0',
  },
  listingBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(74, 144, 226, 0.9)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  listingBadgeNoImage: {
    position: 'relative',
    top: 0,
    left: 0,
    alignSelf: 'flex-start',
    margin: 12,
    marginBottom: 0,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  listingInfo: {
    padding: 12,
  },
  listingPrice: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
  },
  listingTitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  listingMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  metaText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  viewAllButton: {
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#4A90E2',
    borderRadius: 20,
  },
  viewAllButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
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
    maxHeight: '85%',
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
    marginTop: 8,
  },
  filterOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  filterOption: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: '#F5F5F5',
    borderRadius: 16,
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
  priceRangeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  priceInputContainer: {
    flex: 1,
  },
  priceInputLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  priceInput: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#333',
  },
  priceSeparator: {
    fontSize: 18,
    color: '#999',
    marginTop: 16,
  },
  amenitiesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  amenityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    gap: 8,
  },
  amenityChipActive: {
    backgroundColor: '#E8F1FC',
  },
  amenityChipText: {
    fontSize: 14,
    color: '#666',
  },
  amenityChipTextActive: {
    color: '#4A90E2',
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    marginHorizontal: 20,
    marginBottom: 16,
    paddingHorizontal: 14,
    gap: 10,
  },
  searchInput: {
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
  searchResultsDivider: {
    paddingTop: 16,
    paddingBottom: 8,
  },
  searchResultsLabel: {
    fontSize: 12,
    color: '#999',
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  noResultsText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    paddingVertical: 20,
  },
});
