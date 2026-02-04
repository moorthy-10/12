# Admin Create User Feature - Complete Implementation

## 🎯 Overview

A secure, production-ready admin-only feature for creating new employee users and automatically sending their credentials via self-hosted n8n workflow integration.

**Endpoint**: `POST /api/admin/create-user`

---

## ✨ Features

✅ **Secure Password Generation** - Cryptographically secure 12-character passwords  
✅ **Bcrypt Hashing** - Industry-standard password hashing with 10 salt rounds  
✅ **Admin-Only Access** - Protected by JWT authentication and admin role check  
✅ **n8n Integration** - Automatic email delivery via self-hosted workflow  
✅ **Graceful Error Handling** - User creation succeeds even if email fails  
✅ **Zero Password Exposure** - Passwords never logged or returned to frontend  
✅ **Force Password Change** - New users must change password on first login  

---

## 🚀 Quick Start

### 1. Prerequisites (Already Done ✅)
- [x] Axios installed
- [x] Database migrated (forcePasswordChange column added)
- [x] Admin routes registered in server.js
- [x] Environment variable placeholder added

### 2. Configure n8n Webhook (YOU NEED TO DO THIS)

1. Login to your n8n instance
2. Create new workflow
3. Add **Webhook node**:
   - Method: `POST`
   - Path: `/webhook/create-user`
4. Add **Gmail/SMTP node**:
   - Use template from `ADMIN_CREATE_USER_QUICKSTART.md`
5. Activate workflow
6. Copy webhook URL

### 3. Update Environment Variable

Edit `.env`:
```env
N8N_WEBHOOK_URL=https://your-n8n-instance.com/webhook/create-user
```

### 4. Restart Server

```bash
npm run dev
```

### 5. Test the Endpoint

```bash
curl -X POST http://localhost:5000/api/admin/create-user \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{"name":"Test User","email":"test@example.com"}'
```

✅ **Expected**: User created, email sent!

---

## 📚 Documentation

| Document | Purpose |
|----------|---------|
| `IMPLEMENTATION_SUMMARY.md` | Complete overview of all changes |
| `ADMIN_CREATE_USER_DOCUMENTATION.md` | Full API documentation and setup guide |
| `ADMIN_CREATE_USER_QUICKSTART.md` | Quick 3-step setup guide |
| `FRONTEND_INTEGRATION_EXAMPLES.js` | React code examples for frontend |
| `PRE_PRODUCTION_CHECKLIST.md` | Testing and deployment checklist |

---

## 🔐 Security

### What Makes This Secure?

1. **Password Generation**: Uses Node.js `crypto.randomInt()` for cryptographic randomness
2. **Hashing**: Bcrypt with 10 salt rounds (never storing plain passwords)
3. **Access Control**: Admin JWT authentication required
4. **Environment Variables**: Webhook URL never exposed to frontend
5. **Input Validation**: Email format and duplicate checking
6. **Error Isolation**: Detailed errors only in development mode

### Security Best Practices Followed

✅ Never log passwords  
✅ Never return passwords in API responses  
✅ Never expose internal URLs to frontend  
✅ Never store passwords in plain text  
✅ Always hash before database storage  
✅ Always validate and sanitize input  
✅ Always use parameterized SQL queries  

---

## 🎨 Frontend Integration

Your frontend already has the "Create User" button. Just connect it:

```javascript
const createUser = async (name, email) => {
  const token = localStorage.getItem('token');
  
  const response = await axios.post(
    '/api/admin/create-user',
    { name, email },
    { headers: { 'Authorization': `Bearer ${token}` } }
  );
  
  if (response.data.success) {
    alert('User created! Credentials sent via email.');
  }
};
```

See `FRONTEND_INTEGRATION_EXAMPLES.js` for more examples.

---

## 📖 API Reference

### Request

**Endpoint**: `POST /api/admin/create-user`  
**Auth**: Required (Admin JWT token)

**Headers**:
```
Authorization: Bearer <admin-jwt-token>
Content-Type: application/json
```

**Body**:
```json
{
  "name": "John Doe",
  "email": "john@example.com"
}
```

### Response

**Success (201)**:
```json
{
  "success": true,
  "message": "User created successfully and credentials have been sent via email",
  "user": {
    "id": 5,
    "name": "John Doe",
    "email": "john@example.com",
    "role": "employee",
    "status": "active",
    "created_at": "2026-02-03 17:30:00"
  }
}
```

**Errors**:
- `400`: Validation error or duplicate email
- `401`: No authentication token
- `403`: Not an admin user
- `500`: Server error or n8n not configured

---

## 🔄 Complete Workflow

```
1. Admin clicks "Create User" button
         ↓
2. Frontend shows form for name & email
         ↓
3. Frontend sends POST /api/admin/create-user
         ↓
4. Backend validates admin token & role
         ↓
5. Backend checks for duplicate email
         ↓
6. Backend generates secure 12-char password
         ↓
7. Backend hashes password with bcrypt
         ↓
8. Backend saves user to database
   (role=employee, forcePasswordChange=true)
         ↓
9. Backend triggers n8n webhook via Axios
   Payload: { name, email, password }
         ↓
10. n8n workflow sends email with credentials
         ↓
11. Backend returns success to frontend
         ↓
12. User receives email with login credentials
         ↓
13. User logs in and is forced to change password
```

---

## 🧪 Testing

