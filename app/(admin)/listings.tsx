import { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  Pressable,
  Image,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';

interface Listing {
  id: string;
  title: string;
  price: number;
  status: string;
  created_at: string;
  images: string[];
  profiles: {
    full_name: string;
    email: string;
  };
  universities: {
    name: string;
  };
}

export default function AdminListingsScreen() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'active' | 'paused' | 'rented'>('all');
  const router = useRouter();

  const fetchListings = useCallback(async () => {
    let query = supabase
      .from('listings')
      .select(`
        id,
        title,
        price,
        status,
        created_at,
        images,
        profiles!listings_user_id_fkey (full_name, email),
        universities (name)
      `)
      .order('created_at', { ascending: false });

    if (filter !== 'all') {
      query = query.eq('status', filter);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching listings:', error);
    } else {
      setListings(data as unknown as Listing[]);
    }
    setIsLoading(false);
    setRefreshing(false);
  }, [filter]);

  useEffect(() => {
    fetchListings();
  }, [fetchListings]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchListings();
  };

  const handleStatusChange = async (listingId: string, newStatus: string) => {
    const { error } = await supabase
      .from('listings')
      .update({ status: newStatus })
      .eq('id', listingId);

    if (error) {
      Alert.alert('Error', 'Failed to update listing status');
    } else {
      fetchListings();
    }
  };

  const handleDelete = (listingId: string, title: string) => {
    Alert.alert(
      'Delete Listing',
      `Are you sure you want to delete "${title}"? This cannot be undone.`,
      [
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
      ]
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return '#50C878';
      case 'paused':
        return '#FFA500';
      case 'rented':
        return '#999';
      default:
        return '#666';
    }
  };

  const renderListing = ({ item }: { item: Listing }) => (
    <View style={styles.listingCard}>
      <Image
        source={{ uri: item.images?.[0] || 'https://via.placeholder.com/100' }}
        style={styles.listingImage}
      />
      <View style={styles.listingInfo}>
        <Text style={styles.listingTitle} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={styles.listingPrice}>${item.price}/mo</Text>
        <Text style={styles.listingMeta} numberOfLines={1}>
          By: {item.profiles?.full_name || 'Unknown'}
        </Text>
        <Text style={styles.listingMeta} numberOfLines={1}>
          {item.universities?.name}
        </Text>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
          <Text style={styles.statusText}>{item.status}</Text>
        </View>
      </View>
      <View style={styles.actions}>
        <Pressable
          style={[styles.actionButton, { backgroundColor: '#4A90E2' }]}
          onPress={() => router.push(`/edit-listing/${item.id}`)}
        >
          <FontAwesome name="pencil" size={14} color="#fff" />
        </Pressable>
        {item.status === 'active' && (
          <Pressable
            style={[styles.actionButton, { backgroundColor: '#FFA500' }]}
            onPress={() => handleStatusChange(item.id, 'paused')}
          >
            <FontAwesome name="pause" size={14} color="#fff" />
          </Pressable>
        )}
        {item.status === 'paused' && (
          <Pressable
            style={[styles.actionButton, { backgroundColor: '#50C878' }]}
            onPress={() => handleStatusChange(item.id, 'active')}
          >
            <FontAwesome name="play" size={14} color="#fff" />
          </Pressable>
        )}
        <Pressable
          style={[styles.actionButton, { backgroundColor: '#E74C3C' }]}
          onPress={() => handleDelete(item.id, item.title)}
        >
          <FontAwesome name="trash" size={14} color="#fff" />
        </Pressable>
      </View>
    </View>
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
      {/* Filter Tabs */}
      <View style={styles.filterTabs}>
        {(['all', 'active', 'paused', 'rented'] as const).map((f) => (
          <Pressable
            key={f}
            style={[styles.filterTab, filter === f && styles.filterTabActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterTabText, filter === f && styles.filterTabTextActive]}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </Pressable>
        ))}
      </View>

      <FlatList
        data={listings}
        renderItem={renderListing}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <FontAwesome name="list" size={48} color="#ccc" />
            <Text style={styles.emptyText}>No listings found</Text>
          </View>
        }
      />
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
  filterTabs: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  filterTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
  },
  filterTabActive: {
    backgroundColor: '#4A90E2',
  },
  filterTabText: {
    fontSize: 14,
    color: '#666',
  },
  filterTabTextActive: {
    color: '#fff',
    fontWeight: '600',
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
  },
  listingInfo: {
    flex: 1,
    marginLeft: 12,
  },
  listingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  listingPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4A90E2',
    marginTop: 2,
  },
  listingMeta: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginTop: 4,
  },
  statusText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  actions: {
    justifyContent: 'center',
    gap: 8,
  },
  actionButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    marginTop: 12,
  },
});
