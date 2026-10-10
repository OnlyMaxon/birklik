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
| Hosting | Cloudflare Workers via OpenNext, **Workers Paid** since 2026-09-22 |
| Package manager | pnpm workspace |
| Tests | Vitest |

There is no mobile app in this repository. The Capacitor Android wrapper was removed on
2026-09-03. The mobile client was rebuilt on Expo in a separate repository (`Birklik-mobile`)
against this same Firebase project, and has been running on real data since 2026-09-08. It is
not a passive consumer: two route handlers here exist solely to serve it — see
*Requests from the mobile app*.

## Shared domain logic: `core/`

`core/` is a **git submodule** — the repository `birklik-core`, published as `@birklik/core`.
The Expo app mounts the same submodule. Domain rules therefore exist in exactly one copy: how a
paid tier expires, what stays on display, how bookings are filtered.

```
core/src/types      listing, booking, user, notification
core/src/data       74-region directory, city aliases, filtering (with tests)
core/src/utils      premium-helper, display, images, basemap, auth-errors (all with
                    tests), validators
core/src/messages   az / en / ru translations (with a completeness test)
```

It ships as TypeScript source, so `transpilePackages: ['@birklik/core']` in `next.config.ts`
compiles it. pnpm links it through the workspace (`core` is listed in `pnpm-workspace.yaml`).

**After `git clone`, `core/` is empty** — run `git submodule update --init`, or the build fails
on an unresolved `@birklik/core`.

Changing shared logic takes three commits: one in `birklik-core`, then a submodule pointer
bump here, then the same in the mobile repo. Skip the last and the app builds against the old
version without saying so.

`core` has **no `lib: DOM`** in its tsconfig, deliberately: browser-only code will not compile
there. That is why `image-compression.ts` stayed here (canvas) and why the dead `validateFile`
was dropped rather than moved.

A shared package accumulates exports nobody imports, and **`tsc` does not report them**: a
sweep on 2026-09-10 found ten and removed them (seven notification sub-interfaces, the
`districts` list, `validateEmail`, `validatePassword`). Checking for more means grepping each
exported name across `src/`, `firebase-functions/src/` and the mobile repo, then checking
whether it is used inside its own file — a type that only feeds another export in the same
module is not dead.

`services/` has not moved. The two apps use different Firebase packages —
`firebase/firestore` against `@react-native-firebase/firestore` — so that code needs an
abstraction layer, not a copy.

Note that `pnpm test:run` also picks up the tests inside `core/`, since the submodule sits
inside this repository. That is intentional: the web suite validates the shared code too.

## Source layout

