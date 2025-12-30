# 18_SECURITY.md

**Last Updated:** December 30, 2025
**Status:** Active  
**Owner:** Claude + Peter

---

## TABLE OF CONTENTS
1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Authorization](#authorization)
4. [Data Protection](#data-protection)
5. [API Security](#api-security)
6. [Frontend Security](#frontend-security)
7. [Security Checklist](#security-checklist)

---

## OVERVIEW

Security is critical for protecting user data and maintaining trust. Voquab follows industry best practices for web application security.

**Security Principles:**
- Defense in depth (multiple layers)
- Least privilege (minimum necessary access)
- Secure by default (safe defaults, opt-in for risk)
- Trust but verify (validate all inputs)

**Threat Model:**
- Unauthorized access to user accounts
- Data leakage (user progress, personal info)
- XSS attacks
- CSRF attacks
- SQL injection

---

## AUTHENTICATION

### Supabase Auth

Voquab uses Supabase Auth (built on PostgreSQL + JWT).

**Features:**
- Email/password authentication
- Email verification
- Password reset
- Secure session management
- JWT tokens

---

### Password Requirements

**Minimum requirements:**
- Length: 8 characters minimum
- Complexity: No strict requirements (passphrases encouraged)
- No common passwords (handled by Supabase)

**Client-side validation:**
```javascript
function validatePassword(password) {
  if (password.length < 8) {
    return 'Password must be at least 8 characters';
  }
  
  // Optional: Check for common patterns
  if (password.toLowerCase() === 'password') {
    return 'Password too common';
  }
  
  return null; // Valid
}
```

**Server-side:**
- Supabase handles password hashing (bcrypt)
- Prevents brute force (rate limiting)
- Never stores passwords in plain text

---

### Sign Up Flow

```javascript
async function signUp(email, password) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${window.location.origin}/auth/callback`
    }
  });
  
  if (error) throw error;
  
  // Email verification required before full access
  return data;
}
```

**Security measures:**
- Email verification required
- Rate limited (prevent spam signups)
- Password hashed server-side

---

### Sign In Flow

```javascript
async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });
  
  if (error) {
    // Generic error message (don't leak account existence)
    throw new Error('Invalid email or password');
  }
  
  return data;
}
```

**Security measures:**
- Generic error messages (prevent user enumeration)
- Rate limited (prevent brute force)
- Sessions expire (configurable, default 1 week)

---

### Session Management

**JWT Tokens:**
- Access token (short-lived, 1 hour)
- Refresh token (long-lived, 1 week)
- Stored in localStorage (Supabase default)

**Auto-refresh:**
```javascript
// Supabase handles this automatically
const { data: { session } } = await supabase.auth.getSession();

