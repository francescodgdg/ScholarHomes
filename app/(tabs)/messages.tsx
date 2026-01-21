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
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { FontAwesome } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useMessages } from '@/contexts/MessageContext';

interface ConversationPreview {
  id: string;
  listing_id: string | null;
  other_user: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
  };
  listing: {
    title: string;
    images: string[];
    price: number;
  } | null;
  last_message: {
    content: string;
    created_at: string;
    sender_id: string;
  } | null;
  unread_count: number;
}

export default function MessagesScreen() {
  const [conversations, setConversations] = useState<ConversationPreview[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { user } = useAuth();
  const { refreshUnreadCount } = useMessages();
  const router = useRouter();

  const fetchConversations = useCallback(async () => {
    if (!user) return;

    // Get conversations the user is part of
    const { data: participantData, error: participantError } = await supabase
      .from('conversation_participants')
      .select('conversation_id')
      .eq('user_id', user.id);

    if (participantError) {
      console.error('Error fetching conversations:', participantError);
      setIsLoading(false);
      return;
    }

    if (!participantData?.length) {
      setConversations([]);
      setIsLoading(false);
      setIsRefreshing(false);
      return;
    }

    const conversationIds = participantData.map((p) => p.conversation_id);

    // Get full conversation details
    const { data: conversationsData, error: conversationsError } = await supabase
      .from('conversations')
      .select(`
        id,
        listing_id,
        updated_at,
        listings (title, images, price),
        conversation_participants (user_id),
        messages (content, created_at, sender_id, read)
      `)
      .in('id', conversationIds)
      .order('updated_at', { ascending: false });

    if (conversationsError) {
      console.error('Error fetching conversation details:', conversationsError);
      setIsLoading(false);
      return;
    }

    // Collect all other user IDs to fetch their profiles
    const otherUserIds = new Set<string>();
    (conversationsData || []).forEach((conv: any) => {
      console.log('Conversation participants:', conv.conversation_participants);
      conv.conversation_participants?.forEach((p: any) => {
        if (p.user_id !== user.id) {
          otherUserIds.add(p.user_id);
        }
      });
    });

    console.log('Other user IDs to fetch:', Array.from(otherUserIds));

    // Fetch profiles for all other users
    let profilesMap: Record<string, any> = {};
    if (otherUserIds.size > 0) {
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('id', Array.from(otherUserIds));

      console.log('Profiles fetched:', profilesData);
      console.log('Profiles error:', profilesError);

      if (profilesData) {
        profilesData.forEach((p) => {
          profilesMap[p.id] = p;
        });
      }
    }

    // Process conversations to get preview data
    const previews: ConversationPreview[] = (conversationsData || []).map((conv: any) => {
      // Find the other user's participant record
      const otherParticipant = conv.conversation_participants?.find(
        (p: any) => p.user_id !== user.id
      );

      // Get the other user's profile from our fetched map
      const otherUserProfile = otherParticipant
        ? profilesMap[otherParticipant.user_id]
        : null;

      // Get last message
      const messages = conv.messages || [];
      const lastMessage = messages.length > 0
        ? messages.sort((a: any, b: any) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          )[0]
        : null;

      // Count unread messages
      const unreadCount = messages.filter(
        (m: any) => !m.read && m.sender_id !== user.id
      ).length;

      return {
        id: conv.id,
        listing_id: conv.listing_id,
        other_user: otherUserProfile || { id: '', full_name: 'Unknown', avatar_url: null },
        listing: conv.listings,
        last_message: lastMessage,
        unread_count: unreadCount,
      };
    });

    setConversations(previews);
    setIsLoading(false);
    setIsRefreshing(false);
  }, [user]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // Refresh when screen is focused
  useFocusEffect(
    useCallback(() => {
      fetchConversations();
      refreshUnreadCount();
    }, [fetchConversations, refreshUnreadCount])
  );

  // Real-time subscription for messages and conversations
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('messages-list-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          // Update unread count for the specific conversation
          const newMessage = payload.new as any;
          if (newMessage.sender_id !== user.id) {
            setConversations(prev => prev.map(conv => {
              if (conv.id === newMessage.conversation_id) {
                return {
                  ...conv,
                  unread_count: conv.unread_count + 1,
                  last_message: {
                    content: newMessage.content,
                    created_at: newMessage.created_at,
                    sender_id: newMessage.sender_id,
                  },
                };
              }
              return conv;
            }));
          }
          // Also do a full refresh to ensure consistency
          fetchConversations();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
        },
        () => {
          fetchConversations();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversations',
        },
        () => {
          fetchConversations();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'conversation_participants',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchConversations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchConversations]);

  const onRefresh = () => {
    setIsRefreshing(true);
    fetchConversations();
  };

  const handleDeleteConversation = (conversationId: string, otherUserName: string) => {
    Alert.alert(
      'Delete Conversation',
      `Are you sure you want to delete your conversation with ${otherUserName}? This will remove the thread from your messages.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            // Remove user from conversation participants (soft delete - doesn't delete for other user)
            const { error } = await supabase
              .from('conversation_participants')
              .delete()
              .eq('conversation_id', conversationId)
              .eq('user_id', user?.id);

            if (error) {
              Alert.alert('Error', 'Failed to delete conversation');
            } else {
              // Remove from local state immediately
              setConversations(prev => prev.filter(c => c.id !== conversationId));
              refreshUnreadCount();
            }
          },
        },
      ]
    );
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (days === 1) {
      return 'Yesterday';
    } else if (days < 7) {
      return `${days}d ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const renderConversation = ({ item }: { item: ConversationPreview }) => (
    <Pressable
      style={styles.conversationCard}
      onPress={() => router.push(`/chat/${item.id}`)}
    >
      <View style={styles.avatarContainer}>
        {item.other_user.avatar_url ? (
          <Image
            source={{ uri: item.other_user.avatar_url }}
            style={styles.avatar}
          />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <FontAwesome name="user" size={20} color="#999" />
          </View>
        )}
        {item.unread_count > 0 && (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadText}>{item.unread_count}</Text>
          </View>
        )}
      </View>

      <View style={styles.conversationInfo}>
        <View style={styles.conversationHeader}>
          <Text style={styles.userName} numberOfLines={1}>
            {item.other_user.full_name || 'Unknown User'}
          </Text>
          {item.last_message && (
            <Text style={styles.messageTime}>
              {formatTime(item.last_message.created_at)}
            </Text>
          )}
        </View>
        {item.last_message && (
          <Text
            style={[
              styles.lastMessage,
              item.unread_count > 0 && styles.lastMessageUnread,
            ]}
            numberOfLines={1}
          >
            {item.last_message.sender_id === user?.id ? 'You: ' : ''}
            {item.last_message.content}
          </Text>
        )}
        {item.listing && (
          <View style={styles.listingPreview}>
            <Text style={styles.listingPreviewText} numberOfLines={1}>
              Re: {item.listing.title} · ${item.listing.price}/mo
            </Text>
          </View>
        )}
      </View>

      <Pressable
        style={styles.moreButton}
        onPress={() => handleDeleteConversation(item.id, item.other_user.full_name || 'this user')}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <FontAwesome name="ellipsis-v" size={18} color="#999" />
      </Pressable>
    </Pressable>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Messages</Text>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4A90E2" />
        </View>
      ) : (
        <FlatList
          data={conversations}
          renderItem={renderConversation}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={onRefresh}
              tintColor="#4A90E2"
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <FontAwesome name="comments" size={48} color="#ccc" />
              <Text style={styles.emptyTitle}>No messages yet</Text>
              <Text style={styles.emptyText}>
                When you message someone about a listing, your conversation will appear here
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: 16,
  },
  conversationCard: {
    flexDirection: 'row',
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
  avatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  avatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  unreadBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#4A90E2',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  unreadText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  conversationInfo: {
    flex: 1,
  },
  moreButton: {
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  messageTime: {
    fontSize: 12,
    color: '#999',
    marginLeft: 8,
  },
  lastMessage: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  lastMessageUnread: {
    color: '#333',
    fontWeight: '500',
  },
  listingPreview: {
    backgroundColor: '#F5F5F5',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  listingPreviewText: {
    fontSize: 12,
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 24,
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
