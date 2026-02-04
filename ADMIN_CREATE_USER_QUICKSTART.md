# Quick Setup Guide - Admin Create User Feature

## Prerequisites
✅ Axios installed
✅ Database migrated
✅ Environment variable configured

## 3-Step Setup

### Step 1: Configure n8n Webhook
1. Open your n8n instance
2. Create a new workflow
3. Add a Webhook node:
   - Method: POST
   - Path: `/webhook/create-user`
4. Add a Gmail/SMTP node to send email
5. Activate the workflow
6. Copy the webhook URL

### Step 2: Update Environment Variable
Edit `.env` file:
```env
N8N_WEBHOOK_URL=https://your-n8n-instance.com/webhook/create-user
```

### Step 3: Restart Server
```bash
npm run dev
```

## Testing

### Quick Test Command
```bash
# Replace YOUR_ADMIN_TOKEN with actual admin JWT token
curl -X POST http://localhost:5000/api/admin/create-user \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{"name":"Test User","email":"test@example.com"}'
```

### Expected Result
✅ User created in database with role="employee" and forcePasswordChange=1
✅ n8n workflow triggered
✅ Email sent to user with credentials
✅ Frontend receives success response

## n8n Email Template

Subject: `Welcome to GenLab - Your Account Credentials`

Body:
```
Hello {{$json.name}},

Your GenLab account has been created successfully.

Login Credentials:
━━━━━━━━━━━━━━━━━━━━
Email: {{$json.email}}
Temporary Password: {{$json.password}}
━━━━━━━━━━━━━━━━━━━━

⚠️ IMPORTANT: Please login and change your password immediately.

Login URL: [YOUR_FRONTEND_URL]/login

Best regards,
GenLab Team
```

## Troubleshooting

### "Email notification service is not configured"
→ Check if `N8N_WEBHOOK_URL` is set in `.env`

### "User created but email notification failed"
→ Check n8n workflow is active
→ Check n8n logs for errors
→ Verify webhook URL is correct

### "Access denied. Admin privileges required."
→ Ensure you're logged in as admin user
→ Check JWT token is valid

## Security Reminders

⚠️ Never share the n8n webhook URL publicly
⚠️ Always use HTTPS for n8n webhook in production
⚠️ Change default JWT_SECRET before production
⚠️ Implement rate limiting on this endpoint in production
⚠️ Consider adding webhook authentication for extra security

## Next Steps

1. Implement "Force Password Change" flow on frontend login
2. Add password strength requirements
3. Set up email delivery monitoring
4. Consider adding retry mechanism for failed webhooks
