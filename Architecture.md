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

### Apple's half: `/.well-known/apple-app-site-association`

The same idea for iOS, and the same two-halves trap: this file plus `ios.associatedDomains` in
the app. Either one missing and a birklik.az link quietly opens in the browser.

```
appIDs         BPJZ8DL23K.az.birklik.app   Team ID + bundle id
components     /property/*, /az/..., /ru/..., /en/...
webcredentials the same app — iOS password autofill, matching Android's
               delegate_permission/common.get_login_creds
```

⚠️ **The file has no extension, and must not have one** — Apple requires exactly this name. So
nothing implies its media type, and the `_headers` rule is the only source of
`application/json`. Served as `application/octet-stream` it is silently rejected: links open in
the browser and there is nowhere to look for a reason.

⚠️ The locale-prefixed paths are declared on purpose, and the app does handle them:
`+native-intent.tsx` strips `/az|ru|en` before expo-router sees the path. That hook is not
Android-specific — it runs on both platforms — so what works for the Android intent filters
works here.

⚠️ Unlike Android, there is no certificate fingerprint here, so nothing ties the declaration to
a particular build. What ties it is the Team ID: a build signed by another team will not match.

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

⚠️ **Function credentials are Secret Manager secrets declared in code**, not `.env` files and
not `functions.config()`. `azericard.ts` shows the pattern: `.runWith({secrets: [...]})` on the
function that needs them. A deploy never wipes them — Google stores the values, the code only
names them. There is no `.env` in this project and none is wanted.

```bash
firebase functions:secrets:set APPLE_ISSUER_ID     # Users and Access → Integrations
firebase functions:secrets:set APPLE_KEY_ID        # from SubscriptionKey_<id>.p8
firebase functions:secrets:set APPLE_PRIVATE_KEY   # contents of that .p8
```

⚠️ These three belong to the nightly refund poll **only**. Without them it logs that it was
skipped and exits, and refunds rest on notifications alone. Verifying purchases needs no
configuration at all — the numeric `APPLE_APP_ID` is a constant in `app-store.ts` next to the
bundle id, because it is public (it sits in the App Store URL), never changes, and is needed for
every production purchase. Hidden in a secret it would be one forgotten setting away from
silently refusing every real receipt.

⚠️ The private key arrives with its newlines **escaped**, so the code unescapes `
` before
handing it over. Skip that and the library reports an invalid key format — never a line break,
which is what it actually is.

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

### Boost: lifting a listing inside its own band

A boost moves a listing to the top of **its own band** and never out of it. A boosted standard
listing outranks every other standard listing and still sits below every VIP and Premium. One
helper owns the whole rule — `core/src/utils/boost-helper.ts`:

```
isBoostActive     boostedAt within BOOST_WINDOW_MS (25 h)
compareListings   tier rank → boost → time     ← the only ordering rule on the platform
listingSortTime   boosted: moment of the boost; otherwise createdAt
```

⚠️ **The order of those three steps is a price list.** Move the boost comparison above the tier
one and a 2 ₼ boost outranks a 55 ₼ Premium. Both steps return a number, so nothing in the type
system notices. `core/src/data/filter-properties.test.ts` pins it.

The window is 25 hours, not 24, deliberately: a package is spent by a daily job, and the window
has to outlive the gap between its runs. At exactly 24 h a scheduler running five minutes late
would drop a paid listing out of the band until the next night.

Packages are 1 / 3 / 5 / 10 boosts for 2 / 5 / 8 / 15 ₼ (`BOOST_PRICES` in `core`, with the
mandatory second copy in `azericard.ts` — same reason as `TIER_PRICES`). The first boost happens
at purchase, so a single-boost package leaves **no record at all**; the rest go into
`boosts/{propertyId}` and are spent one a day by `dailyBoosts`, which deletes the record on the
last one. Buying again adds to what is left — unlike `applyPaidTier`, a boost never burns days
already paid for.

