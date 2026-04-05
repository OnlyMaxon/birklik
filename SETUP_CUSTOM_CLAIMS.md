# Setup Firebase Custom Claims (Moderator Role)

## Why Custom Claims?

Instead of hardcoding moderator emails, Firebase allows setting custom claims on user tokens. This is:
- ✅ Secure: Claims verified by Firebase
- ✅ Scalable: Easy to add/remove moderators
- ✅ Safe: Cannot be faked by client
- ✅ Better: Works with Firestore Rules directly

## Step-by-Step Setup

### 1. In Firebase Console

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project → **Authentication**
3. Click on the **Users** tab
4. Find the user you want to make a moderator
5. Click the three dots (⋯) menu → **Custom claims**
6. Enter JSON: 
   ```json
   {
     "moderator": true
   }
   ```
7. Click **Save**

### 2. What Happens Now

- User's next login will refresh their token with the claim
- Firestore Rules check `request.auth.token.moderator == true`
- User can manage any property (edit/delete/change status)

### 3. In Your Code

The claim is automatically available:

```typescript
// In AuthContext or after login
const token = await firebaseUser?.getIdTokenResult()
console.log(token?.claims?.moderator) // true or undefined
```

### 4. Current Code Reference

**App.tsx - ModeratorRoute:**
```typescript
const ModeratorRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isAuthenticated, isLoading } = useAuth()

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  // Currently checks email for backward compatibility
  if (!isModeratorEmail(user?.email)) {
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}
```

**To migrate to token-based:**
```typescript
const ModeratorRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { firebaseUser, isAuthenticated, isLoading } = useAuth()

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  // Check token claim
  const claims = (firebaseUser as any)?.auth?.currentUser?.getIdTokenResult()?.claims
  if (!claims?.moderator) {
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}
```

## Multiple Moderators

Repeat the same process for each moderator user. Each gets:
```json
{
  "moderator": true
}
```

## Removing Moderator Access

1. Go to Firebase Console → Authentication → Users
2. Find the moderator user
3. Click three dots → Custom claims
4. Clear the JSON or set `{ "moderator": false }`
5. Save

The claim is removed from their next token refresh (within 1 hour).

## Firestore Rules Using Custom Claims

Already configured in `firestore.rules`:

```firestore
function isModerator() {
  return request.auth != null && request.auth.token.moderator == true;
}

match /properties/{propertyId} {
  allow update: if (
    isOwner(resource.data.ownerId) || isModerator()
  )
}
```

## Troubleshooting

**Q: Moderator claim not working after setting?**
- A: User needs to log out and back in, or call `firebaseUser.getIdTokenResult(true)` to force refresh

**Q: How do I verify it's set correctly?**
- A: In Firebase Console, next to the claim, you should see a green checkmark

**Q: Can I test this locally?**
- A: Yes, same Firebase project. Changes apply immediately after token refresh.

## Security Notes

- Custom claims are **read-only** from client code
- Client cannot set own claims (Firebase handles this)
- Claims are verified in Firestore Rules server-side
- Email fallback in code is for backward compatibility only

## Next: Remove Email Hardcoding

Once all moderators have custom claims set, you can remove:
```typescript
const MODERATOR_EMAILS = [
  'calilorucli42@gmail.com',
  'elgun.akhundov@gmail.com'
]
```

And use only token-based verification.
