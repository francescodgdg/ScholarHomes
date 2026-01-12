import { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  Image,
  Pressable,
  Dimensions,
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome } from '@expo/vector-icons';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { ListingWithUser } from '@/lib/database.types';

const { width } = Dimensions.get('window');

interface Coordinates {
  latitude: number;
  longitude: number;
}

export default function ListingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [listing, setListing] = useState<ListingWithUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaved, setIsSaved] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [coordinates, setCoordinates] = useState<Coordinates | null>(null);
  const { user, profile } = useAuth();
  const router = useRouter();

  const handleBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
  }, [router]);

  useEffect(() => {
    fetchListing();
    checkIfSaved();
  }, [id]);

  // Geocode address when listing loads
  useEffect(() => {
    if (listing?.address) {
      geocodeAddress(listing.address);
    }
  }, [listing?.address]);

  const geocodeAddress = async (address: string) => {
    try {
      const results = await Location.geocodeAsync(address);
      if (results.length > 0) {
        setCoordinates({
          latitude: results[0].latitude,
          longitude: results[0].longitude,
        });
      }
    } catch (error) {
      console.log('Geocoding error:', error);
    }
  };

  const openInMaps = () => {
    if (!coordinates || !listing?.address) return;

    const { latitude, longitude } = coordinates;
    const label = encodeURIComponent(listing.address);

    const url = Platform.select({
      ios: `maps:0,0?q=${label}@${latitude},${longitude}`,
      android: `geo:0,0?q=${latitude},${longitude}(${label})`,
    });

    if (url) {
      Linking.openURL(url);
    }
  };

  const fetchListing = async () => {
    const { data, error } = await supabase
      .from('listings')
      .select(`
        *,
        profiles:user_id (id, full_name, avatar_url),
        universities:university_id (id, name)
      `)
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching listing:', error);
      Alert.alert('Error', 'Listing not found');
      router.back();
    } else {
      setListing(data as unknown as ListingWithUser);
    }
    setIsLoading(false);
  };

  const checkIfSaved = async () => {
    if (!user) return;

    const { data } = await supabase
      .from('saved_listings')
      .select('id')
      .eq('user_id', user.id)
      .eq('listing_id', id)
      .single();

    setIsSaved(!!data);
  };

  const toggleSave = async () => {
    if (!user) {
      Alert.alert('Sign in required', 'Please sign in to save listings');
      return;
    }

    if (isSaved) {
      await supabase
        .from('saved_listings')
        .delete()
        .eq('user_id', user.id)
        .eq('listing_id', id);
      setIsSaved(false);
    } else {
      await supabase
        .from('saved_listings')
        .insert({ user_id: user.id, listing_id: id });
      setIsSaved(true);
    }
  };

  const startConversation = async () => {
    if (!user || !listing) return;

    if (user.id === listing.user_id) {
      Alert.alert('Error', "You can't message yourself");
      return;
    }

    // Check if conversation already exists
    const { data: existingConversation } = await supabase
      .from('conversations')
      .select(`
        id,
        conversation_participants!inner (user_id)
      `)
      .eq('listing_id', listing.id);

    const existing = existingConversation?.find((conv: any) =>
      conv.conversation_participants.some((p: any) => p.user_id === user.id)
    );

    if (existing) {
      router.push(`/chat/${existing.id}`);
      return;
    }

    // Create new conversation
    const { data: newConversation, error: convError } = await supabase
      .from('conversations')
      .insert({ listing_id: listing.id })
      .select()
      .single();

    if (convError) {
      Alert.alert('Error', 'Failed to start conversation');
      return;
    }

    // Add participants
    await supabase.from('conversation_participants').insert([
      { conversation_id: newConversation.id, user_id: user.id },
      { conversation_id: newConversation.id, user_id: listing.user_id },
    ]);

    router.push(`/chat/${newConversation.id}`);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Flexible';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4A90E2" />
        </View>
      </SafeAreaView>
    );
  }

  if (!listing) return null;

  return (
    <>
      <Stack.Screen
        options={{
          title: '',
          headerShadowVisible: false,
          headerBackVisible: false,
          headerStyle: { backgroundColor: '#fff' },
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
          headerRight: () => (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {/* Edit button - show for owner or admin */}
              {(user?.id === listing.user_id || profile?.role === 'admin') && (
                <Pressable
                  onPress={() => router.push(`/edit-listing/${listing.id}`)}
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
                  <FontAwesome name="pencil" size={16} color="#4A90E2" />
                </Pressable>
              )}
              {/* Save button */}
              <Pressable
                onPress={toggleSave}
                style={{ padding: 8 }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <FontAwesome
                  name={isSaved ? 'heart' : 'heart-o'}
                  size={22}
                  color={isSaved ? '#E74C3C' : '#333'}
                />
              </Pressable>
            </View>
          ),
        }}
      />
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {/* Image Gallery - Only show if there are images */}
        {listing.images?.length > 0 && (
          <View style={styles.imageContainer}>
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(e) => {
                const index = Math.round(e.nativeEvent.contentOffset.x / width);
                setCurrentImageIndex(index);
              }}
            >
              {listing.images.map((uri, index) => (
                <Image key={index} source={{ uri }} style={styles.image} resizeMode="cover" />
              ))}
            </ScrollView>
            {listing.images.length > 1 && (
              <View style={styles.pagination}>
                {listing.images.map((_, index) => (
                  <View
                    key={index}
                    style={[
                      styles.paginationDot,
                      currentImageIndex === index && styles.paginationDotActive,
                    ]}
                  />
                ))}
              </View>
            )}
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {listing.listing_type === 'sublet' ? 'Sublet' : 'Rental'}
              </Text>
            </View>
          </View>
        )}

        {/* Listing Info */}
        <View style={styles.content}>
          {/* Show badge here if no images */}
          {!listing.images?.length && (
            <View style={styles.badgeInline}>
              <Text style={styles.badgeText}>
                {listing.listing_type === 'sublet' ? 'Sublet' : 'Rental'}
              </Text>
            </View>
          )}
          <Text style={styles.price}>${listing.price}/month</Text>
          <Text style={styles.title}>{listing.title}</Text>

          <View style={styles.detailsRow}>
            <View style={styles.detail}>
              <FontAwesome name="bed" size={16} color="#666" />
              <Text style={styles.detailText}>{listing.bedrooms} bed</Text>
            </View>
            <View style={styles.detail}>
              <FontAwesome name="bath" size={16} color="#666" />
              <Text style={styles.detailText}>{listing.bathrooms} bath</Text>
            </View>
          </View>

          {listing.address && (
            <View style={styles.locationRow}>
              <FontAwesome name="map-marker" size={16} color="#4A90E2" />
              <Text style={styles.locationText}>{listing.address}</Text>
            </View>
          )}

          {listing.listing_type === 'sublet' && (
            <View style={styles.dateRow}>
              <FontAwesome name="calendar" size={16} color="#666" />
              <Text style={styles.dateText}>
                {formatDate(listing.available_from)} - {formatDate(listing.available_to)}
              </Text>
            </View>
          )}

          {/* Map Section */}
          {coordinates && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Location</Text>
              <Pressable onPress={openInMaps} style={styles.mapContainer}>
                <MapView
                  style={styles.map}
                  initialRegion={{
                    latitude: coordinates.latitude,
                    longitude: coordinates.longitude,
                    latitudeDelta: 0.01,
                    longitudeDelta: 0.01,
                  }}
                  scrollEnabled={false}
                  zoomEnabled={false}
                  pitchEnabled={false}
                  rotateEnabled={false}
                >
                  <Marker
                    coordinate={coordinates}
                    title={listing.title}
                    description={listing.address || ''}
                  />
                </MapView>
                <View style={styles.mapOverlay}>
                  <FontAwesome name="external-link" size={14} color="#4A90E2" />
                  <Text style={styles.mapOverlayText}>Open in Maps</Text>
                </View>
              </Pressable>
            </View>
          )}

          {/* Description */}
          {listing.description && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Description</Text>
              <Text style={styles.description}>{listing.description}</Text>
            </View>
          )}

          {/* Amenities */}
          {listing.amenities?.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Amenities</Text>
              <View style={styles.amenitiesGrid}>
                {listing.amenities.map((amenity, index) => (
                  <View key={index} style={styles.amenityItem}>
                    <FontAwesome name="check" size={14} color="#50C878" />
                    <Text style={styles.amenityText}>{amenity}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Contact Info for Rentals */}
          {listing.listing_type === 'rental' && (listing as any).contact_phone && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Contact Landlord</Text>
              {(listing as any).contact_name && (
                <Text style={styles.contactName}>{(listing as any).contact_name}</Text>
              )}
              <View style={styles.contactButtons}>
                <Pressable
                  style={styles.callButton}
                  onPress={() => Linking.openURL(`tel:${(listing as any).contact_phone}`)}
                >
                  <FontAwesome name="phone" size={18} color="#fff" />
                  <Text style={styles.callButtonText}>Call</Text>
                </Pressable>
                <Pressable
                  style={styles.textButton}
                  onPress={() => Linking.openURL(`sms:${(listing as any).contact_phone}`)}
                >
                  <FontAwesome name="comment" size={18} color="#4A90E2" />
                  <Text style={styles.textButtonText}>Text</Text>
                </Pressable>
              </View>
              {(listing as any).contact_email && (
                <Pressable
                  style={styles.emailButton}
                  onPress={() => Linking.openURL(`mailto:${(listing as any).contact_email}`)}
                >
                  <FontAwesome name="envelope" size={16} color="#666" />
                  <Text style={styles.emailButtonText}>{(listing as any).contact_email}</Text>
                </Pressable>
              )}
            </View>
          )}

          {/* Posted By */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Posted by</Text>
            <View style={styles.posterInfo}>
              {listing.profiles?.avatar_url ? (
                <Image
                  source={{ uri: listing.profiles.avatar_url }}
                  style={styles.posterAvatar}
                />
              ) : (
                <View style={styles.posterAvatarPlaceholder}>
                  <FontAwesome name="user" size={20} color="#999" />
                </View>
              )}
              <View style={styles.posterDetails}>
                <Text style={styles.posterName}>
                  {listing.profiles?.full_name || 'Anonymous'}
                </Text>
                <Text style={styles.posterUniversity}>
                  {listing.universities?.name}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Spacer for button */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Message Button - Only for sublets */}
      {user?.id !== listing.user_id && listing.listing_type === 'sublet' && (
        <View style={styles.footer}>
          <Pressable style={styles.contactButton} onPress={startConversation}>
            <FontAwesome name="comment" size={20} color="#fff" />
            <Text style={styles.contactButtonText}>
              Message {listing.profiles?.full_name?.split(' ')[0] || 'Poster'}
            </Text>
          </Pressable>
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageContainer: {
    position: 'relative',
  },
  image: {
    width,
    height: 350,
    backgroundColor: '#f5f5f5',
  },
  noImage: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  noImageText: {
    color: '#999',
    marginTop: 8,
  },
  pagination: {
    position: 'absolute',
    bottom: 16,
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  paginationDotActive: {
    backgroundColor: '#fff',
  },
  badge: {
    position: 'absolute',
    top: 16,
    left: 16,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  badgeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  badgeInline: {
    backgroundColor: 'rgba(74, 144, 226, 0.9)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  content: {
    padding: 20,
  },
  price: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
  },
  title: {
    fontSize: 20,
    color: '#333',
    marginTop: 4,
    marginBottom: 16,
  },
  detailsRow: {
    flexDirection: 'row',
    gap: 24,
    marginBottom: 12,
  },
  detail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailText: {
    fontSize: 16,
    color: '#666',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  locationText: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dateText: {
    fontSize: 14,
    color: '#666',
  },
  mapContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  map: {
    width: '100%',
    height: 200,
  },
  mapOverlay: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fff',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  mapOverlayText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4A90E2',
  },
  section: {
    marginTop: 24,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  description: {
    fontSize: 16,
    color: '#666',
    lineHeight: 24,
  },
  amenitiesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  amenityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F8F9FA',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  amenityText: {
    fontSize: 14,
    color: '#333',
  },
  posterInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  posterAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  posterAvatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  posterDetails: {
    marginLeft: 12,
  },
  posterName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  posterUniversity: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  contactName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  contactButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  callButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#50C878',
    paddingVertical: 14,
    borderRadius: 12,
  },
  callButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  textButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#E3F2FD',
    paddingVertical: 14,
    borderRadius: 12,
  },
  textButtonText: {
    color: '#4A90E2',
    fontSize: 16,
    fontWeight: '600',
  },
  emailButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
  },
  emailButtonText: {
    color: '#666',
    fontSize: 14,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    padding: 16,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  contactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#4A90E2',
    paddingVertical: 16,
    borderRadius: 12,
  },
  contactButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});
