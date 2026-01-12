import { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';

interface Stats {
  activeListings: number;
  totalUsers: number;
  totalListings: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats>({
    activeListings: 0,
    totalUsers: 0,
    totalListings: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    // Get active listings count
    const { count: activeCount } = await supabase
      .from('listings')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active');

    // Get total listings count
    const { count: totalListings } = await supabase
      .from('listings')
      .select('*', { count: 'exact', head: true });

    // Get total users count
    const { count: totalUsers } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true });

    setStats({
      activeListings: activeCount || 0,
      totalUsers: totalUsers || 0,
      totalListings: totalListings || 0,
    });
    setIsLoading(false);
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

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Dashboard Overview</Text>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{stats.activeListings}</Text>
            <Text style={styles.statLabel}>Active Listings</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{stats.totalListings}</Text>
            <Text style={styles.statLabel}>Total Listings</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{stats.totalUsers}</Text>
            <Text style={styles.statLabel}>Users</Text>
          </View>
        </View>

        {/* Quick Actions */}
        <Text style={styles.sectionTitle}>Quick Actions</Text>

        <Pressable
          style={styles.actionCard}
          onPress={() => router.push('/(admin)/listings')}
        >
          <View style={styles.actionIcon}>
            <FontAwesome name="list" size={24} color="#4A90E2" />
          </View>
          <View style={styles.actionInfo}>
            <Text style={styles.actionTitle}>Manage Listings</Text>
            <Text style={styles.actionDescription}>
              View, edit, pause, or remove listings
            </Text>
          </View>
          <FontAwesome name="chevron-right" size={16} color="#999" />
        </Pressable>

        <Pressable
          style={styles.actionCard}
          onPress={() => router.push('/(admin)/users')}
        >
          <View style={styles.actionIcon}>
            <FontAwesome name="users" size={24} color="#50C878" />
          </View>
          <View style={styles.actionInfo}>
            <Text style={styles.actionTitle}>Manage Users</Text>
            <Text style={styles.actionDescription}>
              View users, ban/unban accounts
            </Text>
          </View>
          <FontAwesome name="chevron-right" size={16} color="#999" />
        </Pressable>

        <Pressable
          style={styles.backButton}
          onPress={() => router.replace('/(tabs)')}
        >
          <FontAwesome name="arrow-left" size={16} color="#666" />
          <Text style={styles.backButtonText}>Back to App</Text>
        </Pressable>
      </View>
    </ScrollView>
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
  content: {
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 32,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  statNumber: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#4A90E2',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  actionInfo: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  actionDescription: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    marginTop: 24,
  },
  backButtonText: {
    fontSize: 16,
    color: '#666',
  },
});