⚠️ **Boost is offered to standard listings only.** The code supports it for any band, and a race
(the listing turning VIP between the store window opening and the receipt check) applies it
harmlessly inside the paid band. But the buttons are hidden for VIP and Premium, and
`initiatePayment` refuses such a payment **before** money moves — those two already outrank every
standard listing, and selling them what they have would be dishonest.

⚠️ **The lifted listings need their own query, and without it the feature does nothing.** The
reason is pagination, not ordering: the home feed cuts pages with a cursor on `createdAt`, so an
old boosted listing sits on page three and the in-memory sort never gets the chance to lift it.
`fetchBoostedProperties` in `src/app/queries.ts` fetches them the same way, and for the same
reason, as the paid tiers — both arrive in `HomeProperties.pinned`. Region pages need no such
query: they read every listing at once, so sorting is enough.

The selector is the **presence** of `boostedAt` — the very Firestore behaviour that makes
`orderBy` silently drop documents without the field. Here it works in our favour: a listing
never boosted must not appear in that query. Never backfill `boostedAt` onto every listing "for
consistency"; the query would collect the whole collection.

`boostedAt` is server-written only and sits in the owner's forbidden-field list in
`firestore.rules`, next to `listingTier` and the expiry dates. Left open, a boost would be one
hand-edited document instead of two manats — the cheapest theft available on the platform.
`tests/rules/properties.test.ts` and `tests/rules/boosts.test.ts` hold that shut.

### The App Store till

The third till. One listing state, three tills: Azericard on the website, Google Play and the
App Store in the app. The product catalogue is **shared** — the identifiers in App Store Connect
are the same strings as in Play Console, so `verifyApplePurchase` reads the very same
`PLAY_PRODUCTS` and `BOOST_PRODUCTS` tables, and applies tiers through the same `applyPaidTier`
and `applyBoostPackage`. Only the proof of payment differs.

```
Google   client sends a purchase token, the server asks Google about it
Apple    the purchase token IS the receipt — a JWS signed by Apple, verified here
```

Verification uses Apple's own `@apple/app-store-server-library`: parsing the x5c chain, checking
it against a root, validating certificate expiry and revocation is exactly the sort of code that
fails silently and is discovered by whoever already granted themselves free Premium.

⚠️ **Apple's root certificates are embedded as base64 in `apple-roots.ts`, not shipped as files.**
`tsc` copies only what it compiles — a `.cer` next to the source never reaches `lib/`, and the
deployed function would fail reading it, in production only. The certificates were checked by
owner and fingerprint rather than by a 200 response; the commands to re-check are in the file.

⚠️ **No Apple key is needed for this.** Verifying a purchase needs only the root certificates.
The In-App Purchase `.p8` key is needed for something else entirely — polling refunds, and
answering `CONSUMPTION_REQUEST`.

⚠️ **`APPLE_APP_ID` is required for production receipts and forbidden for sandbox ones.** The
library enforces this. Until the app record exists in App Store Connect the number does not
exist, so production receipts cannot be verified at all — sandbox works fully, so development is
not blocked, but the first real purchase will fail until that variable is set.

#### Sandbox receipts are accepted on purpose

App Review buys in the **sandbox** while the app is already in the store. Refusing sandbox
receipts would therefore fail review itself: the reviewer sees "purchase doesn't work". An
ordinary user cannot produce one — it requires a Sandbox account, which only we can create, and
a build that did not come from the store. Such purchases are flagged `isTestPurchase`, exactly
as Play's licence-test purchases are, so they never count as revenue. The `Xcode` and
`LocalTesting` environments are rejected: their receipts are signed by a developer's local
certificate, which is to say by anybody.

#### Apple has no `obfuscatedProfileId`, so the binding lives in `purchaseIntents`

That Google field is what closed the "process killed after payment" hole on 2026-10-10: Google
stores the listing id inside the purchase and hands it back to the server, so an app that has
forgotten everything still gets the tier applied. Apple offers only `appAccountToken`, and it
**must be a UUID** — neither our uid nor a listing id fits in one.

