# n8n Webhook Integration - User Creation Email Notifications

## Overview
When an admin creates a new employee in GenLab, the backend automatically triggers a self-hosted n8n webhook to send login credentials via email. **User creation always succeeds, even if email sending fails.**

---

## Architecture

### Flow Diagram
```
Admin Creates User → Database Insert → n8n Webhook → Email Sent
                           ↓              ↓
                     ✅ Success     ✅ or ⚠️
                                    
If webhook fails: User still created, admin warned
```

### Key Features
✅ Secure temporary password generation (16 characters)  
✅ Password hashing before database storage  
✅ Non-blocking email notifications  
✅ Graceful failure handling  
✅ Detailed console logging  
✅ No frontend exposure of webhook URL  

---

## Backend Implementation

### Environment Variables
Add to `.env` file:
```env
N8N_WEBHOOK_URL=https://your-n8n-instance.railway.app/webhook/create-user
```

**Important:**
- Replace with your actual Railway production URL
- Never commit production URLs to version control
- Use different URLs for development/staging/production

### Route: POST `/api/users`

**Authentication:** Admin only (via `authenticateToken` + `isAdmin` middleware)

**Request Payload:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "role": "employee",
  "department": "Engineering",
  "position": "Software Developer",
  "phone": "+1234567890"
}
```

**Response - Success (Email Sent):**
```json
{
  "success": true,
  "message": "User created successfully and email notification sent",
  "user": {
    "id": 5,
    "name": "John Doe",
    "email": "john@example.com",
    "role": "employee",
    "department": "Engineering",
    "position": "Software Developer",
    "phone": "+1234567890",
    "status": "active"
  }
}
```

**Response - Success (Email Failed):**
```json
{
  "success": true,
  "message": "User created successfully but email notification failed",
  "warning": "Please notify the user manually",
  "user": { ... }
}
```

**Response - Failure (User Not Created):**
```json
{
  "success": false,
  "message": "Email already exists"
}
```

---

## n8n Webhook Configuration

### Webhook Endpoint
```
POST https://your-n8n-instance.railway.app/webhook/create-user
```

### Expected Payload from Backend
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "role": "employee",
  "temporaryPassword": "x7K9mP2qW5nL8vT1"
}
```

### n8n Workflow Requirements

1. **Webhook Trigger Node**
   - Method: POST
   - Path: `/webhook/create-user`
   - Authentication: None (backend trusted)

2. **Email Node (Gmail/SMTP)**
   - To: `{{ $json.email }}`
   - Subject: "Welcome to GenLab - Your Login Credentials"
   - Body Template:
     ```
     Hello {{ $json.name }},

     Welcome to GenLab! Your account has been created.

     Login Credentials:
     Email: {{ $json.email }}
     Temporary Password: {{ $json.temporaryPassword }}
     Role: {{ $json.role }}

     Please log in and change your password immediately.

     Login URL: https://genlab.yourdomain.com/login

     Best regards,
     GenLab Admin Team
     ```

3. **Error Handling**
   - Add error trigger node for debugging
   - Log failed deliveries for admin review

---

## Backend Logging

### Console Output Examples

**User Creation Success:**
```
🔐 Generated temporary password for user: john@example.com
🔒 Password hashed successfully
✅ User created successfully in database - ID: 5
📧 Triggering n8n webhook for email notification...
✅ n8n webhook triggered successfully - Email notification sent
```

**User Created, Email Failed:**
```
🔐 Generated temporary password for user: john@example.com
🔒 Password hashed successfully
✅ User created successfully in database - ID: 5
📧 Triggering n8n webhook for email notification...
⚠️ n8n webhook failed: timeout of 5000ms exceeded
   Response status: undefined
   Response data: undefined
```

**Webhook Not Configured:**
```
🔐 Generated temporary password for user: john@example.com
🔒 Password hashed successfully
✅ User created successfully in database - ID: 5
⚠️ N8N_WEBHOOK_URL not configured - skipping email notification
```

---

## Security Considerations

