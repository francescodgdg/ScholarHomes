import { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  FlatList,
  Pressable,
  Image,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FontAwesome } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

interface Message {
  id: string;
  content: string;
  sender_id: string;
  created_at: string;
  read: boolean;
}

interface OtherUser {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
}

interface ListingInfo {
  id: string;
  title: string;
  price: number;
  images: string[];
}

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [otherUser, setOtherUser] = useState<OtherUser | null>(null);
  const [listing, setListing] = useState<ListingInfo | null>(null);
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const flatListRef = useRef<FlatList>(null);

  const handleBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/messages');
    }
  }, [router]);

  const fetchConversation = useCallback(async () => {
    if (!user || !id) return;

    // Get conversation with participants and listing
    const { data: conversation, error } = await supabase
      .from('conversations')
      .select(`
        id,
        listing_id,
        listings (id, title, price, images),
        conversation_participants (
          user_id,
          profiles (id, full_name, avatar_url)
        )
      `)
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching conversation:', error);
      return;
    }

    // Find the other user
    const otherParticipant = conversation.conversation_participants.find(
      (p: any) => p.user_id !== user.id
    );

    if (otherParticipant?.profiles) {
      setOtherUser(otherParticipant.profiles);
    }

    if (conversation.listings) {
      setListing(conversation.listings as unknown as ListingInfo);
    }

    // Get messages
    await fetchMessages();
  }, [user, id]);

  const fetchMessages = async () => {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', id)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching messages:', error);
    } else {
      setMessages(data || []);
      // Mark messages as read
      markMessagesAsRead();
    }
    setIsLoading(false);
  };

  const markMessagesAsRead = async () => {
    if (!user) return;

    await supabase
      .from('messages')
      .update({ read: true })
      .eq('conversation_id', id)
      .neq('sender_id', user.id)
      .eq('read', false);
  };

  useEffect(() => {
    fetchConversation();

    // Subscribe to new messages
    const channel = supabase
      .channel(`messages:${id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${id}`,
        },
        (payload) => {
          const newMsg = payload.new as Message;
          // Only add if message doesn't already exist (avoid duplicates from optimistic updates)
          setMessages((prev) => {
            const exists = prev.some((m) => m.id === newMsg.id);
            if (exists) return prev;
            return [...prev, newMsg];
          });
          markMessagesAsRead();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchConversation, id]);

  const sendMessage = async () => {
    if (!newMessage.trim() || !user || isSending) return;

    setIsSending(true);
    const messageContent = newMessage.trim();
    const tempId = `temp-${Date.now()}`;
    const now = new Date().toISOString();

    // Optimistically add message to UI immediately
    const optimisticMessage: Message = {
      id: tempId,
      content: messageContent,
      sender_id: user.id,
      created_at: now,
      read: false,
    };
    setMessages((prev) => [...prev, optimisticMessage]);
    setNewMessage('');

    const { data, error } = await supabase
      .from('messages')
      .insert({
        conversation_id: id,
        sender_id: user.id,
        content: messageContent,
      })
      .select()
      .single();

    if (error) {
      console.error('Error sending message:', error);
      // Remove optimistic message and restore input on error
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setNewMessage(messageContent);
    } else if (data) {
      // Replace temp message with real one from server
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? data : m))
      );
    }

    // Update conversation timestamp
    await supabase
      .from('conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', id);

    setIsSending(false);
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDateHeader = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const isOwnMessage = item.sender_id === user?.id;
    const showDateHeader =
      index === 0 ||
      formatDateHeader(item.created_at) !==
        formatDateHeader(messages[index - 1].created_at);

    return (
      <>
        {showDateHeader && (
          <View style={styles.dateHeader}>
            <Text style={styles.dateHeaderText}>
              {formatDateHeader(item.created_at)}
            </Text>
          </View>
        )}
        <View
          style={[
            styles.messageContainer,
            isOwnMessage ? styles.ownMessage : styles.otherMessage,
          ]}
        >
          <View
            style={[
              styles.messageBubble,
              isOwnMessage ? styles.ownBubble : styles.otherBubble,
            ]}
          >
            <Text
              style={[
                styles.messageText,
                isOwnMessage ? styles.ownMessageText : styles.otherMessageText,
              ]}
            >
              {item.content}
            </Text>
            <Text
              style={[
                styles.messageTime,
                isOwnMessage ? styles.ownMessageTime : styles.otherMessageTime,
              ]}
            >
              {formatTime(item.created_at)}
            </Text>
          </View>
        </View>
      </>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4A90E2" />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
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
          headerTitle: () => (
            <View style={styles.headerTitle}>
              {otherUser?.avatar_url ? (
                <Image
                  source={{ uri: otherUser.avatar_url }}
                  style={styles.headerAvatar}
                />
              ) : (
                <View style={styles.headerAvatarPlaceholder}>
                  <FontAwesome name="user" size={14} color="#999" />
                </View>
              )}
              <Text style={styles.headerName} numberOfLines={1}>
                {otherUser?.full_name || 'Chat'}
              </Text>
            </View>
          ),
        }}
      />
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={90}
      >
        {/* Listing Preview */}
        {listing && (
          <Pressable
            style={styles.listingBanner}
            onPress={() => router.push(`/listing/${listing.id}`)}
          >
            {listing.images?.[0] && (
              <Image
                source={{ uri: listing.images[0] }}
                style={styles.listingImage}
              />
            )}
            <View style={styles.listingInfo}>
              <Text style={styles.listingTitle} numberOfLines={1}>
                {listing.title}
              </Text>
              <Text style={styles.listingPrice}>${listing.price}/mo</Text>
            </View>
            <FontAwesome name="chevron-right" size={14} color="#999" />
          </Pressable>
        )}

        {/* Messages */}
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messagesList}
          onContentSizeChange={() =>
            flatListRef.current?.scrollToEnd({ animated: false })
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                No messages yet. Say hello!
              </Text>
            </View>
          }
        />

        {/* Input */}
        <View style={[styles.inputContainer, { paddingBottom: insets.bottom || 16 }]}>
          <TextInput
            style={styles.input}
            placeholder="Type a message..."
            placeholderTextColor="#999"
            value={newMessage}
            onChangeText={setNewMessage}
            multiline
            maxLength={1000}
          />
          <Pressable
            style={[
              styles.sendButton,
              (!newMessage.trim() || isSending) && styles.sendButtonDisabled,
            ]}
            onPress={sendMessage}
            disabled={!newMessage.trim() || isSending}
          >
            {isSending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <FontAwesome name="send" size={18} color="#fff" />
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
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
  headerTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  headerAvatarPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  listingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  listingImage: {
    width: 50,
    height: 50,
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
    fontSize: 14,
    fontWeight: '600',
    color: '#4A90E2',
    marginTop: 2,
  },
  messagesList: {
    padding: 16,
    flexGrow: 1,
  },
  dateHeader: {
    alignItems: 'center',
    marginVertical: 16,
  },
  dateHeaderText: {
    fontSize: 12,
    color: '#999',
    backgroundColor: '#F0F0F0',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  messageContainer: {
    marginVertical: 4,
    maxWidth: '80%',
  },
  ownMessage: {
    alignSelf: 'flex-end',
  },
  otherMessage: {
    alignSelf: 'flex-start',
  },
  messageBubble: {
    padding: 12,
    borderRadius: 16,
  },
  ownBubble: {
    backgroundColor: '#4A90E2',
    borderBottomRightRadius: 4,
  },
  otherBubble: {
    backgroundColor: '#fff',
    borderBottomLeftRadius: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  ownMessageText: {
    color: '#fff',
  },
  otherMessageText: {
    color: '#333',
  },
  messageTime: {
    fontSize: 11,
    marginTop: 4,
  },
  ownMessageTime: {
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'right',
  },
  otherMessageTime: {
    color: '#999',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    paddingTop: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    gap: 12,
  },
  input: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
    maxHeight: 100,
    color: '#333',
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#4A90E2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#B0C4DE',
  },
});
