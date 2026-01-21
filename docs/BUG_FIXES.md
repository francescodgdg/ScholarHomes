# ScholarHomes Bug Fixes Log

## January 2026

### App Launch & Stability

#### 1. Splash Screen White Flash
**Issue:** App showed a blank white screen when opening with noticeable lag before content loaded.
**Root Cause:** Splash screen was hiding before fonts and auth state were fully loaded.
**Fix:** Modified `app/_layout.tsx` to keep splash visible until both fonts AND auth are loaded. Added `fontsLoaded` prop to `RootLayoutNav` component.
**Files Changed:** `app/_layout.tsx`

#### 2. App Crashing Instantly on iOS Devices
**Issue:** App crashed immediately on physical iOS devices after TestFlight deployment. Would not even open.
**Root Cause:** Environment variables (`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`) were not being injected in production builds, causing Supabase client initialization to fail with "supabaseUrl is required" error.
**Fix:** Added hardcoded fallback values in `lib/supabase.ts` to ensure Supabase client always has valid credentials.
**Files Changed:** `lib/supabase.ts`

#### 3. Splash Screen Getting Stuck
**Issue:** App would get stuck on the logo/splash screen when launched from home screen icon (but worked when launched from TestFlight app).
**Root Cause:** Edge case where auth loading state never resolved, preventing splash from hiding.
**Fix:** Added 3-second safety timeout to force hide splash screen regardless of loading state.
**Files Changed:** `app/_layout.tsx`

---

### Navigation & Routing

#### 4. Navigation Flash After Login
**Issue:** After a user with a completed profile logged in, the university selection screen would briefly flash/appear then immediately close.
**Root Cause:** Navigation was happening before profile data was fully loaded, causing router to temporarily think profile was incomplete.
**Fix:** Modified `AuthContext.tsx` to set `isLoading` to true at the start of auth state changes, ensuring navigation doesn't occur until profile is fully fetched.
**Files Changed:** `contexts/AuthContext.tsx`, `app/_layout.tsx`

---

### Create Listing Flow

#### 5. Create Listing Form Not Resetting
**Issue:** After posting a listing and navigating back to the Post tab, the form was stuck on the last step (step 4) with all previous data still filled in. User couldn't go back and had to re-post to exit.
**Root Cause:** Form state was not being reset after successful submission. Tab components remain mounted, preserving state.
**Fix:** Added `resetForm()` function that clears all form state (step, listingType, images, title, price, etc.) and called it before navigation after successful post.
**Files Changed:** `app/(tabs)/create.tsx`

---

### Profile & Data Refresh

#### 6. My Listings Count Not Refreshing
**Issue:** The "My Listings" count badge on the profile page didn't update after posting a new listing.
**Root Cause:** Profile page data was only fetched on initial mount, with no way to manually refresh.
**Fix:** Added pull-to-refresh functionality to the profile page using `RefreshControl`.
**Files Changed:** `app/(tabs)/profile.tsx`

---

### UI/UX Improvements

#### 7. Welcome Page Icon Update
**Issue:** Welcome/login page displayed a generic graduation cap icon instead of the app's actual logo.
**Fix:** Replaced FontAwesome graduation-cap icon with Image component using `assets/images/icon.png`.
**Files Changed:** `app/(auth)/welcome.tsx`

---

### Image Handling

#### 8. Image Upload Memory Leak
**Issue:** Uploading multiple high-resolution images caused app to freeze or crash on older devices.
**Root Cause:** Images were being uploaded at full resolution without compression, consuming excessive memory.
**Fix:** Added image compression using `expo-image-manipulator` to resize images to max 1200px width and compress to 70% quality before upload.
**Files Changed:** `app/(tabs)/create.tsx`

#### 9. Missing Image Placeholder
**Issue:** Listings without images showed a broken image icon instead of a proper placeholder.
**Fix:** Added fallback placeholder URL for listings with empty or null image arrays.
**Files Changed:** `app/(tabs)/index.tsx`, `app/(tabs)/profile.tsx`

---

### Authentication

#### 10. Banned User Session Persistence
**Issue:** Banned users could still access the app if they had an active session from before being banned.
**Root Cause:** Ban status was only checked at login, not during session restoration.
**Fix:** Added ban check in `fetchProfile()` that signs out banned users and clears their session.
**Files Changed:** `contexts/AuthContext.tsx`

#### 11. Password Recovery Redirect Loop
**Issue:** Users clicking password reset link from email were stuck in a redirect loop.
**Root Cause:** Password recovery event wasn't being properly detected and handled.
**Fix:** Added `isPasswordRecovery` state to AuthContext and proper routing to reset-password screen.
**Files Changed:** `contexts/AuthContext.tsx`, `app/_layout.tsx`

---

### Messaging

#### 12. Duplicate Chat Threads
**Issue:** Users could create multiple chat threads with the same person for the same listing.
**Root Cause:** No check for existing conversations before creating new ones.
**Fix:** Added query to check for existing chat threads before creating, returns existing thread if found.
**Files Changed:** `app/listing/[id].tsx`

