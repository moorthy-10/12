# ⚠️ Critical Production Fixes Required

**Date:** 2026-02-04  
**Priority:** HIGH  
**Status:** Must fix before production deployment

---

## 🔴 **CRITICAL (Must Fix)**

### 1. Change JWT Secret
**File:** `.env`  
**Current:** `JWT_SECRET=your_jwt_secret_key_change_in_production_2024`  
**Action Required:**
```bash
# Generate a secure random secret (32+ characters)
# Example methods:
# 1. Using Node.js:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# 2. Using OpenSSL:
openssl rand -hex 32

# Then update .env with the generated value
JWT_SECRET=<your_generated_secure_secret_here>
```

**Why:** The current JWT secret is a placeholder and is publicly visible in the codebase. This is a critical security vulnerability.

---

## 🟡 **HIGH PRIORITY (Should Fix)**

### 2. Remove Sensitive Logging
**Files:** 
- `routes/admin.js` (Lines 74, 78, 91, 126, 145)
- `routes/users.js` (Lines 96, 100, 113, 136, 151)

**Current Code:**
```javascript
console.log(`🔐 Generated temporary password for user: ${email}`);
```

**Action Required:**
Either remove these logs or ensure they don't expose sensitive data:

```javascript
// Option 1: Remove in production
if (process.env.NODE_ENV === 'development') {
    console.log(`🔐 Generated temporary password for user: ${email}`);
}

// Option 2: Use a proper logging library
logger.debug(`User creation initiated for: ${email}`);
// Don't log the actual password
```

**Why:** Logging passwords (even temporary ones) is a security risk. Logs can be exposed through various means.

---

### 3. Add Environment Variable Validation
**File:** `server.js`  
**Current:** No validation  
**Action Required:**

Add validation at the top of `server.js`:

```javascript
require('dotenv').config();

// Validate required environment variables
const requiredEnvVars = ['JWT_SECRET', 'PORT'];
const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingEnvVars.length > 0) {
    console.error('❌ Missing required environment variables:');
    missingEnvVars.forEach(varName => console.error(`   - ${varName}`));
    console.error('\n⚠️ Please check your .env file');
    process.exit(1);
}

// Warn if JWT_SECRET looks like a placeholder
if (process.env.JWT_SECRET.includes('change_in_production')) {
    console.warn('⚠️ WARNING: JWT_SECRET appears to be a placeholder!');
    console.warn('   Please generate a secure random secret for production.');
    if (process.env.NODE_ENV === 'production') {
        console.error('❌ Cannot start in production with placeholder JWT_SECRET');
        process.exit(1);
    }
}
```

**Why:** Prevents the application from starting with missing or insecure configuration.

---

## 🟢 **MEDIUM PRIORITY (Recommended)**

### 4. Add Rate Limiting on Login
**File:** `routes/auth.js`  
**Current:** No rate limiting  
**Action Required:**

Install and configure rate limiting:

```bash
npm install express-rate-limit
```

Then in `routes/auth.js`:

```javascript
const rateLimit = require('express-rate-limit');

// Create a limiter for login attempts
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 requests per windowMs
    message: {
        success: false,
        message: 'Too many login attempts. Please try again in 15 minutes.'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// Apply to login route
router.post('/login', loginLimiter, [
    // ... existing validators
], (req, res) => {
    // ... existing code
});
```

**Why:** Prevents brute force attacks on the login endpoint.

---

### 5. Configure CORS for Production
**File:** `server.js`  
**Current:** `app.use(cors());` (allows all origins)  
**Action Required:**

Add environment-specific CORS configuration:

```javascript
// CORS configuration
const corsOptions = {
    origin: process.env.NODE_ENV === 'production' 
        ? process.env.FRONTEND_URL || 'https://yourdomain.com'
        : '*',
    credentials: true,
    optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
```

And add to `.env`:
```env
FRONTEND_URL=https://yourdomain.com
```

**Why:** In production, you should only allow requests from your actual frontend domain.

---

## ✅ **OPTIONAL ENHANCEMENTS**

### 6. Add Database Backup Script
Create `scripts/backup-db.js`:

```javascript
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'database.sqlite');
const backupPath = path.join(__dirname, '..', 'backups', `database_${new Date().toISOString().replace(/:/g, '-')}.sqlite`);

// Create backups directory if it doesn't exist
const backupDir = path.join(__dirname, '..', 'backups');
if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir);
}

// Copy database file
fs.copyFileSync(dbPath, backupPath);
console.log(`✅ Database backed up to: ${backupPath}`);
```

Add to `.gitignore`:
```
backups/
```

**Why:** Regular backups are essential for production systems.

---

### 7. Add Health Check Endpoint Enhancement
**File:** `server.js`  
**Current:** Basic health check  
**Action Required:**

Enhance the health check to include database connectivity:

```javascript
app.get('/api/health', async (req, res) => {
    try {
        // Check database connection
        await new Promise((resolve, reject) => {
            db.get('SELECT 1', (err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        res.json({ 
            status: 'ok', 
            message: 'GenLab API is running',
            database: 'connected',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(503).json({ 
            status: 'error', 
            message: 'Database connection failed',
            timestamp: new Date().toISOString()
        });
    }
});
```

**Why:** Better monitoring and debugging in production.

---

## 📋 **Pre-Deployment Checklist**

Before deploying to production, verify:

- [ ] ✅ JWT_SECRET changed to a secure random value
- [ ] ✅ Sensitive logging removed or protected
- [ ] ✅ Environment variable validation added
- [ ] ✅ Rate limiting configured on login endpoint
- [ ] ✅ CORS configured for production domain
- [ ] ✅ NODE_ENV=production in production environment
- [ ] ✅ N8N_WEBHOOK_URL configured with production URL
- [ ] ✅ Database backup strategy in place
- [ ] ✅ HTTPS enabled on production server
- [ ] ✅ Error tracking/monitoring configured
- [ ] ✅ All documentation updated
- [ ] ✅ Admin credentials changed from defaults
- [ ] ✅ Test email flow end-to-end

---

## 🚀 **Timeline Recommendation**

### Before Production (Required):
1. **Critical fixes** (Items 1-3): **2-4 hours**
2. **High priority** (Items 4-5): **2-3 hours**
3. **Testing and verification**: **2-3 hours**

**Total estimated time:** 6-10 hours

### After Production (Nice to have):
- Optional enhancements (Items 6-7): **2-4 hours**
- Automated testing setup: **1-2 days**
- Monitoring and alerting: **1 day**

---

## 📞 **Support**

If you need any clarification or assistance with these fixes:

1. Review the full `CODE_REVIEW_REPORT.md` for detailed explanations
2. Check the security audit: `SECURITY_AUDIT_REPORT.md`
3. Reference the webhook testing guide: `WEBHOOK_TESTING_GUIDE.md`

---

**Last Updated:** 2026-02-04  
**Status:** Review and implement before production deployment
