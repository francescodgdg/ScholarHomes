# Scholar Homes - Milestone 1: Core App Structure & Authentication

## Overview

Scholar Homes is a React Native mobile application built with Expo that connects college students with housing opportunities near their universities. This document covers the core app structure and authentication system.

---

## Technology Stack

| Component | Technology |
|-----------|------------|
| Framework | React Native + Expo SDK 54 |
| Navigation | Expo Router (file-based routing) |
| Backend | Supabase (PostgreSQL + Auth + Storage) |
| Language | TypeScript |
| Styling | React Native StyleSheet |

---

## Project Structure

```
ScholarHomes/
├── app/                      # Expo Router - File-based routing
│   ├── (auth)/              # Auth group (unauthenticated users)
│   │   ├── welcome.tsx      # Landing page
│   │   ├── login.tsx        # Login screen
│   │   ├── signup.tsx       # Registration screen
│   │   └── complete-profile.tsx  # Profile setup after signup
│   │
│   ├── (tabs)/              # Main app tabs (authenticated users)
│   │   ├── index.tsx        # Home - Listing feed
│   │   ├── search.tsx       # Search listings
│   │   ├── post.tsx         # Create new listing
│   │   ├── messages.tsx     # Conversations list
│   │   └── profile.tsx      # User profile
│   │
│   ├── listing/[id].tsx     # Dynamic listing detail page
│   ├── chat/[id].tsx        # Dynamic chat conversation page
│   └── _layout.tsx          # Root layout with auth logic
│
├── contexts/
│   └── AuthContext.tsx      # Global authentication state
│
├── lib/
│   ├── supabase.ts          # Supabase client configuration
│   └── database.types.ts    # TypeScript types from database
│
└── assets/                  # Images, fonts, icons
```

---

## Authentication System

### How It Works

Scholar Homes uses **Supabase Auth** with email/password authentication. The key feature is **.edu email verification** to ensure only students can access the platform.

### Authentication Flow

```
┌─────────────────┐
│   App Launch    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐     No      ┌─────────────────┐
│  Check Session  │ ──────────► │  Welcome Screen │
└────────┬────────┘             └────────┬────────┘
         │ Yes                           │
         ▼                               ▼
┌─────────────────┐             ┌─────────────────┐
│   Home Screen   │             │  Login/Signup   │
└─────────────────┘             └────────┬────────┘
                                         │
                                         ▼
                                ┌─────────────────┐
                                │ .edu Validation │
                                └────────┬────────┘
                                         │
                                         ▼
                                ┌─────────────────┐
                                │ Complete Profile│
                                └────────┬────────┘
                                         │
                                         ▼
                                ┌─────────────────┐
                                │   Home Screen   │
                                └─────────────────┘
```

### AuthContext (contexts/AuthContext.tsx)

The AuthContext provides global authentication state throughout the app:

```typescript
interface AuthContextType {
  session: Session | null;      // Supabase session object
  user: User | null;            // Current user data
  profile: Profile | null;      // User profile from database
  loading: boolean;             // Auth state loading
  signIn: (email, password) => Promise<void>;
  signUp: (email, password, name) => Promise<void>;
  signOut: () => Promise<void>;
}
```

### Key Features

#### 1. .edu Email Validation
```typescript
// Only allows .edu email addresses
const isValidEduEmail = (email: string): boolean => {
  return email.toLowerCase().endsWith('.edu');
};
```

#### 2. Session Persistence
- Sessions are stored in AsyncStorage
- Auto-refreshes tokens when expired
- Persists across app restarts

#### 3. Protected Routes
The root layout (`_layout.tsx`) checks authentication status and redirects:
- **Unauthenticated users** → Welcome/Login screens
- **Authenticated users** → Main app tabs

---

## Database Schema

### Users Table (managed by Supabase Auth)
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| email | text | User's .edu email |
| created_at | timestamp | Account creation date |

### Profiles Table
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | References auth.users |
| name | text | Display name |
| avatar_url | text | Profile photo URL |
| university_id | uuid | Selected university |
| created_at | timestamp | Profile creation date |

### Universities Table
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| name | text | University name |
| domain | text | Email domain (e.g., "fordham.edu") |

### Listings Table
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| user_id | uuid | Owner reference |
| title | text | Listing title |
| description | text | Full description |
| price | integer | Monthly rent |
| bedrooms | integer | Number of bedrooms |
| bathrooms | integer | Number of bathrooms |
| address | text | Property address |
| listing_type | text | "sublet", "rental", "roommate" |
| university_id | uuid | Associated university |
| images | text[] | Array of image URLs |
| is_active | boolean | Listing visibility |
| created_at | timestamp | Post date |

### Messages Table
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| conversation_id | uuid | Groups messages |
| sender_id | uuid | Message author |
| content | text | Message text |
| created_at | timestamp | Send time |

### Conversations Table
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| participant_1 | uuid | First user |
| participant_2 | uuid | Second user |
| listing_id | uuid | Related listing |
| created_at | timestamp | Conversation start |

---

## Core App Navigation

### Tab Structure

The main app uses a bottom tab navigator with 5 tabs:

| Tab | Screen | Icon | Purpose |
|-----|--------|------|---------|
| Home | index.tsx | house | Browse listings feed |
| Search | search.tsx | magnifying glass | Search & filter listings |
| Post | post.tsx | plus | Create new listing |
| Messages | messages.tsx | chat bubble | View conversations |
| Profile | profile.tsx | person | Account settings |

### Route Protection

```typescript
// _layout.tsx - Root layout
export default function RootLayout() {
  const { session, loading } = useAuth();

  useEffect(() => {
    if (!loading) {
      if (!session) {
        // Redirect to welcome screen
        router.replace('/(auth)/welcome');
      }
    }
  }, [session, loading]);

  return <Stack />;
}
```

---

## Security Features

1. **Row Level Security (RLS)** - Database policies ensure users can only:
   - Read public listings
   - Edit/delete their own listings
   - Access their own messages

2. **Email Verification** - .edu domain validation

3. **Secure Storage** - Tokens stored in encrypted AsyncStorage

4. **API Security** - All requests authenticated via Supabase JWT

---

## Running the App

```bash
# Install dependencies
npm install

# Start development server
npx expo start

# Run on iOS simulator
npx expo start --ios

# Run on Android emulator
npx expo start --android
```

---

## Environment Variables

```
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

---

## Summary

Milestone 1 establishes:
- ✅ File-based routing with Expo Router
- ✅ Authentication with .edu email validation
- ✅ Global auth state management
- ✅ Protected routes
- ✅ Database schema for users, listings, messages
- ✅ Tab-based navigation structure
- ✅ Supabase integration for backend services
