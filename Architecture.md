# Birklik.az — Architecture

## Overview

Birklik.az is a short-term property rental marketplace for Azerbaijan. Users browse and book properties; owners list them with optional premium/VIP tiers; moderators review and approve listings. The platform runs as a React SPA on Cloudflare Pages, backed by Firebase (Firestore, Auth, Storage, Cloud Functions, FCM) and the Azericard 3D Secure payment gateway.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18.2, TypeScript 5.2, Vite 5.1 |
| Routing | React Router 6.22 |
| State | React Context API (no Redux) |
| Maps | Leaflet 1.9 + react-leaflet 4.2 |
| Database | Firebase Firestore |
| Auth | Firebase Authentication |
| Storage | Firebase Cloud Storage |
| Functions | Firebase Cloud Functions (Node.js 22, europe-west1) |
| Push | Firebase Cloud Messaging (FCM) |
| Security | Firebase App Check + reCAPTCHA Enterprise |
| Payment | Azericard 3D Secure (RSA-SHA256 signed) |
| Hosting | Cloudflare Pages |
| Mobile | Capacitor 8.3 → Android AAB |
| Testing | Vitest 1.6 |

---

## Directory Structure

```
d:\VS\Birklik.az/
├── src/
│   ├── App.tsx                      # Root component — routes + providers
│   ├── main.tsx                     # Entry point
│   ├── config/
│   │   ├── firebase.ts              # Firebase app init (App Check, auth, db, storage, messaging)
│   │   └── constants.ts             # App-wide constants, moderator check
│   ├── types/
│   │   ├── property.ts              # Property, Booking, Comment, FilterState, User
│   │   ├── notifications.ts         # Notification, NotificationType
│   │   ├── translations.ts          # Translations interface (600+ keys)
│   │   └── index.ts
│   ├── context/
│   │   ├── AuthContext.tsx          # Auth state + profile CRUD
│   │   ├── LanguageContext.tsx      # i18n (az/en/ru), persists to localStorage
│   │   └── index.ts
│   ├── hooks/
│   │   ├── usePagination.ts         # Firestore cursor-based pagination
│   │   ├── useOnlineStatus.ts       # window online/offline events
│   │   ├── usePushNotifications.ts  # FCM token registration
│   │   └── index.ts
│   ├── services/
│   │   ├── BaseFirestoreService.ts  # Generic CRUD base class
│   │   ├── propertyService.ts       # Property reads + premium listing fetching
│   │   ├── listingService.ts        # Property CRUD + photo upload
│   │   ├── bookingService.ts        # Booking creation with conflict check (transaction)
│   │   ├── commentsService.ts       # Comments + likes (subcollection)
│   │   ├── favoritesService.ts      # Favorites (arrayUnion/arrayRemove + CSRF)
│   │   ├── notificationsService.ts  # User notifications subcollection
│   │   ├── reportService.ts         # Comment reports (commentReports collection)
│   │   ├── cancellationService.ts   # Booking cancellation requests
│   │   ├── csrfService.ts           # CSRF token (sessionStorage, 1h TTL)
│   │   ├── fileValidation.ts        # File type/size validation
│   │   ├── paginationHelper.ts      # Firestore QueryConstraint builder
│   │   ├── logger.ts                # Sanitizing logger (prod strips sensitive data)
│   │   └── index.ts
│   ├── pages/
│   │   ├── HomePage/                # Listing grid + filters + optional map
│   │   ├── PropertyPage/            # Listing detail, gallery, booking, comments, similar
│   │   │   ├── PropertyPage.tsx
│   │   │   └── PropertyBooking.tsx  # Date picker + booking form
│   │   ├── DashboardPage/           # Owner cabinet (tabs: listings, bookings, favorites, notifications, profile)
│   │   │   ├── DashboardPage.tsx
│   │   │   ├── BookingsTab.tsx
│   │   │   ├── FavoritesTab.tsx
│   │   │   └── LocationPicker.tsx   # Map click → reverse geocode (Nominatim)
│   │   ├── LoginPage/
│   │   ├── RegisterPage/
│   │   ├── VerifyEmailPage/
│   │   ├── ResetPasswordPage/
│   │   ├── ModerationPage/          # Moderator: pending listings + reports
│   │   ├── ModerationReviewPage/    # Moderator: approve/reject single listing
│   │   ├── ModeratorPropertyEditPage/ # Moderator: full property edit + tier renewal
│   │   └── AboutPage/, ContactPage/, PrivacyPage/, TermsPage/, UserAgreementPage/
│   ├── components/
│   │   ├── Header/                  # Nav, language picker, notifications bell
│   │   ├── Footer/                  # Links, social (TikTok, FB, Instagram, WhatsApp)
│   │   ├── PropertyCard/            # Card: image (WebP, priority-aware), price, rating, bookmark
│   │   ├── ImageGallery/            # Lightbox slider
│   │   ├── Filters/                 # Type, city, district, price, amenities, nearby places
│   │   ├── SearchBar/               # Horizontal (≥768px) / vertical (mobile), date portal
│   │   ├── Map/                     # Leaflet PropertyMap with FitBoundsOnChange
│   │   ├── CityLocationPicker/      # City select with Nominatim forward geocode
│   │   ├── DateRangePicker/         # Calendar with disabled past/booked dates
│   │   ├── Loading/
│   │   ├── OfflineNotifier/         # Network status toast
│   │   ├── ErrorBoundary.tsx
│   │   ├── ReportCommentModal/
│   │   ├── NotificationsTab.tsx
│   │   ├── BookmarkedTab.tsx
│   │   └── index.ts
│   ├── layouts/
│   │   └── Layout.tsx               # Header + <main> + Footer wrapper
│   ├── data/
│   │   ├── properties.ts            # propertyTypes, cities[], amenitiesList, filterProperties()
│   │   ├── cityAliases.ts           # ~60 cities: resolveCity(), expandSearchTerms()
│   │   └── index.ts
│   ├── i18n/
│   │   ├── az.ts                    # Azerbaijani (default)
│   │   ├── en.ts                    # English
│   │   ├── ru.ts                    # Russian
│   │   └── index.ts
│   └── utils/
│       ├── imageCompression.ts      # Canvas → WebP: compressPropertyImage (900×675, q0.75, watermark)
│       │                            #                 compressAvatarImage (400×400, q0.85)
│       ├── premiumHelper.ts         # isPremiumExpired(), calculatePremiumExpiresAt()
│       ├── sanitization.ts          # sanitizeInput() for user-entered text
│       └── validators.ts            # validateEmail(), validatePhone(), validatePassword()
├── firebase-functions/
│   └── src/
│       ├── index.ts                 # Function exports
│       ├── payment/
│       │   └── azericard.ts         # initiatePayment, azericardCallback, performReversal
│       ├── notifications/
│       │   └── sendPush.ts          # sendPushToUser → FCM (cleans stale tokens)
│       └── cleanup/
│           ├── firestore-cleanup.ts # cleanupOrphanedDrafts (draft > 1h + no active payment)
│           ├── storage-cleanup.ts   # deleteOrphanedImages
│           └── admin.ts             # Firebase Admin SDK init
├── public/
│   ├── _headers                     # Cache headers (immutable assets 1yr, HTML no-cache)
│   ├── _redirects                   # /* /index.html 200 (SPA routing on Cloudflare)
│   ├── sw.js                        # Service Worker: asset cache + FCM background push
│   ├── manifest.json                # PWA manifest (maskable icons, shortcuts)
│   ├── robots.txt
│   ├── sitemap.xml
│   ├── hero.jpeg                    # Hero image (preloaded, fetchpriority=high)
│   ├── brand/                       # Logos in multiple sizes
│   └── ads/                         # banner.jpg (160×600, shown at ≥1280px)
├── scripts/
│   ├── copy-404.mjs                 # Removes dist/404.html (Cloudflare uses _redirects)
│   └── generate-logo-assets.mjs    # Generates PWA icons from logo-source.png
├── android/                         # Capacitor Android project
├── vite.config.ts                   # Code splitting (8+ chunks), @/* alias
├── tsconfig.json                    # strict, noUnusedLocals, noUnusedParameters
├── capacitor.config.ts              # appId: az.birklik.app, server.url: https://birklik.az
├── firebase.json
├── firestore.rules
├── storage.rules
└── firestore.indexes.json
```

