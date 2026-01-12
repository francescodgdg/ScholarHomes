-- Scholar Homes Database Schema
-- Run this in your Supabase SQL Editor to set up the database

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- TABLES
-- =============================================

-- Universities table
CREATE TABLE IF NOT EXISTS universities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  domain TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Profiles table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  university_id UUID REFERENCES universities(id),
  role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  is_banned BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Listings table
CREATE TABLE IF NOT EXISTS listings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  university_id UUID NOT NULL REFERENCES universities(id),
  title TEXT NOT NULL,
  description TEXT,
  listing_type TEXT NOT NULL CHECK (listing_type IN ('sublet', 'rental')),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'removed', 'rented')),
  price INTEGER NOT NULL,
  bedrooms INTEGER NOT NULL DEFAULT 1,
  bathrooms INTEGER NOT NULL DEFAULT 1,
  address TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  available_from DATE,
  available_to DATE,
  amenities TEXT[] DEFAULT '{}',
  images TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Conversations table
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  listing_id UUID REFERENCES listings(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Conversation participants table
CREATE TABLE IF NOT EXISTS conversation_participants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(conversation_id, user_id)
);

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Saved listings table
CREATE TABLE IF NOT EXISTS saved_listings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, listing_id)
);

-- =============================================
-- INDEXES
-- =============================================

CREATE INDEX IF NOT EXISTS idx_listings_user_id ON listings(user_id);
CREATE INDEX IF NOT EXISTS idx_listings_university_id ON listings(university_id);
CREATE INDEX IF NOT EXISTS idx_listings_status ON listings(status);
CREATE INDEX IF NOT EXISTS idx_listings_listing_type ON listings(listing_type);
CREATE INDEX IF NOT EXISTS idx_listings_created_at ON listings(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversation_participants_user_id ON conversation_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_listings_user_id ON saved_listings(user_id);

-- =============================================
-- FUNCTIONS
-- =============================================

-- Function to automatically create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_listings_updated_at ON listings;
CREATE TRIGGER update_listings_updated_at
  BEFORE UPDATE ON listings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_conversations_updated_at ON conversations;
CREATE TRIGGER update_conversations_updated_at
  BEFORE UPDATE ON conversations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================

-- Enable RLS on all tables
ALTER TABLE universities ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_listings ENABLE ROW LEVEL SECURITY;

-- Universities: Anyone can read
CREATE POLICY "Universities are viewable by everyone"
  ON universities FOR SELECT
  USING (true);

-- Profiles: Users can read all profiles, update only their own
CREATE POLICY "Profiles are viewable by everyone"
  ON profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- Listings: Anyone can read active listings, users can manage their own
CREATE POLICY "Active listings are viewable by everyone"
  ON listings FOR SELECT
  USING (status = 'active' OR user_id = auth.uid());

CREATE POLICY "Users can insert own listings"
  ON listings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own listings"
  ON listings FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own listings"
  ON listings FOR DELETE
  USING (auth.uid() = user_id);

-- Conversations: Participants can read
CREATE POLICY "Users can view their conversations"
  ON conversations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM conversation_participants
      WHERE conversation_id = conversations.id
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create conversations"
  ON conversations FOR INSERT
  WITH CHECK (true);

-- Conversation participants
CREATE POLICY "Users can view conversation participants"
  ON conversation_participants FOR SELECT
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM conversation_participants cp
      WHERE cp.conversation_id = conversation_participants.conversation_id
      AND cp.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can add themselves to conversations"
  ON conversation_participants FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Messages: Conversation participants can read/send
CREATE POLICY "Users can view messages in their conversations"
  ON messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM conversation_participants
      WHERE conversation_id = messages.conversation_id
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can send messages in their conversations"
  ON messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM conversation_participants
      WHERE conversation_id = messages.conversation_id
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can mark messages as read"
  ON messages FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM conversation_participants
      WHERE conversation_id = messages.conversation_id
      AND user_id = auth.uid()
    )
  );

-- Saved listings: Users can manage their own
CREATE POLICY "Users can view own saved listings"
  ON saved_listings FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can save listings"
  ON saved_listings FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can unsave listings"
  ON saved_listings FOR DELETE
  USING (user_id = auth.uid());

-- =============================================
-- ADMIN POLICIES
-- =============================================

-- Admin can do everything
CREATE POLICY "Admins have full access to listings"
  ON listings FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins have full access to profiles"
  ON profiles FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- =============================================
-- SEED DATA: Universities
-- =============================================

INSERT INTO universities (name, domain) VALUES
  ('New York University', 'nyu.edu'),
  ('Fordham University', 'fordham.edu'),
  ('Columbia University', 'columbia.edu'),
  ('Boston University', 'bu.edu'),
  ('University of California Los Angeles', 'ucla.edu'),
  ('University of Southern California', 'usc.edu'),
  ('Stanford University', 'stanford.edu'),
  ('Harvard University', 'harvard.edu'),
  ('Massachusetts Institute of Technology', 'mit.edu'),
  ('University of Michigan', 'umich.edu'),
  ('University of Texas at Austin', 'utexas.edu'),
  ('University of Florida', 'ufl.edu'),
  ('Penn State University', 'psu.edu'),
  ('Ohio State University', 'osu.edu'),
  ('University of Georgia', 'uga.edu'),
  ('University of North Carolina', 'unc.edu'),
  ('Duke University', 'duke.edu'),
  ('Northwestern University', 'northwestern.edu'),
  ('University of Chicago', 'uchicago.edu'),
  ('Georgetown University', 'georgetown.edu')
ON CONFLICT (domain) DO NOTHING;

-- =============================================
-- STORAGE BUCKETS
-- =============================================

-- Note: Run these in a separate migration or manually in Supabase dashboard
-- INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true);
-- INSERT INTO storage.buckets (id, name, public) VALUES ('listings', 'listings', true);

-- Storage policies for avatars bucket
-- CREATE POLICY "Avatar images are publicly accessible"
--   ON storage.objects FOR SELECT
--   USING (bucket_id = 'avatars');

-- CREATE POLICY "Users can upload their own avatar"
--   ON storage.objects FOR INSERT
--   WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Storage policies for listings bucket
-- CREATE POLICY "Listing images are publicly accessible"
--   ON storage.objects FOR SELECT
--   USING (bucket_id = 'listings');

-- CREATE POLICY "Users can upload listing images"
--   ON storage.objects FOR INSERT
--   WITH CHECK (bucket_id = 'listings' AND auth.uid() IS NOT NULL);