// Listen for auth changes
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_OUT') {
    // Redirect to login
  }
  if (event === 'TOKEN_REFRESHED') {
    // Session automatically refreshed
  }
});
```

---

### Password Reset

```javascript
async function requestPasswordReset(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`
  });
  
  if (error) throw error;
  
  // Always show success (prevent user enumeration)
  return 'If that email exists, we sent a reset link';
}

async function updatePassword(newPassword) {
  const { error } = await supabase.auth.updateUser({
    password: newPassword
  });
  
  if (error) throw error;
}
```

**Security measures:**
- Reset link expires (1 hour)
- One-time use token
- Generic success message

---

## AUTHORIZATION

### Row Level Security (RLS)

**Supabase RLS policies enforce data access rules at database level.**

**Critical principle:** Users can only access their own data.

---

### User Data Policies

**user_lemma_progress table:**

```sql
-- Users can only read their own progress
CREATE POLICY "Users can read own progress"
  ON user_lemma_progress
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Users can only insert their own progress
CREATE POLICY "Users can insert own progress"
  ON user_lemma_progress
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Users can only update their own progress
CREATE POLICY "Users can update own progress"
  ON user_lemma_progress
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Users cannot delete progress
-- (no DELETE policy = forbidden)
```

**user_word_encounters table:**

```sql
CREATE POLICY "Users can read own encounters"
  ON user_word_encounters
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own encounters"
  ON user_word_encounters
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());
```

---

### Public Data Policies

**lemmas table (public read, admin write):**

```sql
-- All authenticated users can read lemmas
CREATE POLICY "Authenticated users can read lemmas"
  ON lemmas
  FOR SELECT
  TO authenticated
  USING (true);

-- Only admins can modify lemmas
CREATE POLICY "Admins can modify lemmas"
  ON lemmas
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );
```

**words, sentences, chapters (public read):**

```sql
CREATE POLICY "Authenticated users can read content"
  ON words
  FOR SELECT
  TO authenticated
  USING (true);
```

---

### Admin Roles

**user_roles table:**

```sql
CREATE TABLE user_roles (
  user_id UUID REFERENCES auth.users(id) PRIMARY KEY,
  role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'user')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- Users can read their own role
CREATE POLICY "Users can read own role"
  ON user_roles
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Only admins can modify roles
CREATE POLICY "Admins can manage roles"
  ON user_roles
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );
```

---

### Admin Check Function

```sql
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;
```

**Usage in frontend:**

```javascript
async function isUserAdmin() {
  const { data, error } = await supabase.rpc('is_admin');
  return data === true;
}
```

---

### Client-Side Route Protection (Updated Dec 30, 2025)

**Note:** The actual implementation uses `user_settings.is_admin` column rather than a separate `user_roles` table.

**Route Protection Components:**

| Component | Location | Purpose |
|-----------|----------|---------|
| `ProtectedRoute` | `src/components/ProtectedRoute.jsx` | Requires authentication (any logged-in user) |
| `AdminRoute` | `src/components/AdminRoute.jsx` | Requires authentication + `is_admin = true` |

**ProtectedRoute:**
```jsx
// Checks useAuth() for logged-in user
// Redirects to /login if not authenticated
<ProtectedRoute>
  <Dashboard />
</ProtectedRoute>
```

**AdminRoute:**
```jsx
// Checks useAuth() + queries user_settings.is_admin
// Redirects to /login if not authenticated
// Redirects to /dashboard if not admin
<AdminRoute>
  <AdminLayout />
</AdminRoute>
```

**Implementation Flow (AdminRoute):**
1. Wait for auth context to load
2. Query `user_settings.is_admin` for current user
3. Show loading spinner while checking
4. Redirect based on auth/admin status
5. Render children if authorized

**Important:** Client-side route protection is for UX only. Database RLS policies are the true security layer.

---

## DATA PROTECTION

### Personal Data

**What we store:**
- Email address (required for auth)
- User ID (UUID, not personally identifiable)
- Learning progress (linked to user ID)
- Review history (anonymized)

**What we DON'T store:**
- Names (optional in future)
- Addresses
- Payment info (handled by Stripe in future)
- Social security numbers
- Any sensitive personal info

---

### Data Encryption

**At Rest:**
- Supabase encrypts all data at rest (AES-256)
- Database backups encrypted
- Automatic encryption (no config needed)

**In Transit:**
- HTTPS only (TLS 1.2+)
- Enforced by Netlify and Supabase
- No plain HTTP allowed

**Client-Side:**
- Passwords never stored (only hashed on server)
- Session tokens in localStorage (encrypted by browser)

---

### GDPR Compliance

**User Rights:**
- Right to access data
- Right to delete data
- Right to export data
- Right to be forgotten

**Implementation (post-MVP):**

```javascript
// Export user data
async function exportUserData(userId) {
  const { data: progress } = await supabase
    .from('user_lemma_progress')
    .select('*')
    .eq('user_id', userId);
  
  const { data: encounters } = await supabase
    .from('user_word_encounters')
    .select('*')
    .eq('user_id', userId);
  
  return {
    user_id: userId,
    progress,
    encounters,
    exported_at: new Date().toISOString()
  };
}

// Delete user account (anonymize data)
async function deleteUserAccount(userId) {
  // 1. Anonymize progress (keep for analytics)
  await supabase
    .from('user_lemma_progress')
    .update({ user_id: 'DELETED_USER' })
    .eq('user_id', userId);
  
  // 2. Delete auth account
  await supabase.auth.admin.deleteUser(userId);
}
```

---

## API SECURITY

### Rate Limiting

**Supabase built-in rate limits:**
- Auth endpoints: 30 requests/hour per IP
- Database queries: 100 requests/second per user

**Custom rate limiting (future):**
```javascript
// Example: Limit flashcard updates
const rateLimiter = new Map();

function checkRateLimit(userId, limit = 100, window = 60000) {
  const now = Date.now();
  const userRequests = rateLimiter.get(userId) || [];
  
  // Remove old requests outside window
  const recentRequests = userRequests.filter(
    timestamp => now - timestamp < window
  );
  
  if (recentRequests.length >= limit) {
    throw new Error('Rate limit exceeded');
  }
  
  recentRequests.push(now);
  rateLimiter.set(userId, recentRequests);
}
```

---

### Input Validation

**Always validate user input:**

```javascript
// ❌ Bad - no validation
async function updateProgress(lemmaId, masteryLevel) {
  await supabase
    .from('user_lemma_progress')
    .update({ mastery_level: masteryLevel })
    .eq('lemma_id', lemmaId);
}

// ✅ Good - validate first
async function updateProgress(lemmaId, masteryLevel) {
  // Validate UUID
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(lemmaId)) {
    throw new Error('Invalid lemma ID');
  }
  
  // Validate mastery level
  if (typeof masteryLevel !== 'number' || masteryLevel < 0 || masteryLevel > 100) {
    throw new Error('Invalid mastery level');
  }
  
  await supabase
    .from('user_lemma_progress')
    .update({ mastery_level: masteryLevel })
    .eq('lemma_id', lemmaId);
}
```

---

### SQL Injection Prevention

**Supabase client prevents SQL injection automatically:**

```javascript
// ✅ Safe - parameterized query
const { data } = await supabase
  .from('lemmas')
  .select('*')
  .eq('lemma_text', userInput); // Automatically escaped

// ❌ NEVER do raw SQL with user input
// (Not even possible with Supabase client, but avoid if using pg directly)
```

---

## FRONTEND SECURITY

### XSS Prevention

**React prevents XSS by default:**

```jsx
// ✅ Safe - React escapes by default
function WordDisplay({ word }) {
  return <div>{word.lemma}</div>;
}

// ❌ Dangerous - using dangerouslySetInnerHTML
function WordDisplay({ word }) {
  return <div dangerouslySetInnerHTML={{ __html: word.lemma }} />;
}
```

**Only use `dangerouslySetInnerHTML` when:**
- Content is from trusted source (your database)
- Content is sanitized first

```javascript
import DOMPurify from 'dompurify';

function SafeHTML({ html }) {
  const clean = DOMPurify.sanitize(html);
  return <div dangerouslySetInnerHTML={{ __html: clean }} />;
}
```

---

### CSRF Protection

**Supabase handles CSRF automatically:**
- JWT tokens in Authorization header
- Not vulnerable to CSRF (no cookies)

**For future API endpoints:**
- Use SameSite cookies
- CSRF tokens for state-changing operations

---

### Secure Headers

**Netlify configuration:**

```toml
# netlify.toml
[[headers]]
  for = "/*"
  [headers.values]
    # Prevent clickjacking
    X-Frame-Options = "DENY"
    
    # Prevent MIME sniffing
    X-Content-Type-Options = "nosniff"
    
    # Enable XSS filter
    X-XSS-Protection = "1; mode=block"
    
    # Control referrer
    Referrer-Policy = "strict-origin-when-cross-origin"
    
    # Content Security Policy
    Content-Security-Policy = """
      default-src 'self';
      script-src 'self' 'unsafe-inline' 'unsafe-eval';
      style-src 'self' 'unsafe-inline';
      img-src 'self' data: https:;
      font-src 'self' data:;
      connect-src 'self' https://*.supabase.co;
    """
```

---

### Sensitive Data in Code

**Never commit secrets:**

```bash
# .gitignore
.env
.env.local
.env.production
```

**Environment variables only:**

```javascript
// ❌ Bad - hardcoded
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';

// ✅ Good - environment variable
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
```

**Public anon key is safe:**
- Supabase anon key is public (intentionally)
- RLS policies enforce data access
- Service role key is NEVER exposed to frontend

---

### Logging Sensitive Data

**Never log:**
- Passwords
- API keys
- Session tokens
- Email addresses (in production)

```javascript
// ❌ Bad - logs password
console.log('User signed in:', { email, password });

// ✅ Good - omit sensitive data
console.log('User signed in:', { email: email.substring(0, 3) + '***' });

// ✅ Better - only in development
if (import.meta.env.DEV) {
  console.log('Debug:', { email });
}
```

---

## SECURITY CHECKLIST

### Before Launch

**Authentication:**
- [ ] Email verification required
- [ ] Strong password requirements
- [ ] Password reset works
- [ ] Sessions expire appropriately
- [ ] Sign out works everywhere

**Authorization:**
- [ ] RLS policies on all user tables
- [ ] Users can only access own data
- [ ] Admin role checked for admin actions
- [ ] No data leakage in API responses

**Data Protection:**
- [ ] HTTPS enforced
- [ ] Sensitive data never logged
- [ ] No secrets in code
- [ ] Environment variables properly set

**Frontend:**
- [ ] XSS protection (React default)
- [ ] No `dangerouslySetInnerHTML` (or sanitized)
- [ ] Secure headers configured
- [ ] Input validation on all forms

**API:**
- [ ] Rate limiting enabled
- [ ] Input validation on all endpoints
- [ ] Error messages don't leak info
- [ ] SQL injection prevented (Supabase)

---

### Ongoing Security

**Monthly:**
- [ ] Review access logs (Supabase)
- [ ] Update dependencies (`npm audit`)
- [ ] Check for security advisories

**After incidents:**
- [ ] Review what happened
- [ ] Fix vulnerability
- [ ] Notify affected users (if data breach)
- [ ] Update procedures

---

## INCIDENT RESPONSE

### Security Incident Levels

**Level 1 (Minor):**
- Single account compromised
- No data leaked
- Response: Reset password, notify user

**Level 2 (Moderate):**
- Multiple accounts compromised
- Limited data leaked
- Response: Force password resets, investigate

**Level 3 (Severe):**
- Database breach
- Widespread data leaked
- Response: Take site offline, full investigation, notify all users

---

### Response Procedure

**1. Identify:**
- What happened?
- When did it happen?
- How many users affected?

**2. Contain:**
- Stop the attack
- Revoke compromised credentials
- Patch vulnerability

**3. Investigate:**
- How did it happen?
- What data was accessed?
- Are there other vulnerabilities?

**4. Notify:**
- Affected users
- Authorities (if required by law)
- Public disclosure (if warranted)

**5. Prevent:**
- Fix root cause
- Update procedures
- Add monitoring

---

## SECURITY RESOURCES

### Tools

- **npm audit** - Check dependencies for vulnerabilities
- **Snyk** - Continuous security monitoring
- **OWASP ZAP** - Security scanner
- **Observatory by Mozilla** - Check headers

### Learning

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Supabase Security Docs](https://supabase.com/docs/guides/security)
- [Web Security Academy](https://portswigger.net/web-security)

---

## RELATED DOCUMENTS

- See **15_API_DOCUMENTATION.md** for RLS policies
- See **13_DEPLOYMENT.md** for secure deployment
- See **20_ERROR_HANDLING.md** for error handling

---

## REVISION HISTORY

- 2025-11-30: Initial draft (Claude)
- 2025-12-30: Added Client-Side Route Protection section (ProtectedRoute, AdminRoute)
- Status: Active

---

**END OF SECURITY**