```text
core/                    # git submodule: @birklik/core, shared with the Expo app
src/
  app/
    [locale]/            # Locale-prefixed routes — see Internationalization
      (home)/            # Home page; the route group exists only for its loading.tsx
      kiraye/[city]/     # Region landing pages; layout.tsx answers 404 for unknown regions
      about/ contact/ privacy/ terms/ user-agreement/
      layout.tsx         # Mounts SiteShell with the locale from the segment
    (auth)/              # login, register
    auth/action/         # Firebase e-mail action handler
    dashboard/           # Owner cabinet; add, payment, moderator-edit, review
    property/[id]/       # Listing page: components, lib, actions, queries, validators
    api/images/[...path] # Image proxy
    api/property/        # comments, ratings — written by the mobile app over an ID token
    verify-email/
    components/          # Home-route UI only
    layout.tsx           # Document shell only: <html><body>
    site-shell.tsx       # Providers, header, footer — mounted by sections
    cookie-locale-shell.tsx  # SiteShell for non-localized routes, locale from cookie
    site-json-ld.tsx     # Organization + WebSite markup
    robots.ts sitemap.ts llms.txt/
    providers.tsx error.tsx not-found.tsx
    actions.ts queries.ts
  components/            # Shared UI and providers
  data/                  # Static domain data and filtering
  hooks/                 # Shared client hooks
  lib/
    auth/                # Session cookie, permissions, server auth actions
    firebase/            # client.ts (browser SDK), firestore-rest.ts + google-auth.ts (server)
    i18n/                # getAppTranslations
    navigation.tsx city-landing.ts locale-routes.ts property-list.ts seo.ts images.ts
  messages/              # request.ts, routing.ts — next-intl wiring only;
                         # the translations themselves live in core/
  services/              # Firebase/domain operations
  utils/                 # image-compression only — the rest moved to core/
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

## Requests from the mobile app

The Expo app talks to Firestore directly with the client SDK, under `firestore.rules` — it has
no server of its own. Two operations cannot work that way, so they come here instead:

| Route | Why it is not a client write |
|---|---|
| `POST /api/property/comments` | Rules deny the client any write to `comments`: that field once allowed overwriting somebody else's reviews. The website writes it server-side under the service account. |
| `POST /api/property/ratings` | A rating recalculates `rating` and `reviews` on the listing. Rules deny the client those fields, or anyone could score a listing they never stayed at. |

Both reuse the same domain functions the website calls (`src/app/property/[id]/lib/interactions.ts`),
so there is one implementation, not two that drift.

**Authentication here is not the session cookie.** The app sends a Firebase ID token as
`Authorization: Bearer <token>`; `src/lib/auth/id-token.ts` verifies it. The two paths look
alike and are not interchangeable — a session cookie is signed with Identity Toolkit keys, an
ID token with `securetoken` keys. Swap the certificate URL and sign-in from the app stops
working entirely.

Revocation is deliberately not checked on ID tokens: they live an hour and the SDK refreshes
them. Session cookies last fourteen days, so there the revocation check is mandatory and
present.

### Digital Asset Links: `/.well-known/assetlinks.json`

A static file in `public/.well-known/`, generated by Play Console and copied verbatim. It
declares that `az.birklik.app` may handle `birklik.az` URLs and share login credentials.

Two things make the path survive deployment, and both were checked rather than assumed:

- OpenNext copies the dot-directory into `.open-next/assets` (verified in the build output).
- Wrangler's default asset ignore list is only `.assetsignore`, `_redirects` and `_headers`
  — it does not skip dotfiles, so the folder is uploaded.

`public/_headers` pins `Content-Type: application/json`. The extension would imply it anyway;
it is explicit because Google rejects the file outright on any other type.

⚠️ **Publishing this file alone changes nothing.** The Android app has no `https` intent
filter with `autoVerify` — it only handles the custom `birklik://` scheme — so no birklik.az
link opens the app yet. That half needs a new build, and the app's routes must match the
site's URLs first: expo-router resolves `/property/<id>`, but locale-prefixed paths like
`/ru/property/<id>` hit no route at all.

⚠️ The upload key (`FA:7F:0C:…`) is **not** among the three fingerprints Play Console
generated. Links verify for builds installed from Play, not for an APK signed locally.

## Rendering boundaries

- Route files, layouts, metadata, cached queries, and validation are server-first.
- Firebase Authentication and the existing browser Firebase SDK require explicit client boundaries.
- `src/app/providers.tsx` owns the client provider tree.
- Protected dashboard and moderator areas use route-group layouts rather than page-level wrappers.
- `src/lib/navigation.tsx` is a temporary compatibility facade over Next navigation APIs for migrated interactive components.

### `loading.tsx` placement decides the status code

A `loading.tsx` creates a Suspense boundary, and the boundary sends headers before the page
below it has finished. Once the headers are out, `notFound()` can no longer change the status:
the visitor sees a correct "not found" page while a crawler gets a plain 200.

Two rules follow, and both are load-bearing:

- **Put a `loading.tsx` in the same segment as its page, never in a shared parent.** A root
  `src/app/loading.tsx` used to exist and silently cancelled honest status codes for every
  route underneath it. It was removed on 2026-09-22.
- **Where a route must answer 404, do the existence check in `layout.tsx`.** A layout renders
  *before* the boundary its own `loading.tsx` opens, so `notFound()` from there still sets the
  status, and the skeleton is kept. `property/[id]/layout.tsx` and
  `[locale]/kiraye/[city]/layout.tsx` both work this way. Keep those checks cheap — the first
  reads a cached query the page reuses, the second only looks up the in-memory city directory.