So the app writes `purchaseIntents/{uuid}` — uid, listing, product — **before** opening the
payment sheet, and sends only the UUID to Apple. It comes back inside the signed receipt, and the
server reads the binding from its own database.

```
allow create   own uid, own listing (checked with a get), not blocked
allow read     nobody — the server reads it under the service account
update/delete  nobody: the intent is single-use and immutable
```

⚠️ A non-UUID in `appAccountToken` is **dropped silently** by StoreKit. The receipt would then
arrive with no binding and the hole would reopen without a single error anywhere. The UUID is
generated from `Math.random` deliberately: it is a lookup key, not a credential — guessing
someone else's buys nothing, because getting it into a receipt costs real money and the server
still compares the intent's owner with the caller.

⚠️ **`onlyIncludeActiveItemsIOS: false` is passed explicitly** when listing unfinished purchases,
and the whole interrupted-purchase protection rests on it. StoreKit counts as "active" what the
user still owns: non-consumables and live subscriptions. Tiers and boosts are **consumables** and
are not in that list. Leave the default and an interrupted purchase simply never appears —
money taken, tier not applied, no error raised.

⚠️ **Quantity is enforced in code.** On Google the "multiple copies per transaction" switch was
turned off in the console, or a buyer would pay for thirty boosts and receive ten. Apple has no
such switch, so `verifyApplePurchase` refuses any quantity other than one; the transaction stays
unfinished and Apple refunds it.

#### Refunds are pushed, not polled

A refund was never a button of ours. The customer complains to Apple, Apple refunds on its own
and merely tells us — and does so markedly more often than Google. The 2026-10-15 audit found
that a refund **took nothing back** on either till, which is invisible from outside: the buyer is
happy, the listing stays on top, the platform pays.

`appleNotifications` is an `onRequest` endpoint receiving App Store Server Notifications V2.
Its URL must be configured in App Store Connect **separately for production and for sandbox**:

```
https://europe-west1-birklik-65289.cloudfunctions.net/appleNotifications
```

⚠️ **The signature is the entire authentication.** The URL is public and holds no secret, because
Apple provides for none — exactly like the Azericard callback, where `P_SIGN` proves authenticity.
The nested `signedTransactionInfo` is verified separately: trusting its contents because the outer
envelope was signed would be a hole.

⚠️ **The response code decides whether Apple retries.** 200 means "accepted, don't repeat" and is
returned even for notification types we ignore — Apple has two dozen of them, nearly all about
subscriptions we do not sell, and refusing them would earn a day of retries. 400 means the
signature failed and a retry changes nothing. 500 means **we** broke, so please send it again:
answering 200 to our own failure loses the refund permanently.

⚠️ **There is no second line of defence for Apple yet.** Google is polled nightly by
`syncPlayRefunds`; the equivalent for Apple needs the In-App Purchase key, which we do not have.
Until then a notification that never arrives is a refund we never see.

⚠️ `CONSUMPTION_REQUEST` cannot be answered without that key either — Apple asks whether the item
was consumed in order to decide the refund, and the answer travels through the App Store Server
API. It is logged loudly so the silence is visible rather than assumed.

⚠️ `REFUND_REVERSED` is **not** acted on automatically. Re-applying would count the tier from
today, granting more than was bought. The claim is flagged `needsManualRestore` and logged as an
error.

### Finishing a payment when the connection dies

Two tills, one effect — and they recover from an interruption in completely different ways.
This section exists because the difference is the whole risk picture.

```
Google Play   the app itself returns to an unfinished purchase on every payment screen, and
              Google refunds an unacknowledged purchase after three days by itself
Azericard     a payment leaves `awaiting_payment` ONLY through the bank's callback. No
              callback, no reconciliation — nobody finds out
```