---

## Firestore Data Model

```
users/{uid}
  name, email, phone, avatar, createdAt, updatedAt
  fcmTokens[]                          # FCM push tokens (web + native)
  └── notifications/{id}               # Activity feed subcollection
        type, title, message, read, createdAt, relatedId, actionUrl

properties/{propertyId}
  type, district, city
  price: { daily, weekly, monthly, currency }
  rooms, minGuests, maxGuests, area, amenities[]
  images[]                             # Firebase Storage URLs (WebP after 2026-06-16)
  coordinates: { lat, lng }
  title: { az, en }                    # Same value in both keys (no real multilingual)
  description: { az, en }
  address: { az, en }
  owner: { name, phone, email }
  ownerId
  rating, reviews, likes[], favorites[], views, comments
  status: 'active' | 'pending' | 'inactive' | 'draft'
  listingTier: 'free' | 'standard' | 'premium' | 'vip'
  isFeatured                           # legacy premium flag
  premiumExpiresAt, vipExpiresAt       # ISO strings
  createdAt, updatedAt, expiredAt
  └── comments/{commentId}             # Subcollection
        userId, userName, userAvatar, text, createdAt, updatedAt, parentCommentId

bookings/{bookingId}
  propertyId, userId, ownerId
  userName, userEmail, userPhone
  checkInDate, checkOutDate            # ISO date strings (local time, NOT UTC)
  nights, totalPrice, createdAt
  status: 'pending' | 'approved' | 'rejected' | 'cancelled' | 'cancellation_requested'
  approvedAt, rejectedAt, rejectionReason

cancellationRequests/{requestId}
  bookingId, propertyId, ownerId, guestId, guestName, guestEmail
  checkInDate, checkOutDate, reason
  status: 'pending' | 'approved' | 'rejected'
  createdAt, respondedAt

commentReports/{reportId}
  propertyId, commentId, commentText
  reportedBy, reportedByName
  reason: 'spam' | 'inappropriate' | 'offensive' | 'misleading' | 'other'
  details, createdAt
  status: 'open' | 'closed'
  commentDeleted

payments/{orderId}
  propertyId, userId, tier, duration, amount, orderId
  isUpgrade                            # true = existing active listing upgrade
  status: 'awaiting_payment' | 'completed' | 'failed' | 'cancelled' | 'reversed' | 'expired'
  rrn, intRef, approval, createdAt, completedAt

cleanup-logs/{id}
  result, timestamp                    # Output from cleanupDrafts function
```