### Manual Testing

```bash
# 1. Create a test user
curl -X POST http://localhost:5000/api/admin/create-user \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{"name":"Test User","email":"test@genlab.com"}'

# 2. Check database
sqlite3 database.sqlite "SELECT * FROM users WHERE email='test@genlab.com';"

# 3. Verify n8n execution in n8n dashboard

# 4. Check email inbox for credentials
```

### What to Verify

- [ ] User created in database
- [ ] Password is hashed (not plain text)
- [ ] forcePasswordChange = 1
- [ ] role = 'employee'
- [ ] status = 'active'
- [ ] n8n webhook executed
- [ ] Email received with credentials

---

## 📦 Files Created

```
routes/
  └── admin.js                              # Admin routes with create-user endpoint

migrate_add_force_password_change.js        # Database migration (already run)

IMPLEMENTATION_SUMMARY.md                   # Complete implementation overview
ADMIN_CREATE_USER_DOCUMENTATION.md          # Full documentation
ADMIN_CREATE_USER_QUICKSTART.md             # Quick setup guide
FRONTEND_INTEGRATION_EXAMPLES.js            # Frontend code examples
PRE_PRODUCTION_CHECKLIST.md                 # Testing & deployment checklist
README_ADMIN_CREATE_USER.md                 # This file
```

---

## 📝 Files Modified

```
server.js        # Added admin routes registration
.env             # Added N8N_WEBHOOK_URL (needs your URL)
package.json     # Added axios dependency
database.sqlite  # Added forcePasswordChange column
```

---

## ⚙️ Configuration

### Environment Variables

| Variable | Required | Description | Default |
|----------|----------|-------------|---------|
| `N8N_WEBHOOK_URL` | **YES** | Your n8n webhook URL | Placeholder (update this!) |
| `JWT_SECRET` | **YES** | JWT signing secret | (change in production) |
| `PORT` | No | Server port | 5000 |
| `NODE_ENV` | No | Environment | development |

---

## 🚨 Known Limitations

1. **No Webhook Retry**: If n8n fails, no automatic retry
   - **Impact**: Admin gets warning, can retry manually
   
2. **No Rate Limiting**: Endpoint can be called rapidly
   - **Mitigation**: Consider adding rate limiting middleware

3. **No Webhook Auth**: n8n webhook publicly accessible (if URL known)
   - **Mitigation**: Backend validates admin before calling
   - **Recommendation**: Add n8n webhook authentication

---

## 🔍 Troubleshooting

### Problem: "Email notification service is not configured"
**Solution**: Set `N8N_WEBHOOK_URL` in `.env` file

### Problem: "User created but email notification failed"
**Check**:
- Is n8n workflow active?
- Is webhook URL correct?
- Check n8n execution logs
- Verify email SMTP settings in n8n

### Problem: "Access denied. Admin privileges required"
**Check**:
- Are you logged in as admin?
- Is JWT token valid?
- Does token include role claim?

---

## 📊 Next Steps

### Immediate
1. [ ] Configure n8n webhook  
2. [ ] Update N8N_WEBHOOK_URL in .env  
3. [ ] Test user creation  
4. [ ] Integrate with frontend  

### Before Production
5. [ ] Change JWT_SECRET  
6. [ ] Use HTTPS for n8n  
7. [ ] Test with real email  
8. [ ] Review security checklist  

### Post-Launch
9. [ ] Monitor email delivery  
10. [ ] Set up alerts for failures  
11. [ ] Collect metrics  
12. [ ] Consider webhook retry logic  

---

## 💡 Tips

- **Password Policy**: Current: 12 chars, mixed types. Customize in `generateSecurePassword()`
- **Email Template**: Customize in your n8n workflow
- **Force Change**: Implement frontend logic to detect `forcePasswordChange` flag
- **Monitoring**: Watch n8n execution logs for delivery issues
- **Rate Limiting**: Add express-rate-limit middleware for production

---

## ✅ Compliance

All requirements met:

- ✅ POST /api/admin/create-user endpoint created
- ✅ Admin-only access (authenticateToken + isAdmin)
- ✅ Accepts name and email from request body
- ✅ Generates secure temporary password
- ✅ Hashes password using bcrypt
- ✅ Saves user with role="employee" and forcePasswordChange=true
- ✅ Triggers n8n webhook using Axios
- ✅ Sends { name, email, password } to n8n
- ✅ N8N_WEBHOOK_URL read from environment variable
- ✅ Uses async/await throughout
- ✅ Axios configured with 5-second timeout
- ✅ Never logs or returns plain password
- ✅ Never exposes webhook URL to frontend
- ✅ Clean error handling with proper HTTP responses
- ✅ No frontend code modified
- ✅ No hardcoded secrets
- ✅ No plain password storage
- ✅ No changes to unrelated files

---

## 📞 Support

For detailed information, see:
- **Setup**: `ADMIN_CREATE_USER_QUICKSTART.md`
- **API Docs**: `ADMIN_CREATE_USER_DOCUMENTATION.md`
- **Frontend**: `FRONTEND_INTEGRATION_EXAMPLES.js`
- **Testing**: `PRE_PRODUCTION_CHECKLIST.md`

---

**Status**: ✅ Implementation Complete  
**Version**: 1.0.0  
**Date**: February 3, 2026  
**Next Action**: Configure n8n webhook URL  

---

Made with ❤️ for GenLab