#### 13. Unread Message Badge Not Clearing
**Issue:** Message notification badge persisted even after reading all messages.
**Root Cause:** Read status wasn't being updated when user viewed messages.
**Fix:** Added real-time subscription to mark messages as read when chat is opened.
**Files Changed:** `app/chat/[id].tsx`

#### 14. Message Notifications Not Updating in Real-Time
**Issue:** Message notifications only appeared/disappeared when user manually refreshed the page.
**Root Cause:** No real-time subscription for message changes; data was only fetched on mount.
**Fix:** Created `MessageContext` with real-time Supabase subscriptions for messages, conversations, and conversation_participants tables. Added 10-second polling fallback.
**Files Changed:** `contexts/MessageContext.tsx` (new), `app/_layout.tsx`, `app/(tabs)/messages.tsx`

#### 15. No Unread Badge on Messages Tab
**Issue:** Users had no visual indicator of unread messages when viewing other tabs.
**Root Cause:** Tab bar didn't display unread message count.
**Fix:** Added `MessagesTabIcon` component that displays a red badge with unread count on the Messages tab icon.
**Files Changed:** `app/(tabs)/_layout.tsx`

#### 16. Conversation Thread Not Appearing for Sender
**Issue:** When a user started a new conversation, it didn't appear in their message list until the other person replied.
**Root Cause:** Real-time subscription only listened for message changes, not new conversation creation.
**Fix:** Added subscriptions for `conversations` and `conversation_participants` tables to detect new threads immediately.
**Files Changed:** `app/(tabs)/messages.tsx`, `contexts/MessageContext.tsx`

#### 17. No Option to Delete Message Threads
**Issue:** Users had no way to remove unwanted conversations from their message list.
**Root Cause:** Feature was not implemented.
**Fix:** Added ellipsis menu button on each conversation card with delete option. Implements soft delete (removes user from conversation_participants, preserving thread for other user).
**Files Changed:** `app/(tabs)/messages.tsx`

---

### Search & Filtering

#### 18. Price Filter Not Applying
**Issue:** Setting a max price filter showed all listings regardless of price.
**Root Cause:** Filter query was using wrong comparison operator.
**Fix:** Corrected Supabase query to use `.lte()` for max price filtering.
**Files Changed:** `app/(tabs)/index.tsx`

#### 19. Search Results Not Updating
**Issue:** Changing search query didn't update results until user manually refreshed.
**Root Cause:** Missing dependency in useEffect causing stale search results.
**Fix:** Added search query to useEffect dependency array with proper debouncing.
**Files Changed:** `app/(tabs)/index.tsx`

---

### Listing Management

#### 20. No Way to Delete Listings
**Issue:** Users who posted a listing had no way to delete it from the app.
**Root Cause:** Feature was not implemented in the edit listing screen.
**Fix:** Added delete button with trash icon on edit listing screen. Shows confirmation dialog before deleting. Navigates to home after successful deletion.
**Files Changed:** `app/edit-listing/[id].tsx`

#### 21. No Cancel Button on Create Listing
**Issue:** Users creating a listing had no way to cancel mid-flow without force-closing the app or completing the listing.
**Root Cause:** No cancel/exit functionality was implemented.
**Fix:** Added header with X button that appears from step 2 onwards. Shows confirmation dialog if user has unsaved changes ("Discard Listing?"). Resets form and navigates home on discard.
**Files Changed:** `app/(tabs)/create.tsx`

#### 22. No Cancel Button on Edit Listing
**Issue:** Users editing a listing couldn't cancel without saving or force-closing the app.
**Root Cause:** Only a back button existed with no unsaved changes detection.
**Fix:** Replaced back button with X cancel button. Tracks original data to detect changes. Shows confirmation dialog if unsaved changes exist ("Discard Changes?").
**Files Changed:** `app/edit-listing/[id].tsx`

---

## Summary Statistics

| Category | Count |
|----------|-------|
| App Launch & Stability | 3 |
| Navigation & Routing | 1 |
| Create Listing Flow | 1 |
| Profile & Data Refresh | 1 |
| UI/UX Improvements | 1 |
| Image Handling | 2 |
| Authentication | 2 |
| Messaging | 6 |
| Search & Filtering | 2 |
| Listing Management | 3 |
| **Total Fixes** | **22** |

---

## Build History

| Build | Date | Key Fixes |
|-------|------|-----------|
| 13 | Jan 13, 2026 | Splash screen, navigation flash, Supabase env vars |
| 14 | Jan 13, 2026 | Safety timeout for splash (stuck in processing) |
| 15 | Jan 14, 2026 | Resubmit after processing timeout |
| 16 | Jan 14, 2026 | Welcome logo, form reset, profile pull-to-refresh |
| 17 | Jan 14, 2026 | Real-time messaging, tab badge, delete threads |
| 18 | Jan 14, 2026 | Delete listings, cancel buttons for create/edit |