**The Play side is now closed.** `verifyPlayPurchase` claims the receipt token with a
`create` on `playPurchases/{purchaseToken}` before applying anything, and until 2026-10-14 it
answered *any* already-claimed token with success. That was a silent money hole: if the function
died between claiming the token and `applyPaidTier`, the app's retry got "already applied" and
then **consumed the product** — and consuming is the acknowledgement that stops Google from
refunding. Charged, nothing granted, no refund, nothing in the log.

The claim now carries `applied: false` and only gets `applied: true` once the tier or the boost
is in place. A claimed-but-unapplied token is **finished off** instead of being reported as
done. Recognising old claims written before the flag works off the trace of the work itself —
`expiryDate` for a tier, `boostedAt` for a boost. Applying twice at worst grants an extra day or
an extra boost; not applying takes the buyer's money, so the error is deliberately biased
towards the buyer. The payments-log entry is written once per receipt: on the recovery path the
log is checked by `purchaseToken` first, or one purchase would count as revenue twice.

The Azericard side has no reconciliation, and that gap cannot be closed from inside this
codebase: `azericardCallback` is reached through the buyer's browser, `expireStalePayments` flips
an unanswered payment to `expired` after 24 h, and no status request (Azericard `TRTYPE=90`) is
implemented, so nothing ever asks the bank what happened to an order. Closing it properly means
a reconciliation job against the bank.

**Measured 2026-10-15, and the result matters more than the theory.** The whole ledger was read
and every suspicious payment traced to its listing and its payer:

```
51 payments total — 41 by card, 10 from the app (8 of them licence-test purchases)
card:  6 completed · 14 failed · 21 expired · 2 awaiting at the time of reading
```

Fourteen `failed` records are the important ones: the bank's callback **does** reach us, on
declines as well as approvals — 20 of 41 attempts got an answer. And of the 21 `expired`, every
single one was accounted for: 16 fall in dense June clusters from the launch weeks (six
identical Premium attempts inside one hour on 7 June), 19 have listings long since deleted as
abandoned drafts, one was a deliberate test by the owner on 10 October, and one more resolved
itself four minutes later — the buyer retried and that second payment is `completed`. The owner
checked the single remaining case with the buyer directly: **no money had been charged.**

So `expired` means "the person reached the bank page and did not finish", not "we lost an
answer". The theoretical gap stands; there is no evidence it has ever cost anyone money.

`pnpm payments:stuck` in `firebase-functions` is the tool for the next time. It changes nothing,
and it reports the **trace of the work** rather than the live tier — an expiry date ever written
and matching "payment date + duration". Asking `isTierActive` was the first version of that
check and it was useless: a 14-day VIP bought in August is expired by September anyway, so
"no tier" said nothing. ⚠️ And a tier in the database is **not** proof of payment either —
moderators set `listingTier` and the expiry dates by hand from their editor, and nothing records
which author wrote them. Only the bank's cabinet knows about money.

### A refund has to take back what it paid for

Found and closed 2026-10-15, and it had been open since the first paid listing. The whole audit
was hunting "paid and got nothing"; this is the mirror image — **got the money back and kept the
service** — and it is invisible from the outside, because the buyer is happy and files no
complaint.

```
card    the TRTYPE=22 branch marked the payment `reversed` and never touched the listing
Play    refunds were not visible at all: no Pub/Sub notifications, no voidedpurchases poll
```

The card half had even been written down before: when `performReversal` was deleted on
2026-08-09 the note said "a successful reversal did not downgrade the listing — it let you take
the money back and keep premium". The function went; the hole stayed and merely became
unreachable from outside.

Both halves now go through two revoke functions, next to the apply ones and for the same reason
— one effect, two tills:

```
revokePaidTier       listingTier → standard, isFeatured → false, both expiry fields DELETED
revokeBoostPackage   boostedAt DELETED, boosts/{id} removed, remaining boosts forfeited
syncPlayRefunds      daily 02:00 UTC — asks Google for voided purchases, revokes, marks the claim
```