---

## Routes

| Path | Component | Guard |
|---|---|---|
| `/` | HomePage | — |
| `/property/:id` | PropertyPage | — |
| `/login` | LoginPage | redirect → /dashboard if authed |
| `/register` | RegisterPage | redirect → /dashboard if authed |
| `/reset-password` | ResetPasswordPage | — |
| `/verify-email` | VerifyEmailPage | requires auth |
| `/dashboard` | DashboardPage | requires auth + verified email |
| `/moderation` | ModerationPage | requires moderator claim |
| `/moderation/review/:id` | ModerationReviewPage | requires moderator claim |
| `/moderator/properties/:id/edit` | ModeratorPropertyEditPage | requires moderator claim |
| `/about` | AboutPage | — |
| `/contact` | ContactPage | — |
| `/privacy` | PrivacyPage | — |
| `/terms` | TermsPage | — |
| `/user-agreement` | UserAgreementPage | — |

---

## Key Flows

### User Registration
```
RegisterPage
  → AuthContext.register(name, email, phone, password)
  → Firebase createUserWithEmailAndPassword
  → Firestore set users/{uid}
  → sendEmailVerification
  → redirect /verify-email
```

### Create Listing (Premium/VIP)
```
DashboardPage "Add Listing"
  → User fills form + selects tier
  → Images compressed to WebP 900×675 q0.75 (Canvas API) + watermark
  → Upload to Storage: properties/{userId}/{ts}_{filename}
  → Firestore draft property created
  → initiatePayment (Cloud Function)
      → generate 8-digit orderId (crypto.randomBytes, no collisions)
      → sign P_SIGN (RSA-SHA256 lowercase hex)
      → save payments/{orderId} { status: 'awaiting_payment' }
      → return redirect params for browser POST form
  → Browser POST → mpi.3dsecure.az (Azericard 3D Secure)
  → azericardCallback (Cloud Function)
      → verify P_SIGN with MPI public key
      → isUpgrade=false → set property status='pending' (awaiting moderation)
      → isUpgrade=true  → update tier fields only, status stays 'active'
      → update payments/{orderId} { status: 'completed' }
  → Redirect /dashboard?payment=success
```

