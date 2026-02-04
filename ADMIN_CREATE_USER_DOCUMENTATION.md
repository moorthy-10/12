# Admin Create User with n8n Integration - Implementation Documentation

## Overview
This document describes the secure admin-only feature for creating new users and automatically sending their credentials via a self-hosted n8n workflow.

## Implementation Summary

### 1. **New API Endpoint**
**Route:** `POST /api/admin/create-user`

**Location:** `routes/admin.js`

**Security:**
- ✅ Protected by `authenticateToken` middleware
- ✅ Restricted to admin users only via `isAdmin` middleware
- ✅ Never exposes n8n webhook URL to frontend
- ✅ Never logs or returns plain passwords

### 2. **Request Body**
```json
{
  "name": "John Doe",
  "email": "john.doe@example.com"
}
```

**Validation:**
- `name`: Required, non-empty string
- `email`: Required, valid email format

### 3. **Workflow**

1. **Validate Request**
   - Checks for required fields
   - Validates email format

2. **Check Configuration**
   - Verifies `N8N_WEBHOOK_URL` is set in environment variables
   - Returns error if not configured

3. **Check for Duplicate Email**
   - Queries database to ensure email doesn't already exist
   - Returns 400 error if user exists

4. **Generate Secure Password**
   - Creates a 12-character password using `crypto.randomInt()`
   - Includes: uppercase, lowercase, numbers, and special characters
   - Password is shuffled for added randomness

5. **Hash Password**
   - Uses `bcrypt.hash()` with salt rounds of 10
   - Plain password is NEVER stored in database

6. **Create User**
   - Saves user with:
     - `role`: "employee" (hardcoded)
     - `status`: "active"
     - `forcePasswordChange`: 1 (true)
     - Hashed password

7. **Trigger n8n Webhook**
   - Sends POST request to configured n8n webhook
   - Payload: `{ name, email, password }`
   - 5-second timeout
   - If webhook fails, user is still created but warning is returned

8. **Return Response**
   - Success: Returns user data (WITHOUT password)
   - Error: Returns appropriate error message

### 4. **Database Changes**

**New Column Added:**
```sql
ALTER TABLE users ADD COLUMN forcePasswordChange INTEGER DEFAULT 0
```

**Migration Script:** `migrate_add_force_password_change.js`

Run once with:
```bash
node migrate_add_force_password_change.js
```

### 5. **Environment Variables**

**Added to `.env`:**
```env
N8N_WEBHOOK_URL=https://your-n8n-instance.com/webhook/create-user
```

⚠️ **Important:** Replace with your actual n8n webhook URL

### 6. **Dependencies**

**New Package Installed:**
```bash
npm install axios
```

**Used in Implementation:**
- `axios` - HTTP client for n8n webhook
- `bcryptjs` - Password hashing
- `crypto` - Secure random password generation (Node.js built-in)
- `express-validator` - Request validation

## Security Features

### ✅ Password Security
- Secure random generation using `crypto.randomInt()`
- Minimum 12 characters with mixed character types
- Hashed with bcrypt (10 salt rounds)
- NEVER logged or returned in responses
- Only sent to n8n webhook once

### ✅ Access Control
- Endpoint protected by JWT authentication
- Restricted to admin role only
- Frontend cannot access n8n webhook directly

### ✅ Data Validation
- Email format validation
- Duplicate email prevention
- Input sanitization via express-validator

### ✅ Error Handling
- Graceful webhook failure handling
- User creation succeeds even if email fails
- Detailed error messages for debugging (dev mode only)
- Generic error messages in production

## API Usage Examples

### Success Response
```json
{
  "success": true,
  "message": "User created successfully and credentials have been sent via email",
  "user": {
    "id": 5,
    "name": "John Doe",
    "email": "john.doe@example.com",
    "role": "employee",
    "status": "active",
    "created_at": "2026-02-03 17:30:00"
  }
}
```

### Webhook Failure Response
```json
{
  "success": true,
  "message": "User created successfully, but email notification failed. Please send credentials manually.",
  "user": { ... },
  "warning": "Email notification service unavailable"
}
```

### Error Responses

