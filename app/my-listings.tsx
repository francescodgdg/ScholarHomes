import { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  Pressable,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { FontAwesome } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Listing } from '@/lib/database.types';

export default function MyListingsScreen() {
  const [listings, setListings] = useState<Listing[]>([]);
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
    fetchListings();
  }, []);

  const fetchListings = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('listings')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching listings:', error);
    } else {
      setListings(data || []);
    }
    setIsLoading(false);
  };

  const updateStatus = async (listingId: string, newStatus: string) => {
    const { error } = await supabase
      .from('listings')
      .update({ status: newStatus })
      .eq('id', listingId);

    if (error) {
      Alert.alert('Error', 'Failed to update listing');
    } else {
      fetchListings();
    }
  };

  const deleteListing = async (listingId: string) => {
    Alert.alert('Delete Listing', 'Are you sure you want to delete this listing?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase
            .from('listings')
            .delete()
            .eq('id', listingId);

          if (error) {
            Alert.alert('Error', 'Failed to delete listing');
          } else {
            fetchListings();
          }
        },
      },
    ]);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return '#50C878';
      case 'paused': return '#FFB347';
      case 'rented': return '#4A90E2';
      default: return '#999';
    }
  };

  const renderListing = ({ item }: { item: Listing }) => (
    <View style={styles.listingCard}>
      <Pressable
        style={styles.listingContent}
        onPress={() => router.push(`/listing/${item.id}`)}
      >
        <Image
          source={{ uri: item.images?.[0] || 'https://via.placeholder.com/80' }}
          style={styles.listingImage}
        />
        <View style={styles.listingInfo}>
          <Text style={styles.listingTitle} numberOfLines={1}>{item.title}</Text>
          <Text style={styles.listingPrice}>${item.price}/mo</Text>
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, { backgroundColor: getStatusColor(item.status) }]} />
            <Text style={styles.statusText}>{item.status}</Text>
          </View>
        </View>
      </Pressable>

      <View style={styles.actions}>
        {item.status === 'active' ? (
          <Pressable
            style={styles.actionButton}
            onPress={() => updateStatus(item.id, 'paused')}
          >
            <FontAwesome name="pause" size={16} color="#FFB347" />
          </Pressable>
        ) : item.status === 'paused' ? (
          <Pressable
            style={styles.actionButton}
            onPress={() => updateStatus(item.id, 'active')}
          >
            <FontAwesome name="play" size={16} color="#50C878" />
          </Pressable>
        ) : null}

        <Pressable
          style={styles.actionButton}
          onPress={() => updateStatus(item.id, 'rented')}
        >
          <FontAwesome name="check" size={16} color="#4A90E2" />
        </Pressable>

        <Pressable
          style={styles.actionButton}
          onPress={() => deleteListing(item.id)}
        >
          <FontAwesome name="trash" size={16} color="#E74C3C" />
        </Pressable>
      </View>
    </View>
  );

  return (
    <>
      <Stack.Screen
        options={{
          title: 'My Listings',
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
            data={listings}
            renderItem={renderListing}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <FontAwesome name="list" size={48} color="#ccc" />
                <Text style={styles.emptyTitle}>No listings yet</Text>
                <Text style={styles.emptyText}>Create your first listing to get started</Text>
                <Pressable
                  style={styles.createButton}
                  onPress={() => router.push('/(tabs)/create')}
                >
                  <Text style={styles.createButtonText}>Create Listing</Text>
                </Pressable>
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
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  listingContent: {
    flexDirection: 'row',
    padding: 12,
  },
  listingImage: {
    width: 70,
    height: 70,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
  },
  listingInfo: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  listingTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  listingPrice: {
    fontSize: 18,
    fontWeight: '600',
    color: '#4A90E2',
    marginTop: 2,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    color: '#666',
    textTransform: 'capitalize',
  },
  actions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  actionButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: '#f0f0f0',
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
  createButton: {
    marginTop: 24,
    backgroundColor: '#4A90E2',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
