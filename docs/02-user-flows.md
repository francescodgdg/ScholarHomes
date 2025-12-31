# Scholar Homes - User Flows

## Student User Flows

### Flow 1: New User Onboarding
```
[App Launch]
    │
    ▼
[Welcome Screen]
    │
    ├─── "Sign Up" ──────────────────────────┐
    │                                         │
    │                                         ▼
    │                              [Sign Up Screen]
    │                              • Enter .edu email
    │                              • Create password
    │                              • Confirm password
    │                                         │
    │                                         ▼
    │                              [Email Verification]
    │                              • Check inbox
    │                              • Click verify link
    │                                         │
    │                                         ▼
    │                              [Select University]
    │                              • Search/select school
    │                                         │
    │                                         ▼
    │                              [Create Profile]
    │                              • Enter name
    │                              • Add photo (optional)
    │                                         │
    └─── "Log In" ───────┐                   │
                         │                   │
                         ▼                   │
              [Login Screen]                 │
              • Enter email                  │
              • Enter password               │
                         │                   │
                         ▼                   ▼
                    [Home Feed - Browse Listings]
```

---

### Flow 2: Browsing & Discovering Listings
```
[Home Feed]
    │
    ├─── [Filter Button] ────────────────────┐
    │                                         │
    │                                         ▼
    │                              [Filter Modal]
    │                              • University
    │                              • Price range
    │                              • # of rooms
    │                              • Type (sublet/rental)
    │                              • Dates
    │                              │
    │                              └─── [Apply Filters]
    │                                         │
    │◄────────────────────────────────────────┘
    │
    ├─── [Search Icon] ──► [Search Screen]
    │                      • Search by location/keyword
    │
    ├─── [Map Tab] ──► [Map View]
    │                  • See pins on map
    │                  • Tap pin ──► Listing preview
    │
    └─── [Tap Listing Card]
              │
              ▼
        [Listing Detail]
        • Photo gallery
        • Full details
        • Poster info
        │
        └─── [Message Button] ──► [Chat Screen]
```

---

### Flow 3: Creating a Listing
```
[Home / Profile]
    │
    └─── [+ Create Listing Button]
              │
              ▼
        [Select Listing Type]
        • Sublet
        • Rental
              │
              ▼
        [Add Photos]
        • Take photo / Choose from library
        • Up to 8 photos
        • Drag to reorder
              │
              ▼
        [Listing Details Form]
        • Title
        • Price ($/month)
        • Bedrooms / Bathrooms
        • Location / Address
        • Available dates
        • Description
        • Amenities (checkboxes)
              │
              ▼
        [Preview Listing]
        • Review before posting
              │
              ├─── [Edit] ──► Back to form
              │
              └─── [Post Listing]
                        │
                        ▼
                  [Success!]
                  • "Your listing is live"
                  • View listing / Go home
```

---

### Flow 4: Messaging
```
[Listing Detail]
    │
    └─── [Message Poster]
              │
              ▼
        [Chat Screen]
        • Send first message
        • Real-time conversation
              │
              ▼
        [Ongoing Conversation]
        • Back and forth messaging
        • View listing from chat

─────────────────────────────────

[Messages Tab]
    │
    ▼
[Conversations List]
• All active chats
• Last message preview
• Unread indicator
    │
    └─── [Tap Conversation]
              │
              ▼
        [Chat Screen]
```

---

### Flow 5: Managing Your Listings
```
[Profile Tab]
    │
    └─── [My Listings]
              │
              ▼
        [Your Listings List]
        • Active listings
        • Status indicators
              │
              ├─── [Tap Listing] ──► [Edit Listing]
              │                      • Update any field
              │                      • Save changes
              │
              ├─── [Mark as Rented]
              │
              └─── [Delete Listing]
```

---

## Admin User Flows

### Flow A: Admin Login
```
[Admin Web Dashboard] or [Admin App Section]
    │
    ▼
[Admin Login]
• Admin credentials
    │
    ▼
[Admin Dashboard Home]
• Overview stats
• Pending reviews
• Recent activity
```

---

### Flow B: Managing Listings
```
[Admin Dashboard]
    │
    └─── [Listings Tab]
              │
              ▼
        [All Listings View]
        • Filter: All / Active / Pending / Paused / Removed
        • Search by user or title
              │
              ├─── [View Listing]
              │         │
              │         ▼
              │    [Listing Detail (Admin)]
              │    • All listing info
              │    • Poster info
              │    • Admin actions:
              │         ├─── [Edit] ──► Edit any field
              │         ├─── [Pause/Unpause]
              │         ├─── [Delete]
              │         └─── [Flag/Unflag]
              │
              └─── [+ Add Listing Manually]
                        │
                        ▼
                  [Create Listing Form]
                  • Same as user form
                  • Select user to post as
```

---

### Flow C: Managing Users
```
[Admin Dashboard]
    │
    └─── [Users Tab]
              │
              ▼
        [All Users View]
        • Search by name/email
        • Filter: Active / Banned
              │
              └─── [View User]
                        │
                        ▼
                  [User Detail (Admin)]
                  • Profile info
                  • Their listings
                  • Their messages (optional)
                  • Admin actions:
                        ├─── [Ban User]
                        ├─── [Unban User]
                        └─── [Delete All Listings]
```

---

## Navigation Structure

### Student App (Bottom Tabs)
```
┌─────────────────────────────────────────────────┐
│                                                 │
│              [Current Screen]                   │
│                                                 │
├─────────┬─────────┬─────────┬─────────┬────────┤
│  Home   │  Search │    +    │Messages │ Profile│
│   🏠    │   🔍    │   ➕    │   💬    │   👤   │
└─────────┴─────────┴─────────┴─────────┴────────┘
```

**Tab Functions:**
1. **Home** - Browse listings feed, filters
2. **Search** - Search + Map view
3. **+ (Create)** - Post new listing
4. **Messages** - All conversations
5. **Profile** - Your profile, your listings, settings