`generateMetadata` still needs its own `noindex` for missing records: metadata is computed in
parallel with the page and can be emitted ahead of the 404 decision.

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
pnpm test:run               # 102 unit tests; must pass without an emulator
                            # (45 here + 57 inside core/, which the suite picks up)
pnpm test:rules             # 90 security-rules tests against the Firestore emulator
                            # (needs JAVA_HOME)

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

### Which upgrade a listing is offered

Decided by the tier **in force**, never by the `listingTier` field alone — an expired paid
listing keeps that field and would otherwise look VIP when it no longer is.

```
standard or expired   both steps: VIP and Premium
VIP in force          extend VIP, or move up to Premium
Premium in force      extend Premium only
```

⚠️ **Premium is never offered VIP, and that is a safety rule, not an omission.** Paying for VIP
goes through `applyPaidTier`, which clears the previous tier's expiry: the listing would become
VIP and the paid Premium days would be gone. A button that costs the buyer what they already
paid for must not exist — in its place stands a line explaining why it is missing.

Until 2026-10-10 the site did the opposite: a VIP listing was offered only Premium, and a
Premium listing got **no buttons at all**, so it could not be renewed from its own page. The
mobile app was built to the scheme above first, and the site was aligned to the app.

Photo limits and the per-tier feature lists live in `core` (`TIER_PHOTO_LIMITS`,
`photoLimitForTier`, `pricing.features` in the message catalogues). They used to be literals
inside the web editor, which is why the app promised 15 photos to everyone and silently dropped
the rest.

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
| `city` | Region, from the 74-entry directory. Drives region landing pages, the city filter, breadcrumbs and the sitemap. |
| `locationTags` | Places inside a region: villages from `cityDistricts`, Baku districts and metro stations from `cityLocationOptions`. Selected in `CityLocationPicker`; the search filter uses these. |
| `district` | A display label only — a copy of `locationTags[0]`, typed as a plain string. Kept for older records; render it through `districtLabel`. |

`cityDistricts` currently covers 15 of the 74 regions.

### Place names are matched by fold, not by a synonym list

An Azerbaijani place has several legitimate spellings — `Qəbələ`, `Gabala`, `Gebele`, `Габала`
— and users type whichever one they know. `core/src/data/place-match.ts` folds a spelling to a
single comparable form: Azerbaijani letters, Cyrillic transliteration, English digraphs
(`sh`/`ch`/`kh`) and the `q`↔`g`, `x`↔`h` alternations.

The fold is applied to **both** sides of every comparison — to the query and to each of the
four spellings a city carries in the directory. That is what makes it work: any spelling
already in `cities` matches by construction, and the fold only adds deviations on top. The
alias table in `city-aliases.ts` is left for cases where the *names* differ rather than the
spelling (`Bakı`/`Baku`, `Gəncə`/`Ganja`); it is no longer the mechanism.

A typo is forgiven in exactly one place — the suggestion list, where the user sees what was
offered and picks. It is **not** forgiven in `filterProperties` or before geocoding, where only
the result is visible and there is nothing to check it against.

⚠️ `String.prototype.normalize` is deliberately not used: `core/` is shared with the React
Native app, and normalization in Hermes depends on the Intl build. Every substitution is an
explicit table.

⚠️ `resolveCityQuery` must run before any Nominatim call. Measured 2026-09-25: `Gebele` returns
`Qədim Qəbələ, 8 Noyabr prospekti, Xətai rayonu` — a street in **Baku**, not the city Qəbələ.
The response is successful and plausible, so nothing catches it; the listing silently got a pin
in the wrong region. The website already did this; the app did not.

The directory itself is guarded by a collision test in `place-match.test.ts` — no spelling of
one city may match another. It found three wrong Russian names on its first run (`Hacıqabul`
and `Xaçmaz` both carried `Хачмас`).