⚠️ The expiry fields and `boostedAt` are **deleted, not blanked**. An empty string is still a
present field, and both the pinned-band query and the boosted query select on *presence* — a
blanked `boostedAt` would keep a refunded listing in the homepage's pinned band with no boost
behind it.

⚠️ `type=1` is mandatory on `voidedpurchases.list`. The default returns **subscriptions only**,
and every product here is one-time — without it the list would always come back empty and the
hole would look closed.

⚠️ The poll looks a week back on a daily schedule. Repeats are harmless (the claim carries a
`voided` flag) but a missed run is not: Google keeps voided purchases for about thirty days and
what is missed cannot be recovered.

⚠️ A refund issued from the **bank's own cabinet** probably never reaches `azericardCallback` at
all — the callback hangs off our `BACKREF`. So the card half is not self-sufficient: a manual
refund needs a manual downgrade. `pnpm payments:stuck` lists reversals and flags the ones whose
revoke was never recorded.

The same audit closed two smaller things in the callback. The amount in the callback is now
compared to the amount we computed when the payment was created: the bank's signature covers
`AMOUNT`, so it cannot be forged, but a signature only proves "the bank signed this", not "the
bank charged what we asked".

⚠️ **The comparison refuses an underpayment only, and that asymmetry is deliberate.** The first
version of this check refused *any* mismatch — and that was dangerous in exactly the way the
rest of this section is about. The bank's `AMOUNT` format has never been verified against a live
callback here: if it ever arrives in minor units (`5500` for 55 ₼) or with another decimal
separator, a strict check would start rejecting **every correct payment** — money charged, tier
withheld, across the board. So: paid less → refuse and flag `needsRefund`; paid more → apply and
log loudly, because a changed format must never cost the buyer their purchase; unparseable →
skip the check entirely. And `applyPaidTier` now **survives a listing that was deleted between payment and
callback**: `update` on a missing document throws, the throw would 500 the bank's callback, and
the payment would stay in `awaiting_payment` for ever — money taken, ledger reading "awaiting".
That guard already existed in `applyBoostPackage`; it did not here. Such a payment is marked
`needsRefund` and shows up first in `pnpm payments:stuck`.

### Who changed this listing's tier

`listingTier` and the expiry dates have **two** possible authors: a confirmed payment and a
moderator's hand. The document keeps only the result, so until 2026-10-15 "who gave this listing
Premium" had no answer at all. The payment audit of that day ran straight into it: one listing
had its tier fields removed outright and nothing could say whether that was a refund, a job, or
an edit.

`auditTierChanges` — a Firestore `onUpdate` trigger on `properties/{id}` — now records every
change to `listingTier`, `premiumExpiresAt`, `vipExpiresAt`, `isFeatured` and `boostedAt` into
`tierAudit`, with before/after values and a classification:

```
оплата                  a payments record for this listing completed within 3 minutes
возврат денег           … or reversed within 3 minutes
ночная задача подъёма   only boostedAt moved, and boosts/{id}.lastBumpAt is fresh
РУКАМИ                  nothing explains it — logged as a warning as well
```

⚠️ **A trigger, not a write from the browser, and that is the whole point.** An edit made in the
Firebase console would never reach a client-side log — and that is exactly the kind of edit that
happened on 2026-08-31. The trigger sees every write to the document regardless of its author.

⚠️ The cost is one function invocation per listing update. `auditTierChange` therefore starts by
diffing those five fields and returns on an ordinary text or photo edit before issuing a single
database read.

⚠️ A trigger has no signed-in user, so the author comes from `updatedBy`, written by the
moderator editor — and it is trusted **only when `updatedAt` changed in the same write**.
Otherwise it is the author of the *previous* edit, and attributing a console edit to them is
worse than admitting the author is unknown.

Writes to `tierAudit` are denied to everyone in `firestore.rules`, moderators included — a log
that can be edited is not a log. Moderators may read it. `pnpm tier:audit` and `pnpm tier:hand`
in `firebase-functions` print it, the second filtering to changes no payment explains.

