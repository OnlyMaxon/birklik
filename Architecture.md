# Birklik.az architecture

Birklik.az is a multilingual property rental marketplace built with Next.js App Router and Firebase.

## Stack

| Layer | Technology |
|---|---|
| Web | Next.js 16, React 19, TypeScript |
| Routing and rendering | App Router, React Server Components, Server Actions |
| Validation | Zod |
| Localization | next-intl (`az`, `en`, `ru`) |
| Database and auth | Firebase Firestore and Firebase Authentication |
| Files | Firebase Storage |
| Push | Firebase Cloud Messaging over a push-only service worker (`public/sw.js`) |
| Maps | Leaflet and react-leaflet, CARTO basemap tiles |
| Functions | Firebase Cloud Functions v1, `europe-west1`, Node.js 22 |
| Payments | Azericard, RSA-SHA256 `P_SIGN` verified in a Cloud Function |
| Hosting | Cloudflare Workers via OpenNext |
| Package manager | pnpm workspace |
| Tests | Vitest |

There is no mobile app in this repository. The Capacitor Android wrapper was removed on
2026-09-03; the mobile client is being rebuilt on Expo in a separate repository against this
same Firebase project.

## Source layout

```text
src/
  app/
    [locale]/            # Locale-prefixed routes — see Internationalization
      (home)/            # Home page; the route group exists only for its loading.tsx
      kiraye/[city]/     # Region landing pages
      about/ contact/ privacy/ terms/ user-agreement/
      layout.tsx         # Mounts SiteShell with the locale from the segment
    (auth)/              # login, register
    auth/action/         # Firebase e-mail action handler
    dashboard/           # Owner cabinet; add, payment, moderator-edit, review
    property/[id]/       # Listing page: components, lib, actions, queries, validators
    api/images/[...path] # Image proxy
    verify-email/
    components/          # Home-route UI only
    layout.tsx           # Document shell only: <html><body>
    site-shell.tsx       # Providers, header, footer — mounted by sections
    cookie-locale-shell.tsx  # SiteShell for non-localized routes, locale from cookie
    site-json-ld.tsx     # Organization + WebSite markup
    robots.ts sitemap.ts llms.txt/
    providers.tsx loading.tsx error.tsx not-found.tsx
    actions.ts queries.ts
  components/            # Shared UI and providers
  data/                  # Static domain data and filtering
  hooks/                 # Shared client hooks
  lib/
    auth/                # Session cookie, permissions, server auth actions
    firebase/            # client.ts (browser SDK), firestore-rest.ts + google-auth.ts (server)
    i18n/                # getAppTranslations
    navigation.tsx city-landing.ts locale-routes.ts property-list.ts seo.ts images.ts
  messages/              # az/ en/ ru/ + request.ts, routing.ts
  services/              # Firebase/domain operations
  types/                 # Domain and translation types
  utils/                 # Framework-independent helpers
```

Route-specific UI lives in the route's `components/` directory. Shared UI lives in `src/components`. Firebase/domain operations stay in `src/services` and do not belong in UI files.

## Two ways into Firestore

Server code cannot use `firebase-admin`: it does not run on workerd. Instead
`src/lib/firebase/firestore-rest.ts` speaks the Firestore REST API, signing a service-account
JWT with WebCrypto in `google-auth.ts`. It bypasses security rules, so it is server-only and its
key must never reach the browser.

Authenticated reads and all writes go through the browser SDK (`src/lib/firebase/client.ts`) and
are therefore governed by `firestore.rules`. Public, cacheable reads — home, region pages,
listing pages, sitemap — go through the REST client.

## Rendering boundaries

- Route files, layouts, metadata, cached queries, and validation are server-first.
- Firebase Authentication and the existing browser Firebase SDK require explicit client boundaries.
- `src/app/providers.tsx` owns the client provider tree.
- Protected dashboard and moderator areas use route-group layouts rather than page-level wrappers.
- `src/lib/navigation.tsx` is a temporary compatibility facade over Next navigation APIs for migrated interactive components.

## Caching

Public property metadata is read through the cached query in `src/app/property/[id]/queries.ts`.

- Revalidation window: five minutes.
- Global tag: `properties`.
- Per-record tag: `property:<propertyId>`.
- Mutations invalidate the narrow per-record tag through a thin server action.

Authenticated Firestore data remains client-driven and is not put in the shared Next.js data cache.

## Internationalization

All application messages live in JSON files under `src/messages/<locale>/`.

- `common.json`: truly shared words and states.
- `dashboard.json`: dashboard copy.
- `app.json`: current broad application catalog.
- Namespaces are PascalCase; nested message paths use camelCase.

The locale reaches a page in one of two ways, and which one applies depends on the route:

- **Under `[locale]`** — home, region pages and the five information pages. The locale comes from
  the URL segment: `/` is Azerbaijani, `/ru` and `/en` carry a prefix. Pass it explicitly from
  `params` into `getAppTranslations(locale)`. Do not rely on the layout: a `loading.tsx` next to a
  page creates a Suspense boundary, the page renders as a separate pass, and `setRequestLocale`
  from the layout does not reach it — which silently served Azerbaijani on `/ru/about` for months.
- **Everywhere else** — listing pages, dashboard, auth. These are not translated per URL and read
  the `NEXT_LOCALE` cookie through `cookie-locale-shell.tsx`.

Listing pages are deliberately not localized: owners enter one title, it is copied into every
language, so three URLs would be duplicate content.

There is no middleware. OpenNext supports only the edge runtime proxy, so locale prefixes are
produced by rewrites in `next.config.ts`, listed by name in `src/lib/locale-routes.ts`. **A new
page under `[locale]` must be added to that list.**