## Known technical debt

- The dashboard screen remains large and should be split into smaller route-local components.
- Most authenticated reads still use the browser Firebase SDK; moving them server-side requires a Firebase session-cookie layer.
- Booking conflicts are checked when a booking is created, approved and edited, but Firestore
  does not lock date ranges, so two simultaneous requests can still both be accepted. Bookings
  carry no payment, so the owner resolves this by hand; a slot-document design was considered
  and judged disproportionate.
- `cityDistricts` has no entries for most regions, so the second location level is unavailable
  outside the 15 listed there.
- The mobile app creates a booking without a transaction: a client transaction cannot run a
  query inside itself, so it checks availability and then writes. The website does this inside
  a server action. Two requests in the same second are both accepted; the owner confirms
  bookings by hand, so this is tolerated rather than fixed. Move it into a Cloud Function if
  bookings ever start arriving.
- Test coverage is pure logic only — no component or end-to-end tests. What is covered: tier
  logic, display rules, filtering, place-name folding, image URL handling, basemap URLs,
  auth-error and translation completeness, file validation, publication logic, the Firestore
  REST client, and the security rules. What is not: any rendered screen, the payment callback,
  and the scheduled functions.
- The search bar's dropdowns are positioned from JavaScript because they render in a portal at
  `<body>`; `.hero` has `overflow: hidden` and would clip anything hanging below the cover
  image. See `src/app/components/field-popover.tsx` — an earlier attempt set
  `overflow: visible` on the card, which is the wrong level and had no effect.

## Security rules

`pnpm test:rules` runs 90 tests against the Firestore emulator: it starts the emulator, runs
`vitest` with `vitest.rules.config.ts`, then shuts it down. Tests live in `tests/rules/` and are
excluded from the default suite, because `pnpm test:run` must pass without an emulator.

The emulator project is `demo-birklik-rules`. The `demo-` prefix is what guarantees the SDK
cannot reach the real Firebase even if environment variables say otherwise.

It needs a JDK — set `JAVA_HOME` to `/c/Program Files/Java/jdk-26.0.2.1` on the dev machine. A
bare `java -version` still reports 1.8 there because an Oracle shim comes first on PATH.

Two habits these tests exist to enforce:

- **`request.resource.data` on an update is the whole document after the write**, not the changed
  fields. Guarding with `keys().hasAny([...])` therefore also matches fields nobody touched. Use
  `diff(resource.data).affectedKeys()` on updates, plain `keys()` only on creates.
- **Writing a field its existing value does not make it an affected key.** A rule that forbids
  changing `status` will still allow a write that sets `status` to what it already was.

## Photo storage: four URL shapes, one parser

Photos live in Storage under **the uploader's folder**, not the listing's: `properties/{uid}/…`
and `avatars/{uid}/…`. There is no "listing folder" — once a listing document is gone, nothing
points at its files any more. Both the site and the app upload the same way and store the full
download URL with its token.

The same photo is written to Firestore in **four different shapes**, and every one of them
occurs in production:

| shape | who writes it |
|---|---|
| `https://firebasestorage.googleapis.com/…?alt=media&token=…` | fresh upload, site and app |
| `/api/images/properties/…` | older site writes |
| `https://birklik.az/api/images/properties/…` | **the app, on saving an edit** |
| `gs://…` | legacy |

The third one deserves the emphasis. The app cannot render a relative path — Glide rejects it
with `no scheme was found` — so `withImageUrls` prefixes the origin on read. Saving an edit
writes back what was displayed, and the document drifts to the absolute proxy form.

`storagePathFromImageSource` in `core/src/utils/images.ts` is the canonical parser. Deletion in
the site and in the app both go through it, and until 2026-09-26 it did not know the absolute
proxy shape: not the relative prefix, not a Google host, and `new URL` parsed it fine so the
fallback branch never ran. It returned `null`, and **every caller treated `null` as "nothing to
delete"**. Listings edited on the phone left all their photos behind for good.

### ⚠️ The parser exists in four copies, and they drift

