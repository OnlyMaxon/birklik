# Birklik.az - Quick Action Summary

## 🔴 CRITICAL (DO THIS TODAY - Next 24 hours)

### 1. REVOKE Firebase API Key
**Status**: 🚨 SECURITY BREACH  
**Action**: 
```bash
# 1. Go to: Firebase Console → Project Settings → Service Accounts
# 2. Delete key: AIzaSyDdWTip4DznmrrFH9WdH4EqSKeByKMaMzI
# 3. Generate new key
# 4. Remove from wrangler.jsonc and commit
git rm --cached wrangler.jsonc  # Remove from version control
echo "wrangler.jsonc" >> .gitignore
# 5. Delete key from git history
git filter-branch --tree-filter 'rm -f wrangler.jsonc' HEAD
```
**Time**: 15 minutes  
**Impact**: Critical security fix

---

### 2. Implement Booking Conflict Detection
**Status**: ❌ Missing functionality  
**Files to Modify**:
- `src/services/bookingService.ts` - Add `checkBookingConflict()` function
- `src/pages/PropertyPage/PropertyBooking.tsx` - Call it before creating booking

**Template**: See detailed section in AUDIT_REPORT.md  
**Time**: 2 hours  
**Impact**: Prevents double bookings

---

### 3. Fix Firestore Authorization Rules  
**Status**: ❌ Critical vulnerability  
**File**: `firestore.rules`

**Changes needed**:
1. **Bookings Collection**: Restrict update to only booking creator
2. **Properties Collection**: Prevent race conditions on shared fields
3. **Bookings Collection**: Restrict read to only authorized users

**Template**: See sections 3 & 4 in AUDIT_REPORT.md  
**Time**: 1.5 hours  
**Impact**: Prevents unauthorized access

---

### 4. Enforce Email Verification
**Status**: ⚠️ Security gap  
**Files to Modify**:
- `src/context/AuthContext.tsx` - Add `isEmailVerified` state
- `src/App.tsx` - Protect dashboard route
- `src/pages/VerifyEmailPage/VerifyEmailPage.tsx` - Auto-check verification

**Template**: See section 5 in AUDIT_REPORT.md  
**Time**: 3 hours  
**Impact**: Prevents fake accounts

---

## 🟠 HIGH PRIORITY (Next 1 Week)

### 5. Remove Console Statements (30+ locations)
```bash
# Find all console statements
grep -r "console\." src/ --include="*.ts" --include="*.tsx"

# Create logging service at src/services/logger.ts
# Replace all console.error with logger.error()
```
**Time**: 2 hours  
**Impact**: Performance + security

---

### 6. Implement Server-Side Filtering
**Issue**: Homepage loads ALL properties into memory  
**Solution**: Add Firestore indexes and move filters to query level  
**Time**: 4 hours  
**Files**: 
- `src/services/propertyService.ts` - Add ALL filters to query
- Firebase Console - Create composite indexes

---

### 7. Fix Calendar Date Selection
**Issue**: Can select disabled dates  
**Fix**: Add validation check before allowing selection  
**Time**: 30 minutes  
**File**: `src/pages/PropertyPage/PropertyBooking.tsx`

```typescript
// Add at start of handleCellClick
if (isCellDisabled(dateISO)) {
  setMessage({ type: 'error', text: 'This date is unavailable' })
  return
}
```

---

### 8. Add Rate Limiting to Reverse Geocode
**Issue**: Nominatim API gets blocked  
**Fix**: Debounce requests  
**Time**: 1 hour  
**File**: `src/pages/DashboardPage/DashboardPage.tsx`

---

## 📋 DEPLOYMENT CHECKLIST

Before deploying to production, complete these:

- [ ] **CRITICAL**: Fix all 5 critical issues
- [ ] Remove API key from version control
- [ ] Create backup of production data
- [ ] Test email verification flow
- [ ] Test booking conflict scenario
- [ ] Review Firestore rules with security team
- [ ] Load test with 1000+ properties  
- [ ] Test on mobile (iOS + Android)
- [ ] Set up error monitoring (Sentry)
- [ ] Enable HTTPS everywhere
- [ ] Configure secure headers
- [ ] Set up WAF (Web Application Firewall)

---

## 🎯 PRIORITY MATRIX

| Issue | Severity | Time | Value | Do Now? |
|-------|----------|------|-------|---------|
| API Key Exposed | CRITICAL | 15 min | Critical | ✅ YES |
| Booking Conflicts | CRITICAL | 2h | Critical | ✅ YES |
| Firestore Auth | CRITICAL | 1.5h | Critical | ✅ YES |
| Email Verification | CRITICAL | 3h | High | ✅ YES |
| Console Statements | HIGH | 2h | Medium | ✅ This week |
| Server Filtering | HIGH | 4h | High | ✅ This week |
| Calendar Fix | HIGH | 30m | Medium | ✅ This week |
| Rate Limiting | HIGH | 1h | Medium | ✅ This week |

---

## 📊 PROGRESS TRACKING

Track your fixes here:

- [ ] Day 1: API key + Booking conflicts (2-3 hours)
- [ ] Day 2: Firestore auth rules + Email verification (4-5 hours)
- [ ] Day 3-4: Console removal + Server filtering (6-8 hours)  
- [ ] Day 5+: Calendar + Rate limiting + Testing

**Total Time to Production-Ready**: ~20-24 hours

---

## 🆘 NEED HELP?

- Refer to full [AUDIT_REPORT.md](./AUDIT_REPORT.md) for detailed explanations
- Session audit details in memory file: `/memories/session/birklik-audit-findings.md`
- Each critical issue has complete code templates

---

## ✨ AFTER CRITICAL FIXES

Consider adding these improvements:

1. **Error Monitoring**: Sentry integration (2 hours)
2. **Performance Optimization**: Image compression + lazy loading (4 hours)
3. **Test Coverage**: Add unit tests (8+ hours)
4. **Security Headers**: CSP + HSTS (1 hour)
5. **Rate Limiting**: Cloud Functions (2 hours)

---

**Document Generated**: April 13, 2026  
**Next Review**: After critical fixes completed  
**Deployment Approval**: After security team review
