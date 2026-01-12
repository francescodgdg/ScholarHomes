import { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  Pressable,
  Image,
  ActivityIndicator,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { FontAwesome } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Listing } from '@/lib/database.types';

interface SavedListingWithDetails {
  id: string;
  listing: Listing;
}

export default function SavedScreen() {
  const [savedListings, setSavedListings] = useState<SavedListingWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();
  const router = useRouter();

  const handleBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/profile');
    }
  }, [router]);

  useEffect(() => {
    fetchSavedListings();
  }, []);

  const fetchSavedListings = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('saved_listings')
      .select(`
        id,
        listing:listings (*)
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching saved listings:', error);
    } else {
      setSavedListings((data as unknown as SavedListingWithDetails[]) || []);
    }
    setIsLoading(false);
  };

  const unsaveListing = async (savedId: string) => {
    await supabase.from('saved_listings').delete().eq('id', savedId);
    fetchSavedListings();
  };

  const renderListing = ({ item }: { item: SavedListingWithDetails }) => {
    const listing = item.listing;
    if (!listing) return null;

    return (
      <Pressable
        style={styles.listingCard}
        onPress={() => router.push(`/listing/${listing.id}`)}
      >
        <Image
          source={{ uri: listing.images?.[0] || 'https://via.placeholder.com/100' }}
          style={styles.listingImage}
        />
        <View style={styles.listingInfo}>
          <Text style={styles.listingPrice}>${listing.price}/mo</Text>
          <Text style={styles.listingTitle} numberOfLines={1}>{listing.title}</Text>
          <Text style={styles.listingDetails}>
            {listing.bedrooms} bed · {listing.bathrooms} bath
          </Text>
        </View>
        <Pressable
          style={styles.unsaveButton}
          onPress={() => unsaveListing(item.id)}
        >
          <FontAwesome name="heart" size={20} color="#E74C3C" />
        </Pressable>
      </Pressable>
    );
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Saved',
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
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#4A90E2" />
          </View>
        ) : (
          <FlatList
            data={savedListings}
            renderItem={renderListing}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <FontAwesome name="heart-o" size={48} color="#ccc" />
                <Text style={styles.emptyTitle}>No saved listings</Text>
                <Text style={styles.emptyText}>
                  Tap the heart icon on listings to save them here
                </Text>
              </View>
            }
          />
        )}
      </View>
    </>
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
  listContent: {
    padding: 16,
  },
  listingCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  listingImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
  },
  listingInfo: {
    flex: 1,
    marginLeft: 12,
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
  unsaveButton: {
    padding: 12,
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
    textAlign: 'center',
  },
});
