# Quick Testing Guide - n8n Webhook Alternative

## Problem
You're seeing "email notification failed" because n8n is not set up yet.

## Solution Options

### Option 1: Use Webhook.site (RECOMMENDED for Quick Testing)

1. **Visit**: https://webhook.site
2. You'll see a **unique URL** like: `https://webhook.site/12ab34cd-56ef-78gh-90ij-klmnopqrstuv`
3. **Copy that URL**
4. **Update your `.env` file**:
   ```env
   N8N_WEBHOOK_URL=https://webhook.site/12ab34cd-56ef-78gh-90ij-klmnopqrstuv
   ```
5. **Wait 5 seconds** for server to auto-restart
6. **Create a new employee** in the UI
7. **Go back to webhook.site** - you'll see the webhook request with the user data!

**What you'll see on webhook.site**:
```json
{
  "name": "Employee Name",
  "email": "email@example.com",
  "role": "employee",
  "temporaryPassword": "abc123XYZ$%^"
}
```

This proves the integration works! The password is there, ready to be sent via email once you set up n8n.

---

### Option 2: Use RequestBin (Alternative)

1. Visit: https://pipedream.com/requestbin
2. Click "Create a Request Bin"
3. Copy the URL
4. Update `.env` with that URL
5. Test the same way

---

### Option 3: Skip Webhook Temporarily (Development Only)

If you just want to test user creation without ANY webhook:

**Update `routes/admin.js`** - Comment out the n8n check:

```javascript
// Temporarily disable n8n requirement for testing
/*
if (!n8nWebhookUrl) {
    console.error('N8N_WEBHOOK_URL is not configured');
    return res.status(500).json({
        success: false,
        message: 'Email notification service is not configured.'
    });
}
*/
```

Then users will be created successfully without trying to send webhooks.

**⚠️ WARNING**: Remember to uncomment this before production!

---

## For Production: Set Up Real n8n

### Quick n8n Setup (5 minutes)

1. **Install n8n locally** (if you don't have it):
   ```bash
   npx n8n
   ```
   This will start n8n on http://localhost:5678

2. **Create Account** and login

3. **Create New Workflow**:
   - Click "Add workflow"
   - Name it "GenLab User Creation"

4. **Add Webhook Node**:
   - Click "+" to add node
   - Search "Webhook"
   - Click on "Webhook" node
   - Settings:
     - HTTP Method: `POST`
     - Path: `create-user`
     - Respond: `Immediately`
   - Click "Execute Node" to see the webhook URL

5. **Add Email Node**:
   - Click "+" after Webhook node
   - Search "Gmail" or "Send Email" or "SMTP"
   - Configure your email service
   - Email template:
     ```
     To: {{$json.email}}
     Subject: Welcome to GenLab
     
     Hi {{$json.name}},
     
     Your account has been created!
     
     Email: {{$json.email}}
     Role: {{$json.role}}
     Temporary Password: {{$json.temporaryPassword}}
     
     Login at: http://localhost:3000/login
     
     Please change your password after first login.
     ```

6. **Activate Workflow**: Toggle "Inactive" to "Active"

7. **Copy Production Webhook URL**: 
   - Click on Webhook node
   - Copy the "Production URL"
   - It looks like: `http://localhost:5678/webhook/abc123/create-user`

8. **Update `.env`**:
   ```env
   N8N_WEBHOOK_URL=http://localhost:5678/webhook/abc123/create-user
   ```

9. **Done!** Now create a user and check if email is sent.

---

## Current Status Check

Run this to verify the latest user was created:

```bash
node check_users.js
```

Even if email fails, the user should still be in the database!

---

## Recommended Next Steps

1. **Right now**: Use webhook.site to verify the integration works
2. **Within 1 hour**: Set up local n8n to test real email delivery
3. **Before production**: Set up production n8n instance with proper domain

---

## Common Issues

**"Email notification failed"** = This is NORMAL if:
- n8n webhook URL is not set
- n8n is not running
- n8n workflow is not activated
- Network/firewall blocking the request

**User still created successfully** = This is CORRECT behavior!
- Your system is working as designed
- Just needs email configuration

---

**Need Help?** 
Check `COMPLIANCE_CHECKLIST.md` for detailed n8n setup instructions.