**Validation Error (400):**
```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    {
      "msg": "Valid email is required",
      "param": "email"
    }
  ]
}
```

**Duplicate Email (400):**
```json
{
  "success": false,
  "message": "A user with this email already exists"
}
```

**Unauthorized (401):**
```json
{
  "success": false,
  "message": "Access denied. No token provided."
}
```

**Forbidden (403):**
```json
{
  "success": false,
  "message": "Access denied. Admin privileges required."
}
```

**Configuration Error (500):**
```json
{
  "success": false,
  "message": "Email notification service is not configured. Please contact system administrator."
}
```

## n8n Webhook Setup

### Expected Webhook Payload
```json
{
  "name": "John Doe",
  "email": "john.doe@example.com",
  "password": "aB3$xY9zK2mP"
}
```

### n8n Workflow Setup Steps

1. **Create Webhook Node**
   - Method: POST
   - Path: `/webhook/create-user`
   - Authentication: None (or add if needed)

2. **Process the Data**
   - Extract name, email, password from webhook body

3. **Send Email (Gmail/SMTP)**
   - To: `{{$json.email}}`
   - Subject: "Welcome to GenLab - Your Account Credentials"
   - Body Template:
     ```
     Hello {{$json.name}},

     Your GenLab account has been created successfully.

     Login Credentials:
     Email: {{$json.email}}
     Temporary Password: {{$json.password}}

     Please login and change your password immediately.

     Login URL: https://your-genlab-app.com/login

     Best regards,
     GenLab Team
     ```

4. **Save Webhook URL**
   - Copy the production webhook URL
   - Update `.env` file with `N8N_WEBHOOK_URL`

## Testing

### 1. Test User Creation
```bash
curl -X POST http://localhost:5000/api/admin/create-user \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_JWT_TOKEN" \
  -d '{
    "name": "Test User",
    "email": "test@example.com"
  }'
```

### 2. Verify Database
```bash
# Check if user was created with forcePasswordChange flag
sqlite3 database.sqlite "SELECT id, name, email, role, forcePasswordChange FROM users WHERE email='test@example.com';"
```

### 3. Check n8n Logs
- Verify webhook execution in n8n dashboard
- Confirm email was sent

## Frontend Integration

The frontend already has the "Create User" button. It should make this API call:

```javascript
const createUser = async (name, email) => {
  try {
    const response = await axios.post(
      '/api/admin/create-user',
      { name, email },
      {
        headers: {
          'Authorization': `Bearer ${adminToken}`
        }
      }
    );
    
    if (response.data.success) {
      alert('User created successfully! Credentials sent via email.');
    }
  } catch (error) {
    alert(error.response?.data?.message || 'Failed to create user');
  }
};
```

## Production Checklist

- [ ] Set production `N8N_WEBHOOK_URL` in `.env`
- [ ] Verify n8n workflow is active
- [ ] Test email delivery with real email
- [ ] Ensure JWT_SECRET is changed from default
- [ ] Run migration script on production database
- [ ] Test with admin account
- [ ] Verify forcePasswordChange flow on first login
- [ ] Check logs for any errors
- [ ] Set up monitoring for webhook failures

## File Changes Summary

### New Files
1. `routes/admin.js` - Admin routes with create-user endpoint
2. `migrate_add_force_password_change.js` - Database migration script

### Modified Files
1. `server.js` - Added admin routes registration
2. `.env` - Added N8N_WEBHOOK_URL configuration
3. `package.json` - Updated with axios dependency

### Database Changes
1. Added `forcePasswordChange` column to users table

## Notes

- The plain password is **ONLY** sent to n8n webhook and **NEVER** logged or stored
- The webhook URL is **NEVER** exposed to the frontend
- User creation succeeds even if webhook/email fails (with warning)
- Password generation uses cryptographically secure random values
- All passwords are hashed with bcrypt before storage
- The `forcePasswordChange` flag ensures users must change password on first login

## Support

For issues or questions:
1. Check n8n webhook logs for email delivery issues
2. Verify environment variables are set correctly
3. Check backend logs for detailed error messages
4. Ensure admin user has correct role in database
