# Scholar Homes - MVP Feature List

## Overview
Scholar Homes is a student-focused rental and sublet platform that connects college students with housing opportunities near their universities.

---

## Core Features (MVP)

### 1. Authentication & Onboarding
- [ ] Email signup/login restricted to `.edu` emails only
- [ ] Email verification flow
- [ ] University selection during onboarding
- [ ] Basic profile (name, university, profile photo optional)
- [ ] Password reset functionality

### 2. Listings
**Creating Listings:**
- [ ] Listing type: Sublet or Rental
- [ ] Photos (up to 5-8 images)
- [ ] Price (monthly rent)
- [ ] Number of bedrooms/bathrooms
- [ ] Lease length / dates available
- [ ] Location (address or area near campus)
- [ ] Short description
- [ ] Amenities checklist (optional: laundry, parking, furnished, utilities included, etc.)

**Browsing Listings:**
- [ ] Feed/grid view of available listings
- [ ] Pull-to-refresh
- [ ] Pagination/infinite scroll

### 3. Search & Filters
- [ ] Filter by university
- [ ] Filter by price range (min/max)
- [ ] Filter by number of rooms
- [ ] Filter by listing type (sublet vs rental)
- [ ] Filter by availability dates
- [ ] Sort by: newest, price low-high, price high-low

### 4. Listing Details
- [ ] Full photo gallery with swipe
- [ ] All listing information displayed
- [ ] Poster's profile preview
- [ ] "Contact" / "Message" button
- [ ] Save/favorite listing (optional for MVP)

### 5. Messaging
- [ ] In-app messaging between students
- [ ] Conversation list view
- [ ] Real-time message updates
- [ ] Push notifications for new messages (stretch)

### 6. Map View (Stretch Goal)
- [ ] Map showing listing locations
- [ ] Tap pins to see listing preview
- [ ] Filter by visible map area

---

## Admin Features

### Admin Dashboard (Web or In-App)
- [ ] View all listings (pending, active, paused, removed)
- [ ] Approve new listings before they go live (optional moderation queue)
- [ ] Edit any listing (fix prices, descriptions, photos)
- [ ] Delete/remove listings (spam, scams, expired)
- [ ] Pause/hide listings temporarily
- [ ] View all users
- [ ] Remove or ban users
- [ ] View flagged content (if reporting is added)

---

## Out of Scope (Post-MVP)
- Payment processing / monetization
- Roommate matching
- Lease signing / document management
- Advanced verification (ID, student status)
- Reviews/ratings
- Social features (following, sharing)

---

## Technical Constraints
- **Monthly hosting budget:** Under $60 (likely $0 on free tier)
- **Tech stack:** React Native (Expo) + Supabase
- **Platforms:** iOS and Android from single codebase

### Why Supabase?
- PostgreSQL database (relational, better for users → listings → messages)
- Built-in auth with email verification
- File storage for listing photos
- Real-time subscriptions for messaging
- Generous free tier (500MB DB, 1GB storage, 50k MAU)
- Open source, can self-host later if needed