### Create Listing (Free/Standard)
```
DashboardPage → listingService.createListing()
  → Firestore set properties/{id} { status: 'pending' }
  → Moderator reviews in ModerationPage
  → approve → status='active' | reject with reason
```

### Booking
```
PropertyPage: select dates → click "Send Request"
  → if !isAuthenticated → pp-toast (t.property.signInBook)
  → bookingService.createBooking(booking, csrfToken)
      → Firestore transaction:
          read all bookings for propertyId
          check date overlap (approved + pending)
          if conflict → throw BookingConflictError
          else → create booking { status: 'pending' }
  → notificationsService.createBookingNotification(ownerId, ...)
  → Owner sees in Dashboard → approve / reject
```

### Booking Cancellation
```
Guest: pending booking → direct cancel (status → 'cancelled')
Guest: approved booking → createCancellationRequest
  → Owner gets notification
  → Owner approve → booking status → 'cancelled'
  → Owner reject → cancellationRequest status → 'rejected'
```

### Push Notifications
```
Firestore write to users/{uid}/notifications/{id}
  → onNotificationCreated trigger (Cloud Function)
  → sendPushToUser(uid, payload)
      → get fcmTokens[] from users/{uid}
      → FCM multicast send
      → remove stale/invalid tokens automatically
```

### Pagination
```
HomePage load:
  Promise.all([
    getAllPremiumProperties({city})   // all VIP+Premium, no limit
    getProperties({city})            // first 20 standard, cursor-based
  ])
  → deduplicate by premiumIdsRef (Set)
  → merge: [premiums..., dedupedStandard...]
  → filterProperties() sorts by tierRank: vip(3) > premium(2) > standard(1)

Scroll to bottom → loadMore():
  → getProperties({city}, lastDoc)   // next 20
  → deduplicate again
  → append to state
```

---

## Services Reference

| Service | Firestore Collections | Key Operations |
|---|---|---|
| `propertyService` | `properties` | `getProperties` (paginated), `getAllPremiumProperties`, `getPropertyById` |
| `listingService` | `properties`, Storage | `createListing`, `updateListing`, `deleteListing`, `uploadPropertyImage`, `deletePropertyImages` |
| `bookingService` | `bookings` | `createBooking` (transaction), `getPropertyBookings`, `checkBookingConflict` |
| `commentsService` | `properties/{id}/comments` | `addComment`, `getComments`, `deleteComment`, `toggleLike` |
| `favoritesService` | `properties` (favorites[]) | `toggleFavorite` (CSRF), `isPropertyFavorited` |
| `notificationsService` | `users/{uid}/notifications` | `createBookingNotification`, `getUserNotifications`, `markNotificationAsRead` |
| `reportService` | `commentReports` | `createCommentReport`, `getAllReports`, deduplicate per user per comment |
| `cancellationService` | `cancellationRequests` | `createCancellationRequest`, `getOwnerCancellationRequests`, approve/reject |
| `csrfService` | sessionStorage | `getCsrfToken` (generate+cache 1h), `validateCsrfToken` |
| `fileValidation` | — | `validatePropertyImage` (max 10MB, JPEG/PNG/WebP), `validateAvatar` (max 5MB) |