⚠️ The log starts at deployment. Nothing before it can be reconstructed.

## Scheduled functions

All in `europe-west1`, defined in `firebase-functions/src/index.ts`. They are deployed
separately from the worker — `pnpm functions:deploy`. A fix that only sits in the repository
is not in production; a stale deployment of `cleanupStorage` once deleted 124 live photos for
that reason (see `AUDIT.md`).

| Function | Schedule | What it does |
|---|---|---|
| `cleanupDrafts` | every 2 hours | Expires stale payments, then removes abandoned drafts. Skips a draft while its payment is still `awaiting_payment`. |
| `expirePaidTiers` | daily 03:00 UTC | Marks listings whose paid tier ran out as `inactive` and records `expiredAt`. Deletes nothing. |
| `dailyBoosts` | daily 01:00 UTC | Spends one boost per listing from `boosts/`, deletes the record on the last one. 01:00 UTC is 05:00 in Baku — the lift has to land before people start browsing. Skips **without spending** when the last boost is under 20 h old (scheduler retries and manual runs must not burn paid days) or when the listing is off display (a paid day on a hidden listing is a day nobody sees). Removes records whose listing is gone, and abandoned ones after 90 days. |
| `syncPlayRefunds` | daily 02:00 UTC | Asks Google for voided purchases (refunds, chargebacks) and takes the paid tier or boost back. Looks a week back so a missed run is caught up; repeats are safe through the `voided` flag on the claim. 02:00 UTC sits between `dailyBoosts` and `expirePaidTiers`, so refunds are settled before expiry dates are counted. |
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

