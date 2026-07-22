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
| Files and push | Firebase Storage and Firebase Cloud Messaging |
| Maps | Leaflet and react-leaflet |
| Functions | Firebase Cloud Functions, Node.js 22 |
| Mobile | Capacitor Android wrapper loading `https://birklik.az` |
| Package manager | pnpm workspace |
| Tests | Vitest |

## Source layout

```text
src/
  app/
    (auth)/
      login/
        components/
        page.tsx
      register/
        components/
        page.tsx
      layout.tsx
    dashboard/
      components/
      review/
        [id]/
          components/
          page.tsx
        components/
        layout.tsx
        page.tsx
      layout.tsx
      page.tsx
    property/[id]/
      components/
      actions.ts
      queries.ts
      validators.ts
      loading.tsx
      page.tsx
    components/          # Home-route UI only
    layout.tsx
    providers.tsx
    globals.css
    loading.tsx
    error.tsx
  components/            # Shared UI and providers
  data/                  # Static domain data and filtering
  hooks/                 # Shared client hooks
  lib/                   # Shared framework primitives
  messages/
    az/
    en/
    ru/
    request.ts
    routing.ts
  services/              # Firebase/domain operations
  types/                 # Domain and translation types
  utils/                 # Framework-independent helpers
```

Route-specific UI lives in the route's `components/` directory. Shared UI lives in `src/components`. Firebase/domain operations stay in `src/services` and do not belong in UI files.

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
- The selected locale is read from the `NEXT_LOCALE` cookie without adding locale prefixes to business URLs.

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
pnpm build
pnpm typecheck
pnpm test:run
pnpm functions:build
pnpm android:sync
```

## Known technical debt

- The dashboard screen remains large and should be split into smaller route-local components.
- Most authenticated reads still use the browser Firebase SDK; moving them server-side requires a Firebase session-cookie layer.
- Booking conflict enforcement should eventually move to a trusted server transaction or slot-document design.
- Test coverage remains focused on services and filtering.