## Environment variables

Browser Firebase configuration uses only `NEXT_PUBLIC_*` names:

```text
NEXT_PUBLIC_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_PROJECT_ID
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
NEXT_PUBLIC_FIREBASE_APP_ID
NEXT_PUBLIC_FIREBASE_VAPID_KEY
NEXT_PUBLIC_RECAPTCHA_SITE_KEY
NEXT_PUBLIC_RECAPTCHA_ENTERPRISE_SITE_KEY  # optional Enterprise alternative
NEXT_PUBLIC_FIREBASE_APPCHECK_DEBUG_TOKEN  # optional, must be registered
```

Function-only credentials remain server-side and must never use the `NEXT_PUBLIC_` prefix.

## Commands

```bash
pnpm install
pnpm dev
pnpm build                  # plain Next build — does NOT produce a worker
pnpm typecheck
pnpm test:run

pnpm cf:build               # OpenNext build for Workers
pnpm cf:deploy              # build and deploy the worker
pnpm functions:build
pnpm functions:deploy       # required after any change under firebase-functions/
pnpm firestore:deploy-rules
```

Three deploy targets are independent: the worker, the functions and the rules. Changing a file
under `firebase-functions/` and deploying only the worker leaves production running the old
function — that is exactly how a stale `cleanupStorage` deleted 124 live photos.

## Web push

`public/sw.js` exists for one reason: a browser will not hand out a push subscription without a
registered service worker, so `getToken` in `src/hooks/use-push-notifications.ts` needs one.
It handles `push` and `notificationclick` and nothing else.

There is no PWA. The manifest, offline caching, the `fetch` handler and the install prompt were
removed on 2026-09-03, along with the Capacitor Android wrapper — the mobile app is being rebuilt
on Expo in its own repository. The `activate` handler still deletes leftover `birklik-html-*`
caches from the old worker and can go once returning visitors have all updated.

## Listing tiers and visibility

A single helper decides whether a paid tier is in force: `src/utils/premium-helper.ts`
(`isTierActive`, `isTierExpired`, `tierRank`). It requires both a matching `listingTier` and a
future expiry date. Badges, ordering and dashboard labels all read from it — never from the
tier or the date alone.

Visibility is decided in two places on purpose:

- `isOnDisplay` in `src/lib/property-list.ts` filters lists at read time, so an expired listing
  leaves the site the moment its date passes;
- the scheduled `expirePaidTiers` function then records that in Firestore (`status: 'inactive'`,
  `expiredAt`), which is what the dashboard and the owner's renew button read.

Expired listings are never deleted. They keep their data and photos and return to the site on
renewal.

## Scheduled functions

All in `europe-west1`, defined in `firebase-functions/src/index.ts`. They are deployed
separately from the worker — `pnpm functions:deploy`. A fix that only sits in the repository
is not in production; a stale deployment of `cleanupStorage` once deleted 124 live photos for
that reason (see `AUDIT.md`).

| Function | Schedule | What it does |
|---|---|---|
| `cleanupDrafts` | every 2 hours | Expires stale payments, then removes abandoned drafts. Skips a draft while its payment is still `awaiting_payment`. |
| `expirePaidTiers` | daily 03:00 UTC | Marks listings whose paid tier ran out as `inactive` and records `expiredAt`. Deletes nothing. |
| `cleanupStaleRequests` | Sundays 05:00 UTC | Removes cancellation requests whose booking no longer exists. |
| `cleanupStorage` | Sundays 04:00 UTC | Removes unreferenced images, `temp/` files and old avatars. Aborts if orphan candidates exceed 5% of the bucket — that shape of result means a URL format stopped being recognised, not that users deleted a hundred photos. |

Deletion of expired listings is deliberately not implemented: an expired listing keeps its
data and photos indefinitely and only leaves the site.

## Geography

Two controlled axes plus one legacy label:

| Field | Role |
|---|---|
| `city` | Region, from the 73-entry directory. Drives region landing pages, the city filter, breadcrumbs and the sitemap. |
| `locationTags` | Places inside a region: villages from `cityDistricts`, Baku districts and metro stations from `cityLocationOptions`. Selected in `CityLocationPicker`; the search filter uses these. |
| `district` | A display label only — a copy of `locationTags[0]`, typed as a plain string. Kept for older records; render it through `districtLabel`. |

`cityDistricts` currently covers 15 of the 73 regions.

## Known technical debt

- The dashboard screen remains large and should be split into smaller route-local components.
- Most authenticated reads still use the browser Firebase SDK; moving them server-side requires a Firebase session-cookie layer.
- Non-existent URLs answer 200 instead of 404: the root `loading.tsx` opens the response stream
  before a route can call `notFound()`. It is there because the Workers Free CPU limit needs
  streaming. Removing it is the first task after moving to Workers Paid — see `AUDIT.md`.
- Booking conflicts are checked when a booking is created, approved and edited, but Firestore
  does not lock date ranges, so two simultaneous requests can still both be accepted. Bookings
  carry no payment, so the owner resolves this by hand; a slot-document design was considered
  and judged disproportionate.
- `cityDistricts` has no entries for most regions, so the second location level is unavailable
  outside the 15 listed there.
- Firestore rules have never been verified by behaviour, only compiled. The service account lacks
  `firebaserules.rulesets.test` and the emulator needs Java 11 while the dev machine has 8. This
  becomes blocking if the mobile client ships, because without a server it has no path into
  Firestore except the rules.
- Test coverage remains focused on tier logic, file validation, filtering and the Firestore REST client.