---

## Cloud Functions

| Function | Trigger | Description |
|---|---|---|
| `initiatePayment` | onCall | Signs Azericard P_SIGN, creates `payments/{orderId}`, returns POST params |
| `azericardCallback` | onRequest (POST/GET) | Verifies Azericard callback, activates listing or deletes draft |
| `performReversal` | onCall | Returns TRTYPE=22 params for browser redirect reversal |
| `onNotificationCreated` | Firestore onCreate `users/{uid}/notifications/{id}` | Sends FCM push to all user's tokens |
| `cleanupDrafts` | Scheduled every 2h | Deletes drafts >1h old with no `awaiting_payment`, removes Storage images |

---

## Security

| Mechanism | Where |
|---|---|
| CSRF tokens (sessionStorage, 1h TTL) | booking creation, favorites toggle |
| Firestore Security Rules | row-level: owner vs moderator vs public |
| Storage Security Rules | owner-scoped paths, type+size limits |
| Firebase App Check + reCAPTCHA Enterprise | all Firestore/Storage/Auth calls |
| Firebase Auth (email+password) | all protected routes |
| Email verification required | Dashboard access |
| Custom claim `moderator: true` | ModerationPage, ModeratorPropertyEditPage |
| RSA-SHA256 P_SIGN | Azericard payment signing + callback verification |
| Input sanitization (`sanitizeInput`) | comments, user-entered text |
| File validation | type allowlist, size limits, filename safety check |
| Logger sanitization | prod strips Firebase IDs, emails, tokens, URLs from logs |

**Critical secrets (never commit):**
- `.env` — Firebase API key + VAPID key + reCAPTCHA key
- `private_key.pem`, `public_key.pem` — Azericard RSA keypair
- `mpi_prod.key` — Azericard MPI public key
- `android/app/google-services.json` — Firebase Android config
- `firebase-functions/serviceAccountKey.json` — Firebase Admin SDK
- `d:\VS\birklik-keystore.jks` — Android signing keystore (outside repo)

---

## Listing Tiers

| Tier | Price | Duration | Behavior |
|---|---|---|---|
| Free | 0 | Permanent | Active after moderator approval |
| Standard | 0 | Permanent | Active after moderator approval, location hidden from public |
| Premium | 30 AZN / 55 AZN | 14 / 30 days | Promoted in listings, shown after VIP |
| VIP | 20 AZN / 30 AZN | 14 / 30 days | Highest promotion, always first in feed |

After expiry: `status → inactive`, `expiredAt = now`. After 30 days inactive: `cleanupDrafts` deletes listing + Storage images.

**Tier rank for sorting (filterProperties + getProperties):**
- VIP active → rank 3
- Premium active → rank 2
- Everything else → rank 1
- Within same rank: `createdAt` descending

---

## Image Pipeline

```
User selects file
  → fileValidation.validatePropertyImage (max 10MB, JPEG/PNG/WebP only)
  → imageCompression.compressPropertyImage(file)
      → Canvas resize to max 900×675
      → Add watermark (logo-512x128.png, 35% width, 20% opacity, centered)
      → canvas.toBlob('image/webp', 0.75)
  → Upload to Firebase Storage: properties/{userId}/{timestamp}_{filename}.webp
  → Firestore property.images[] updated with download URL
```

