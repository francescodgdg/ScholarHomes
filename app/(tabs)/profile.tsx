import { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  Image,
  ScrollView,
  Alert,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { FontAwesome } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Listing, University } from '@/lib/database.types';

export default function ProfileScreen() {
  const [myListings, setMyListings] = useState<Listing[]>([]);
  const [listingsCount, setListingsCount] = useState(0);
  const [university, setUniversity] = useState<University | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { user, profile, signOut } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user) {
      fetchUserData();
    }
  }, [user?.id, profile?.university_id]);

  const fetchUserData = async () => {
    if (!user) return;

    // Run all fetches in parallel for faster loading
    const [listingsResult, countResult, universityResult] = await Promise.all([
      // Fetch only first 3 listings with minimal fields
      supabase
        .from('listings')
        .select('id, title, price, status, images')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(3),
      // Get total count separately
      supabase
        .from('listings')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id),
      // Fetch university if we have one
      profile?.university_id
        ? supabase
            .from('universities')
            .select('id, name')
            .eq('id', profile.university_id)
            .single()
        : Promise.resolve({ data: null }),
    ]);

    if (!listingsResult.error) {
      setMyListings(listingsResult.data || []);
    }

    if (!countResult.error) {
      setListingsCount(countResult.count || 0);
    }

    if (universityResult.data) {
      setUniversity(universityResult.data as University);
    }

    setIsLoading(false);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchUserData();
    setRefreshing(false);
  };

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await signOut();
        },
      },
    ]);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return '#50C878';
      case 'paused':
        return '#FFB347';
      case 'rented':
        return '#4A90E2';
      default:
        return '#999';
    }
  };

  const renderListingItem = ({ item }: { item: Listing }) => (
    <Pressable
      style={styles.listingItem}
      onPress={() => router.push(`/listing/${item.id}`)}
    >
      <Image
        source={{
          uri: item.images?.[0] || 'https://via.placeholder.com/80',
        }}
        style={styles.listingImage}
      />
      <View style={styles.listingInfo}>
        <Text style={styles.listingTitle} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={styles.listingPrice}>${item.price}/mo</Text>
        <View style={styles.statusBadge}>
          <View
            style={[
              styles.statusDot,
              { backgroundColor: getStatusColor(item.status) },
            ]}
          />
          <Text style={styles.statusText}>
            {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
          </Text>
        </View>
      </View>
      <FontAwesome name="chevron-right" size={16} color="#999" />
    </Pressable>
  );

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Profile Header */}
        <View style={styles.header}>
          <View style={styles.avatarSection}>
            {profile?.avatar_url ? (
              <Image
                source={{ uri: profile.avatar_url }}
                style={styles.avatar}
              />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <FontAwesome name="user" size={40} color="#999" />
              </View>
            )}
          </View>
          <Text style={styles.userName}>{profile?.full_name || 'User'}</Text>
          <Text style={styles.userUniversity}>
            {university?.name || 'No university selected'}
          </Text>
        </View>

        {/* Menu Items */}
        <View style={styles.menuSection}>
          <Pressable
            style={styles.menuItem}
            onPress={() => router.push('/my-listings')}
          >
            <View style={styles.menuIcon}>
              <FontAwesome name="list" size={20} color="#4A90E2" />
            </View>
            <Text style={styles.menuText}>My Listings</Text>
            <View style={styles.menuBadge}>
              <Text style={styles.menuBadgeText}>{listingsCount}</Text>
            </View>
            <FontAwesome name="chevron-right" size={16} color="#999" />
          </Pressable>

          <Pressable style={styles.menuItem} onPress={() => router.push('/saved')}>
            <View style={styles.menuIcon}>
              <FontAwesome name="heart" size={20} color="#E74C3C" />
            </View>
            <Text style={styles.menuText}>Saved</Text>
            <FontAwesome name="chevron-right" size={16} color="#999" />
          </Pressable>

          <Pressable
            style={styles.menuItem}
            onPress={() => router.push('/edit-profile')}
          >
            <View style={styles.menuIcon}>
              <FontAwesome name="pencil" size={20} color="#50C878" />
            </View>
            <Text style={styles.menuText}>Edit Profile</Text>
            <FontAwesome name="chevron-right" size={16} color="#999" />
          </Pressable>

          <Pressable style={styles.menuItem} onPress={() => router.push('/settings')}>
            <View style={styles.menuIcon}>
              <FontAwesome name="cog" size={20} color="#666" />
            </View>
            <Text style={styles.menuText}>Settings</Text>
            <FontAwesome name="chevron-right" size={16} color="#999" />
          </Pressable>
        </View>

        {/* My Listings Preview */}
        {(isLoading || myListings.length > 0) && (
          <View style={styles.listingsSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>My Listings</Text>
              <Pressable onPress={() => router.push('/my-listings')}>
                <Text style={styles.seeAllText}>See All</Text>
              </Pressable>
            </View>
            {isLoading ? (
              <View style={styles.listingsLoading}>
                <ActivityIndicator size="small" color="#4A90E2" />
              </View>
            ) : (
              myListings.map((listing) => (
                <View key={listing.id}>
                  {renderListingItem({ item: listing })}
                </View>
              ))
            )}
          </View>
        )}

        {/* Admin Access */}
        {profile?.role === 'admin' && (
          <View style={styles.adminSection}>
            <Pressable
              style={styles.adminButton}
              onPress={() => router.push('/(admin)')}
            >
              <FontAwesome name="shield" size={20} color="#fff" />
              <Text style={styles.adminButtonText}>Admin Dashboard</Text>
            </Pressable>
          </View>
        )}

        {/* Sign Out */}
        <View style={styles.signOutSection}>
          <Pressable style={styles.signOutButton} onPress={handleSignOut}>
            <FontAwesome name="sign-out" size={20} color="#E74C3C" />
            <Text style={styles.signOutText}>Sign Out</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  listingsLoading: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  header: {
    backgroundColor: '#fff',
    alignItems: 'center',
    paddingVertical: 32,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  avatarSection: {
    marginBottom: 16,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  userUniversity: {
    fontSize: 16,
    color: '#666',
    marginTop: 4,
  },
  menuSection: {
    backgroundColor: '#fff',
    marginTop: 16,
    paddingHorizontal: 16,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  menuIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  menuText: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  menuBadge: {
    backgroundColor: '#4A90E2',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
  },
  menuBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  listingsSection: {
    backgroundColor: '#fff',
    marginTop: 16,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  seeAllText: {
    fontSize: 14,
    color: '#4A90E2',
    fontWeight: '500',
  },
  listingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  listingImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
  },
  listingInfo: {
    flex: 1,
    marginLeft: 12,
  },
  listingTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  listingPrice: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4A90E2',
    marginTop: 2,
  },
  statusBadge: {
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
  },
  adminSection: {
    paddingHorizontal: 16,
    marginTop: 16,
  },
  adminButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#333',
    paddingVertical: 16,
    borderRadius: 12,
  },
  adminButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  signOutSection: {
    paddingHorizontal: 16,
    marginTop: 24,
    marginBottom: 40,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#fff',
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E74C3C',
  },
  signOutText: {
    color: '#E74C3C',
    fontSize: 16,
    fontWeight: '600',
  },
});
