export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type ListingType = 'sublet' | 'rental';
export type ListingStatus = 'active' | 'paused' | 'removed' | 'rented';
export type UserRole = 'user' | 'admin';

export interface Database {
  public: {
    Tables: {
      universities: {
        Row: {
          id: string;
          name: string;
          domain: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          domain: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          domain?: string;
          created_at?: string;
        };
      };
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          avatar_url: string | null;
          university_id: string | null;
          role: UserRole;
          is_banned: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          avatar_url?: string | null;
          university_id?: string | null;
          role?: UserRole;
          is_banned?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string | null;
          avatar_url?: string | null;
          university_id?: string | null;
          role?: UserRole;
          is_banned?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      listings: {
        Row: {
          id: string;
          user_id: string;
          university_id: string;
          title: string;
          description: string | null;
          listing_type: ListingType;
          status: ListingStatus;
          price: number;
          bedrooms: number;
          bathrooms: number;
          address: string | null;
          latitude: number | null;
          longitude: number | null;
          available_from: string | null;
          available_to: string | null;
          amenities: string[];
          images: string[];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          university_id: string;
          title: string;
          description?: string | null;
          listing_type: ListingType;
          status?: ListingStatus;
          price: number;
          bedrooms: number;
          bathrooms: number;
          address?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          available_from?: string | null;
          available_to?: string | null;
          amenities?: string[];
          images?: string[];
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          university_id?: string;
          title?: string;
          description?: string | null;
          listing_type?: ListingType;
          status?: ListingStatus;
          price?: number;
          bedrooms?: number;
          bathrooms?: number;
          address?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          available_from?: string | null;
          available_to?: string | null;
          amenities?: string[];
          images?: string[];
          created_at?: string;
          updated_at?: string;
        };
      };
      conversations: {
        Row: {
          id: string;
          listing_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          listing_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          listing_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      conversation_participants: {
        Row: {
          id: string;
          conversation_id: string;
          user_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          user_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          conversation_id?: string;
          user_id?: string;
          created_at?: string;
        };
      };
      messages: {
        Row: {
          id: string;
          conversation_id: string;
          sender_id: string;
          content: string;
          read: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          sender_id: string;
          content: string;
          read?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          conversation_id?: string;
          sender_id?: string;
          content?: string;
          read?: boolean;
          created_at?: string;
        };
      };
      saved_listings: {
        Row: {
          id: string;
          user_id: string;
          listing_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          listing_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          listing_id?: string;
          created_at?: string;
        };
      };
    };
  };
}

// Helper types for use in components
export type University = Database['public']['Tables']['universities']['Row'];
export type Profile = Database['public']['Tables']['profiles']['Row'];
export type Listing = Database['public']['Tables']['listings']['Row'];
export type Conversation = Database['public']['Tables']['conversations']['Row'];
export type Message = Database['public']['Tables']['messages']['Row'];
export type SavedListing = Database['public']['Tables']['saved_listings']['Row'];

// Extended types with relations
export type ListingWithUser = Listing & {
  profiles: Pick<Profile, 'id' | 'full_name' | 'avatar_url'>;
  universities: Pick<University, 'id' | 'name'>;
};

export type ConversationWithDetails = Conversation & {
  messages: Message[];
  conversation_participants: {
    profiles: Pick<Profile, 'id' | 'full_name' | 'avatar_url'>;
  }[];
  listings: Pick<Listing, 'id' | 'title' | 'images' | 'price'> | null;
};