`firebase-functions/` is built as a separate package and deliberately does not pull the `core`
submodule in — an import from there would not compile, and vendoring it would bloat the deploy
archive. So the parser is duplicated, and on 2026-09-27 three of the four copies were behind:

| copy | purpose | state before 2026-09-27 |
|---|---|---|
| `core/src/utils/images.ts` | site + app | current |
| `firebase-functions/src/account/delete-account.ts` | account deletion | **missed the absolute proxy shape** |
| `firebase-functions/src/cleanup/firestore-cleanup.ts` | manual `cleanup:execute` | no prefix check, missed bare paths and `storage.googleapis.com` |
| `firebase-functions/src/cleanup/storage-cleanup.ts` + `storage-orphans.ts` | **collects** references | fine — deliberately permissive |

The last row is a different job and must stay permissive: it decides which files are *not*
orphans, so a missed shape there deletes live photos. The others decide what *to* delete, so a
missed shape there leaks files. **Opposite failure directions — do not unify them carelessly.**

Whenever the URL shapes change, all copies change. There is no test runner in the functions
package; the check is to extract the compiled functions out of `lib/` and run the eleven known
shapes through them.

### ⚠️ Collect the image URLs before deleting the document

`cleanupStalePendingListings` and `cleanupTestData` used to `batch.commit()` the document
deletions and *then* call `deletePropertyImages(id)`, which re-read the document to find its
`images` field. It was always gone by then, the function returned on `!doc.exists`, and the
files were never touched — while the log still reported success. Both now gather the URLs
inside the same loop that stages the delete, and `deletePropertyImages` takes **addresses**,
not an id.

Two rules follow, and both are load-bearing:

- **Never treat an unparsed URL as "nothing to delete".** It is a silent loss. `deletePropertyImages`
  now returns `{deleted, failed}` and counts unparsed addresses as failures.
- **Verify deletion against Storage, not against the document.** The document disappears either
  way, and the function's own counters agree either way — they count what they managed to parse.

## Moderators and Storage

Storage rules allow a delete when the caller owns the folder **or** carries `moderator` in the
auth token — the same custom claim `firestore.rules` already uses. Storage rules cannot read
Firestore, so the claim is the only workable source of truth here; no Cloud Function is involved.

Before 2026-09-26 the owner check stood alone, and removing a photo from someone else's listing
worked **halfway and silently**: the URL left the document, so the photo vanished from the site,
while the file stayed in the bucket — still world-readable by direct link, since
`allow read: if true`. The client logged the refusal and reported success. The weekly
`cleanupStorage` would collect it, but only after 30 days.

## Reporting user content: one function, two entry points

Google Play requires an app that carries user-generated content to offer an in-app way to
report it. The app could have written its own report document straight to Firestore, but then
the reason enum, the one-report-per-user rule and the moderation-queue shape would exist twice
and drift apart — exactly the failure the image parser above demonstrates.

So the report follows the path comments and ratings already take:

```
site form ──► reportCommentAction  ─┐
                                    ├─► reportComment()  in  property/[id]/lib/interactions.ts
app modal ──► POST /api/property/report ─┘
```

`reportCommentAction` resolves the session cookie; the route verifies a Firebase ID token and
`emailVerified`. Past that point both call the same function with the same arguments. **App and
site cannot diverge on comments, ratings or reports** — there is one implementation and two
entry points differing only in how the caller is authenticated.

`DuplicateReportError` is part of that contract rather than a generic failure: the route answers
400 with `duplicate`, and both clients say "you already reported this" instead of showing an
error the user would retry forever. The one-report-per-user rule is enforced server-side, so the
app never decides it.

### ⚠️ Proving a new route is deployed

A 401 alone proves nothing — an unknown path behind the same auth middleware can answer 401 too.
Check a deliberately nonexistent sibling path in the same request batch: the real route answers
401 and the control answers 404. Honest 404s only exist because the Workers Paid plan is in
place and no `loading.tsx` sits above the handler; see the deploy notes.
