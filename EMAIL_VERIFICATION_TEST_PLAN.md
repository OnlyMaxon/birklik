# Email Verification - Testing Plan

## Fixes Applied
1. ✅ Added `firebaseUser.reload()` + `getIdToken(true)` before `sendEmailVerification()` in VerifyEmailPage
2. ✅ Added token refresh after email verification in ResetPasswordPage  
3. ✅ Added 100ms delay in ProtectedRoute to ensure reload() completes
4. ✅ Added console logging for debugging
5. ✅ Improved error handling in VerifyEmailPage

## Test Scenarios

### Test 1: Initial Email Verification (After Registration)
**Steps:**
1. Register new account with test email
2. Click "Resend Verification Email" button
3. Check browser console for: `[EmailVerification] applyActionCode successful` logs
4. **Expected:** Email sent successfully (no 400 errors)
5. **Verify:** Message says "Verification email sent!" + 60s cooldown shows

**Potential Issues to Check:**
- Should NOT see auth/invalid-credential errors
- Should NOT see 400 errors from identitytoolkit
- Should see cooldown timer activates

---

### Test 2: Click Email Verification Link (Direct URL)
**Steps:**
1. Check email inbox for verification link
2. Click on link (URL format: `https://birklik.az/auth/action?oobCode=XXX&mode=verifyEmail`)
3. Page should show: "Email verified successfully!" message
4. After 2 seconds: Auto-redirect
5. **Expected Path Options:**
   - If logged in: Redirect to `/dashboard`
   - If not logged in: Redirect to `/login`

**Potential Issues to Check:**
- Should NOT redirect to home page "/"
- Should NOT loop infinitely  
- Check console for: `[EmailVerification] Scheduling redirect...`
- Check console for: `[EmailVerification] Redirecting to /dashboard` OR `/login`

---

### Test 3: Dashboard Access After Verification
**Steps:**
1. After email verification link clicked, user is on login page
2. Log in with verified email
3. Should go to `/dashboard` immediately
4. Should NOT redirect back to `/verify-email`
5. Dashboard should load without refresh loop

**Potential Issues to Check:**
- Should NOT see "Verify Your Email" page again
- Check console for: `[ProtectedRoute] Email not verified` should NOT appear
- Check console: `[ProtectedRoute] emailVerified status: true`

---

### Test 4: Resend Verification Email (After Initial Verification)
**Steps:**
1. If on `/verify-email` page
2. Click "Resend Verification Email" again
3. **Expected:** Check for error message OR success message

**Potential Error Scenarios:**
- If email already verified: Should show message "Email already verified or user not found"
- If user account deleted: Should show "User account not found. Please log in again."
- If session expired: Should show "Session expired. Please log in again."

---

### Test 5: Expired Verification Link
**Steps:**
1. Wait > 24 hours from initial registration
2. Attempt to click verification link again
3. **Expected Error:** "Verification link has expired"
4. Should allow user to resend

---

## Console Log Checklist

When testing, open Developer Console (F12) and look for these logs:

### During Email Verification (clicking link):
```
[EmailVerification] applyActionCode successful
[EmailVerification] Reloading user data...
[EmailVerification] User reloaded. emailVerified: true
[EmailVerification] Token refreshed
[EmailVerification] Scheduling redirect...
[EmailVerification] Redirecting to /dashboard
```

### During Resend Email:
```
No [EmailVerification] logs (resend is in VerifyEmailPage, not ResetPasswordPage)
Should process normally without errors
```

### During Dashboard Access:
```
[ProtectedRoute] Checking email verification for: user@email.com
[ProtectedRoute] emailVerified status: true
```

---

## Error Scenarios That Should NO LONGER OCCUR

### ❌ OLD: 400 Bad Request from identitytoolkit
**Status:** Should be FIXED
- Cause was: `firebaseUser` object was stale
- Fix: Added `firebaseUser.reload()` + `getIdToken(true)` before `sendEmailVerification()`

### ❌ OLD: Redirect loop between /verify-email and /dashboard  
**Status:** Should be FIXED
- Cause was: Race condition between reload() and redirect
- Fix: Added 100ms delay and token refresh

### ❌ OLD: Clicking verification link opens home page
**Status:** Should be FIXED
- Redirect logic now explicitly goes to /login if not authenticated
- Console logs will show which path was taken

---

## Production Deployment

- **Build:** 196 modules, 0 errors ✅
- **Deployment:** Cloudflare Pages ✅
- **Service Worker:** Cache versioning in place ✅
- **URL:** https://birklik.az

---

## Rollback Plan (if needed)

If issues persist:
1. Check browser console for logs starting with `[EmailVerification]`
2. Share console error messages
3. Can rollback by:
   - Reverting ResetPasswordPage.tsx changes
   - Reverting VerifyEmailPage.tsx changes
   - Reverting App.tsx ProtectedRoute changes
   - Run `npm run build` + `npx wrangler pages deploy dist`