- A blocked person's paid days keep burning. Blocking pulls their listings off the storefront
  but `premiumExpiresAt` and `vipExpiresAt` still expire on schedule, so a long block eats days
  the person paid for. Freezing the dates would be fairer but gives them a second meaning, which
  every query reading them would have to learn. Left as a decision for the platform owner; see
  "Blocking a person".

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
- No reconciliation with Azericard. If the bank ever approves a payment whose callback does not
  reach us, the money is charged and the tier is not set, and nothing detects it. Measured on
  2026-10-15: no case of this has been found in the whole ledger, and the callback demonstrably
  arrives on both approvals and declines — so this is a latent gap, not an active leak.
  Implementing the bank's status request (`TRTYPE=90`) on a schedule is the real fix; `pnpm
  payments:stuck` is the manual stand-in. See "Finishing a payment when the connection dies".
- Refunds issued from the Azericard cabinet are not detected. `azericardCallback` only hears
  about a reversal that comes through our `BACKREF`; a refund made by hand in the bank's own
  interface never reaches us, so the downgrade has to be done by hand too. The Play half is
  automatic (`syncPlayRefunds`). See "A refund has to take back what it paid for".
- Tier changes made before 2026-10-15 cannot be attributed. `auditTierChanges` logs every change
  from its deployment onwards, but the history before it is gone — including the listing whose
  tier fields were removed outright on 2026-08-31. See "Who changed this listing's tier".
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

`pnpm test:rules` runs 107 tests against the Firestore emulator: it starts the emulator, runs
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

## Blocking a person

Apple's guideline 1.2 asks three things of an app carrying user-generated content: a way to flag
objectionable content, published contact details, and **the ability to block abusive users from
the service**. The first two existed — `commentReports` and the contacts page. The third did not,
and a moderator's only tools were deleting one comment or one listing at a time.

There is no user-to-user messaging here, so blocking is a moderator action only: people cannot
reach each other inside the platform, and blocking each other would protect nobody.

**What a block forbids** is posting and talking: creating or editing listings, commenting,
rating and booking. Signing in and browsing stay open deliberately — the person has to be able
to read why and reach support.

### The ban lives in two places, and neither of them is a profile field

```
claim `blocked` in the ID token ──► Firestore rules: listings, bookings
users/{id}.blocked               ──► nothing. It explains, it does not forbid
interactions.ts server check     ──► comments, ratings
```

⚠️ **Both halves are mandatory.** Comments and ratings are written by the service account, which
rules do not apply to **at all** — a ban living only in rules would not stop a blocked person
from commenting for one second. Conversely listings and bookings are written by the client
straight into Firestore and never reach our server, so the server check cannot see them.

⚠️ **A claim, not a document read in the rules.** `get(/users/$(uid)).data.blocked` would cost an
extra read on every listing save and every favourite toggle, for everybody, including people
nobody ever blocked. The claim already arrives with the request and is free — the same mechanism
`moderator` uses.

⚠️ **The price of a claim is up to an hour of lag.** A claim reaches the token when the token is
refreshed, and a token lives an hour. `setUserBlocked` calls `revokeRefreshTokens` so the refresh
happens at once, but an already-issued token survives its hour. So a blocked person may still
create a listing within that window — and that is nearly harmless, because the rules force an
ordinary new listing to be born `pending`, invisible until a moderator approves it. Comments and
ratings have no such window: the server reads the document live.

⚠️ **`'blocked' in request.auth.token` is checked separately, and without it the rule breaks
everything.** Reading a missing key off the token map does not yield false in rules — it raises
an evaluation error, and an error inside an `&&` chain means denial. Nobody except blocked people
has the claim, so the short form `token.blocked == true` would have denied listing and booking
creation to **every normal user**. The rules tests caught it before deployment; in production it
would have looked like "the whole site is broken".

### Listings leave the storefront with a mark

Blocking flips the owner's `active` listings to `inactive` and marks each one `hiddenByBlock`.
Unblocking restores **only the marked ones** and deletes the mark.

⚠️ The mark is what makes unblocking safe. Some of those listings were hidden by the owner long
before the block; without a mark, unblocking would push them back onto the storefront — showing
the world listings the person deliberately kept hidden. The field is deleted rather than set to
`false`, like `boostedAt`, because queries elsewhere select on its presence.

`hiddenByBlock` sits in the owner's forbidden-keys list in the rules alongside `boostedAt`: an
owner who could clear the mark would get nothing back when unblocked.

⚠️ **Paid days keep burning while blocked.** A Premium listing pulled from the storefront still
expires on schedule. Freezing the expiry would be fairer but introduces a second meaning for
those dates, so it was left out deliberately — flagged as a decision, not an oversight.

### What the blocked person sees

The reason, written by the moderator, in their account — `BlockedNotice` on the site, the same
component name in the app, shown on profile, listings and the add-listing screen. Showing the
reason is the platform owner's choice: without it a block looks like a broken site, and the
person calls support with "nothing works".

They cannot hide it. Rules keep `blocked`, `blockedReason`, `blockedAt` and `blockedBy` in the
same forbidden-keys list as `isModerator` — clearing the field would not lift the ban anyway,
but it would produce a caller convinced nobody ever blocked them.

⚠️ Both auth providers build the profile **field by field**, so anything not listed there is
dropped. `blocked` and `blockedReason` are passed through explicitly in each; forget that and the
notice never appears.

### Guards inside the function

`setUserBlocked` refuses to block a moderator and refuses to block the caller. Without the first,
one moderator could switch off another — including the platform owner, after which nobody could
undo it, because the button is moderators-only.

⚠️ `setCustomUserClaims` **replaces** the whole claims object rather than merging into it. The
function reads the existing claims and merges; writing `{blocked: true}` would one day erase
somebody's `moderator`.

Every block and unblock lands in `blockAudit` — who, whom, why, how many listings moved — by the
same reasoning as `tierAudit`: in six months "who blocked this person and what for" must have an
answer. Writes are denied to everyone, moderators included.

Reporting a comment is left open to blocked people on purpose: it is the safety valve, and
repeat reports on the same comment are already rejected.

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
