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
  TextInput,
} from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';

interface User {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: string;
  is_banned: boolean;
  created_at: string;
  universities: {
    name: string;
  } | null;
  listing_count?: number;
}

export default function AdminUsersScreen() {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'user' | 'admin' | 'banned'>('all');

  const fetchUsers = useCallback(async () => {
    let query = supabase
      .from('profiles')
      .select(`
        id,
        email,
        full_name,
        avatar_url,
        role,
        is_banned,
        created_at,
        universities (name)
      `)
      .order('created_at', { ascending: false });

    if (filter === 'banned') {
      query = query.eq('is_banned', true);
    } else if (filter !== 'all') {
      query = query.eq('role', filter).eq('is_banned', false);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching users:', error);
    } else {
      // Fetch listing counts for each user
      const usersWithCounts = await Promise.all(
        (data || []).map(async (user) => {
          const { count } = await supabase
            .from('listings')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id);
          return { ...user, listing_count: count || 0 } as User;
        })
      );
      setUsers(usersWithCounts);
    }
    setIsLoading(false);
    setRefreshing(false);
  }, [filter]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchUsers();
  };

  const handleRoleChange = async (userId: string, currentRole: string) => {
    const newRole = currentRole === 'admin' ? 'user' : 'admin';
    const action = newRole === 'admin' ? 'promote to admin' : 'demote to user';

    Alert.alert(
      'Change Role',
      `Are you sure you want to ${action}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            const { error } = await supabase
              .from('profiles')
              .update({ role: newRole })
              .eq('id', userId);

            if (error) {
              Alert.alert('Error', 'Failed to update user role');
            } else {
              fetchUsers();
            }
          },
        },
      ]
    );
  };

  const handleViewListings = async (userId: string, userName: string) => {
    const { data, error } = await supabase
      .from('listings')
      .select('id, title, status')
      .eq('user_id', userId);

    if (error) {
      Alert.alert('Error', 'Failed to fetch user listings');
      return;
    }

    if (!data || data.length === 0) {
      Alert.alert('No Listings', `${userName} has no listings.`);
      return;
    }

    const listingInfo = data
      .map((l) => `- ${l.title} (${l.status})`)
      .join('\n');

    Alert.alert(`${userName}'s Listings`, listingInfo);
  };

  const handleBanUser = async (userId: string, userName: string, isBanned: boolean) => {
    const action = isBanned ? 'unban' : 'ban';
    const actionText = isBanned ? 'Unban' : 'Ban';

    Alert.alert(
      `${actionText} User`,
      `Are you sure you want to ${action} ${userName}? ${!isBanned ? 'They will not be able to access the app.' : ''}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: actionText,
          style: isBanned ? 'default' : 'destructive',
          onPress: async () => {
            const { error } = await supabase
              .from('profiles')
              .update({ is_banned: !isBanned })
              .eq('id', userId);

            if (error) {
              Alert.alert('Error', `Failed to ${action} user`);
            } else {
              // If banning, also pause all their listings
              if (!isBanned) {
                await supabase
                  .from('listings')
                  .update({ status: 'paused' })
                  .eq('user_id', userId);
              }
              fetchUsers();
            }
          },
        },
      ]
    );
  };

  const filteredUsers = users.filter((user) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      user.email?.toLowerCase().includes(query) ||
      user.full_name?.toLowerCase().includes(query)
    );
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const renderUser = ({ item }: { item: User }) => (
    <View style={[styles.userCard, item.is_banned && styles.userCardBanned]}>
      <View style={styles.userHeader}>
        {item.avatar_url ? (
          <Image source={{ uri: item.avatar_url }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <FontAwesome name="user" size={20} color="#999" />
          </View>
        )}
        <View style={styles.userInfo}>
          <View style={styles.userNameRow}>
            <Text style={styles.userName}>{item.full_name || 'No name'}</Text>
            {item.is_banned && (
              <View style={styles.bannedBadge}>
                <Text style={styles.bannedText}>BANNED</Text>
              </View>
            )}
          </View>
          <Text style={styles.userEmail}>{item.email}</Text>
          <Text style={styles.userMeta}>
            {item.universities?.name || 'No university'} | Joined {formatDate(item.created_at)}
          </Text>
        </View>
        {!item.is_banned && (
          <View
            style={[
              styles.roleBadge,
              { backgroundColor: item.role === 'admin' ? '#4A90E2' : '#50C878' },
            ]}
          >
            <Text style={styles.roleText}>{item.role}</Text>
          </View>
        )}
      </View>

      <View style={styles.userStats}>
        <View style={styles.stat}>
          <Text style={styles.statNumber}>{item.listing_count || 0}</Text>
          <Text style={styles.statLabel}>Listings</Text>
        </View>
      </View>

      <View style={styles.actions}>
        <Pressable
          style={[styles.actionButton, { backgroundColor: '#4A90E2' }]}
          onPress={() => handleViewListings(item.id, item.full_name || 'User')}
        >
          <FontAwesome name="list" size={14} color="#fff" />
          <Text style={styles.actionButtonText}>Listings</Text>
        </Pressable>

        {!item.is_banned && (
          <Pressable
            style={[
              styles.actionButton,
              { backgroundColor: item.role === 'admin' ? '#FFA500' : '#50C878' },
            ]}
            onPress={() => handleRoleChange(item.id, item.role)}
          >
            <FontAwesome name={item.role === 'admin' ? 'arrow-down' : 'arrow-up'} size={14} color="#fff" />
            <Text style={styles.actionButtonText}>
              {item.role === 'admin' ? 'Demote' : 'Promote'}
            </Text>
          </Pressable>
        )}

        <Pressable
          style={[
            styles.actionButton,
            { backgroundColor: item.is_banned ? '#50C878' : '#E74C3C' },
          ]}
          onPress={() => handleBanUser(item.id, item.full_name || 'User', item.is_banned)}
        >
          <FontAwesome name={item.is_banned ? 'unlock' : 'ban'} size={14} color="#fff" />
          <Text style={styles.actionButtonText}>
            {item.is_banned ? 'Unban' : 'Ban'}
          </Text>
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
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <FontAwesome name="search" size={16} color="#999" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name or email..."
          placeholderTextColor="#999"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <Pressable onPress={() => setSearchQuery('')}>
            <FontAwesome name="times-circle" size={16} color="#999" />
          </Pressable>
        )}
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterTabs}>
        {(['all', 'user', 'admin', 'banned'] as const).map((f) => (
          <Pressable
            key={f}
            style={[
              styles.filterTab,
              filter === f && styles.filterTabActive,
              f === 'banned' && filter === f && styles.filterTabBanned,
            ]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterTabText, filter === f && styles.filterTabTextActive]}>
              {f === 'all' ? 'All' : f === 'banned' ? 'Banned' : f.charAt(0).toUpperCase() + f.slice(1) + 's'}
            </Text>
          </Pressable>
        ))}
      </View>

      <FlatList
        data={filteredUsers}
        renderItem={renderUser}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <FontAwesome name="users" size={48} color="#ccc" />
            <Text style={styles.emptyText}>No users found</Text>
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 16,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333',
  },
  filterTabs: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  filterTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  filterTabActive: {
    backgroundColor: '#4A90E2',
    borderColor: '#4A90E2',
  },
  filterTabBanned: {
    backgroundColor: '#E74C3C',
    borderColor: '#E74C3C',
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
    paddingTop: 0,
  },
  userCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  userCardBanned: {
    borderWidth: 2,
    borderColor: '#E74C3C',
    backgroundColor: '#FFF5F5',
  },
  userHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userInfo: {
    flex: 1,
    marginLeft: 12,
  },
  userNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  bannedBadge: {
    backgroundColor: '#E74C3C',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  bannedText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  userEmail: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  userMeta: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  roleBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  roleText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  userStats: {
    flexDirection: 'row',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  stat: {
    alignItems: 'center',
    marginRight: 24,
  },
  statNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4A90E2',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
  },
  actions: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
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