### ✅ Implemented Security Features
1. **No Plain Passwords**: All passwords are hashed with bcrypt before storage
2. **Secure Password Generation**: Uses `crypto.randomBytes()` for cryptographically secure passwords
3. **Environment Variables**: Webhook URL stored in `.env`, not hardcoded
4. **Admin-Only Access**: Endpoint protected by authentication middleware
5. **No Frontend Exposure**: Webhook URL never sent to client
6. **Timeout Protection**: 5-second timeout prevents hanging requests

### ⚠️ Additional Recommendations
- Use HTTPS for n8n webhook endpoint (Railway provides this)
- Consider adding webhook authentication (Bearer token)
- Implement rate limiting on user creation endpoint
- Monitor webhook failures and alert admins
- Rotate webhook URLs periodically

---

## Testing

### Local Testing with n8n
1. Start local n8n instance:
   ```bash
   docker run -it --rm --name n8n -p 5678:5678 n8nio/n8n
   ```

2. Update `.env`:
   ```env
   N8N_WEBHOOK_URL=http://localhost:5678/webhook/create-user
   ```

3. Create webhook workflow in n8n
4. Test user creation via admin panel

### Production Testing
1. Deploy n8n to Railway
2. Update `.env` with production URL
3. Restart backend server
4. Create test user and verify email delivery

---

## Troubleshooting

### Issue: Email not being sent

**Check:**
1. Is `N8N_WEBHOOK_URL` set in `.env`?
2. Is the n8n workflow activated?
3. Check backend console logs for webhook errors
4. Verify n8n execution logs
5. Test webhook URL directly with curl:
   ```bash
   curl -X POST https://your-n8n.railway.app/webhook/create-user \
     -H "Content-Type: application/json" \
     -d '{"name":"Test","email":"test@test.com","role":"employee","temporaryPassword":"test123"}'
   ```

### Issue: Users being created but webhook always fails

**Possible causes:**
- Invalid webhook URL in `.env`
- n8n instance not accessible from backend server
- Network firewall blocking outbound requests
- n8n workflow deactivated
- Timeout too short (increase from 5s if needed)

### Issue: Backend crashes on user creation

**Check:**
- Axios dependency installed: `npm list axios`
- Environment variables loaded: `console.log(process.env.N8N_WEBHOOK_URL)`
- Database schema supports all user fields

---

## Maintenance

### Monitoring Checklist
- [ ] Monitor webhook failure rate in logs
- [ ] Alert admins when email delivery fails
- [ ] Periodically test end-to-end flow
- [ ] Keep n8n workflow updated
- [ ] Review and rotate webhook URLs

### Scaling Considerations
- For high user creation volume, consider message queue (Redis/Bull)
- Implement retry logic for transient webhook failures
- Add webhook response caching to prevent duplicate emails
- Monitor n8n instance performance on Railway

---

## Environment Variable Reference

| Variable | Description | Example | Required |
|----------|-------------|---------|----------|
| `N8N_WEBHOOK_URL` | Full URL to n8n webhook endpoint | `https://n8n.railway.app/webhook/create-user` | Yes* |

*If not set, users are created but no emails are sent (with console warning).

---

## File Changes Summary

### Modified Files
- `routes/users.js` - Added webhook integration to user creation route
- `.env` - Added `N8N_WEBHOOK_URL` environment variable

### Dependencies Added
- `axios` - Already present in package.json
- `crypto` - Node.js built-in module

### No Changes Required
- Frontend code remains unchanged
- Database schema unchanged
- Authentication middleware unchanged

---

## Deployment Notes

### Railway Deployment
When deploying to Railway, ensure:
1. Environment variable `N8N_WEBHOOK_URL` is set in Railway dashboard
2. n8n instance is deployed and accessible
3. Backend restarts automatically pick up new environment variables

### Heroku Deployment
```bash
heroku config:set N8N_WEBHOOK_URL=https://your-n8n.railway.app/webhook/create-user
```

### Docker Deployment
Add to `docker-compose.yml`:
```yaml
environment:
  - N8N_WEBHOOK_URL=https://your-n8n.railway.app/webhook/create-user
```

---

## Support

For issues or questions:
1. Check backend console logs first
2. Verify n8n workflow execution history
3. Test webhook endpoint independently
4. Review this documentation

Last Updated: 2026-02-04