**PropertyCard rendering:**
- First 4 cards (above the fold): `loading="eager"`, `fetchPriority="high"`
- Remaining cards: `loading="lazy"`, `fetchPriority="auto"`
- All cards: `width={900}` `height={563}` attributes for browser layout hint

---

## i18n

Three translation files (`az.ts`, `en.ts`, `ru.ts`) each implement the `Translations` interface (600+ keys across 25+ namespaces). Language stored in `localStorage`. Default: Azerbaijani.

Key namespaces: `site`, `nav`, `search`, `property`, `amenities`, `propertyTypes`, `districts`, `auth`, `dashboard`, `form`, `footer`, `messages`, `hero`, `pricing`, `errors`, `buttons`, `common`, `notifications`, `filters`, `booking`, `comments`, `moderation`, `calendar`, `pages`, `listing`, `offline`.

Usage: `const { t, language, setLanguage } = useLanguage()`

---

## Maps

- **Provider:** Leaflet 1.9 + react-leaflet 4.2 (OpenStreetMap / CARTO Voyager tiles)
- **PropertyMap** (`src/components/Map/Map.tsx`): `MapContainer` + `TileLayer` + `Marker` with price-badge `divIcon` + `Popup`. Includes `FitBoundsOnChange` inner component that adjusts bounds when filtered properties change.
- **LocationPicker** (`src/pages/DashboardPage/LocationPicker.tsx`): `useMapEvents` click → `CircleMarker` + Nominatim reverse geocode into address field.
- **Forward geocode** (DashboardPage, ModeratorPropertyEditPage): Nominatim `search` API with `countrycodes=az`. City aliases resolved via `resolveCity()` before geocoding.
- **FitBounds logic:**
  - 0 properties → setView(BAKU_CENTER `[40.41, 49.87]`, zoom 11)
  - 1 property → setView(coords, zoom 14)
  - 2+ properties → fitBounds(all coords, padding 60px, maxZoom 14)

---

## Mobile (Capacitor)

- `appId: az.birklik.app`
- `server.url: https://birklik.az` → loads live site inside WebView (deploy = instant update)
- AAB signed with `d:\VS\birklik-keystore.jks` (outside repo)
- Push notifications: native FCM on Android via `@capacitor/push-notifications`
- iOS: pending Apple Developer Program ($99/yr). APNs key not yet configured.

Build pipeline:
```
npm run build          # TypeScript compile + Vite build
npm run android:sync   # Copies dist/ into Capacitor android project
npm run android:open   # Opens Android Studio
# → Build > Generate Signed Bundle/APK → app-release.aab
```

---

## Vite Code Splitting

| Chunk | Contents |
|---|---|
| `react-vendor` | react, react-dom, scheduler |
| `router-vendor` | react-router-dom |
| `firebase-core` | firebase/app, firebase/analytics |
| `firebase-auth` | firebase/auth |
| `firebase-firestore` | firebase/firestore |
| `firebase-storage` | firebase/storage |
| `map-vendor` | leaflet, react-leaflet |
| `vendor` | remaining node_modules |

All page components are lazy-loaded via `React.lazy()` + `Suspense`.

---

## Known Gaps

- Search is client-side only (no Algolia/Meilisearch) — breaks at large dataset
- DashboardPage is 2000+ lines (refactor candidate)
- ~10% test coverage
- No real-time Firestore listeners (requires page refresh for updates)
- "İrəli çək" (boost listing without tier change) — button exists, alert placeholder only
- iOS push notifications not configured (waiting on Apple Developer account)
- OG meta tags for social previews require SSR (Cloudflare Pages Functions) — not implemented; dynamic meta works for Google crawl only
- Old photos uploaded before 2026-06-16 remain full-size JPEG in Firebase Storage
- Tier sort is client-side — correct while total listings < 20 per page; needs Firestore index `tierPriority` field for larger datasets
