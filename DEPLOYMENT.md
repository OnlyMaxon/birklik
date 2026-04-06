# Deployment Guide - Birklik.az

## ✅ Pre-Deployment Checklist

- [x] All 8 optimization tasks completed
- [x] Build passing (0 errors, 1.94s)
- [x] Tests passing (27 passed, 2 skipped)
- [x] Pagination system implemented
- [x] Component architecture refactored
- [x] TypeScript strict mode passing
- [x] JSDoc documentation complete

## 🚀 Deployment Steps

### 1. Prerequisites

Make sure you have:
- `wrangler` CLI installed: `npm install -g wrangler`
- Firebase CLI installed: `npm install -g firebase-tools`
- Cloudflare account with API token
- Firebase project configured

### 2. Build for Production

```bash
npm run build
```

Verify output:
- `dist/` folder created
- No TypeScript errors
- Build time < 2.5s

### 3. Deploy to Cloudflare Workers

```bash
# Login to Cloudflare
wrangler login

# Deploy
wrangler publish
```

Or in wrangler v3+:
```bash
wrangler deploy
```

### 4. Deploy Firebase Rules

```bash
# Deploy Firestore rules
firebase deploy --only firestore:rules

# Deploy Storage rules
firebase deploy --only storage:rules
```

Or deploy everything:
```bash
firebase deploy
```

### 5. Verify Deployment

```bash
# Check Cloudflare deployment
wrangler deployments list

# Verify Firebase deployment
firebase deploy:info
```

## 📋 Deployment Verification Checklist

After deployment, verify:

- [ ] **Frontend loads** - Visit your Cloudflare Workers URL
- [ ] **Firebase Auth works** - Try login/register
- [ ] **Firestore queries** - Browse properties, check console
- [ ] **Firebase Storage** - Upload test image in dashboard
- [ ] **Pagination works** - Check featured properties load
- [ ] **No console errors** - Open DevTools and reload
- [ ] **Mobile responsive** - Test on mobile device
- [ ] **Performance** - Check build size (main bundle < 400KB)

## 🔧 Environment Variables

Ensure these are set in your Cloudflare Workers environment:

```
VITE_FIREBASE_API_KEY=<your-api-key>
VITE_FIREBASE_AUTH_DOMAIN=<your-domain>
VITE_FIREBASE_PROJECT_ID=<your-project>
VITE_FIREBASE_STORAGE_BUCKET=<your-bucket>
VITE_FIREBASE_MESSAGING_SENDER_ID=<your-sender-id>
VITE_FIREBASE_APP_ID=<your-app-id>
```

These are already configured in `wrangler.jsonc`.

## 📊 Current Build Metrics

- **Build Time**: 1.94s
- **Main Bundle**: ~142KB (gzip)
- **React Vendor**: ~142KB
- **Firebase**: ~255KB
- **Total Size**: ~662KB (gzip)
- **Modules**: 178 transformed
- **Errors**: 0
- **Warnings**: 0

## 🔄 Rollback Plan

If deployment issues occur:

```bash
# Rollback Cloudflare deployment
wrangler rollback

# Or redeploy previous version
git checkout HEAD~1
npm run build
wrangler deploy
```

## 📝 Post-Deployment Monitoring

1. **Monitor Cloudflare Analytics**
   - Check request logs
   - Monitor error rates
   - Track performance metrics

2. **Firebase Console Monitoring**
   - Database stats
   - Authentication metrics
   - Storage usage

3. **Error Tracking**
   - Set up Sentry or similar
   - Monitor browser console errors
   - Track user-reported issues

## 🎯 Recent Changes Deployed

- ✅ Pagination system (server-side queries)
- ✅ Component refactoring (PropertyPage, DashboardPage splits)
- ✅ Comment replies system (nested structure)
- ✅ Moderator token-based access
- ✅ Booking dashboard integration
- ✅ Base service class for CRUD reuse
- ✅ Full JSDoc documentation

## 💡 Tips

- **Faster deployments**: Use `wrangler preview` to test before deploying
- **Asset caching**: Cloudflare Pages auto-caches static assets with long TTL
- **Database**: Firestore scales automatically, no action needed
- **Storage**: Monitor Firebase Storage quota and clear old uploads regularly

## Need Help?

- Check Cloudflare docs: https://developers.cloudflare.com/workers/
- Firebase docs: https://firebase.google.com/docs
- Wrangler docs: https://developers.cloudflare.com/workers/wrangler/
