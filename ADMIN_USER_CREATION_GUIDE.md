# Quick Start: Admin User Creation with Email Notifications

## For Administrators

When you create a new employee through the admin panel, the system will:

1. ✅ Create the user in the database
2. 🔐 Generate a secure temporary password automatically
3. 📧 Send login credentials to the employee's email via n8n

**Important:** Even if email sending fails, the user will still be created successfully. You'll receive a warning message to notify the employee manually.

---

## How to Create a User

### Step 1: Navigate to Employees Page
1. Log in as admin
2. Click "Employees" in the sidebar
3. Click "Add Employee" button

### Step 2: Fill in Employee Details
Required fields:
- **Name**: Full name of the employee
- **Email**: Work email address (must be unique)
- **Role**: Admin or Employee
- **Department**: E.g., Engineering, HR, Sales
- **Position**: Job title
- **Phone**: Contact number

### Step 3: Submit
Click "Create User" - the system will:
- Generate a secure 16-character temporary password
- Save the user to the database
- Automatically send credentials via email

---

## Email Template

The employee will receive an email like this:

```
Subject: Welcome to GenLab - Your Login Credentials

Hello [Employee Name],

Welcome to GenLab! Your account has been created.

Login Credentials:
Email: employee@example.com
Temporary Password: x7K9mP2qW5nL8vT1
Role: employee

Please log in and change your password immediately.

Login URL: [Your GenLab URL]

Best regards,
GenLab Admin Team
```

---

## Success Messages

### ✅ User Created + Email Sent
```
"User created successfully and email notification sent"
```
→ Employee can log in immediately with emailed credentials

### ⚠️ User Created + Email Failed
```
"User created successfully but email notification failed"
"Please notify the user manually"
```
→ You must manually send credentials to the employee

---

## What to Do When Email Fails

If you see the warning message:

1. **Check backend logs** to see why email failed
2. **Manually notify the employee** with their login email
3. **Generate a new temporary password** if needed:
   - Edit the user
   - Reset their password
   - Send new credentials manually

### Manual Email Template
```
Hi [Name],

Your GenLab account has been created.

Email: [their-email]
Temporary Password: [contact IT for temporary password]

Please log in at: [GenLab URL]
You will be prompted to change your password on first login.

Thanks,
[Your Name]
```

---

## Common Issues

### "Email already exists"
→ This email is already registered. Check existing employees or use a different email.

### Email not received by employee
**Check:**
1. Spam/junk folder
2. Email address typed correctly
3. n8n workflow is activated
4. Backend console logs for errors

### User created but can't log in
**Possible causes:**
- Employee using wrong temporary password
- Account status is "inactive"
- Email delivery failed (check admin panel for warning)

---

## For IT/DevOps

### Environment Setup
Ensure `.env` contains:
```env
N8N_WEBHOOK_URL=https://your-n8n-instance.railway.app/webhook/create-user
```

### Monitoring
Check backend console for:
- ✅ "User created successfully in database"
- 📧 "Triggering n8n webhook"
- ✅ "Email notification sent"
- ⚠️ "n8n webhook failed" (investigate if frequent)

### Testing Webhook
```bash
curl -X POST https://your-n8n.railway.app/webhook/create-user \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "test@example.com",
    "role": "employee",
    "temporaryPassword": "testPass123"
  }'
```

---

## Security Best Practices

### ✅ DO:
- Tell employees to change password on first login
- Use strong, unique temporary passwords (automatically handled)
- Keep webhook URLs confidential
- Monitor failed email attempts

### ❌ DON'T:
- Share temporary passwords over insecure channels (SMS, Slack)
- Reuse passwords for multiple employees
- Disable email notifications without admin awareness
- Expose webhook URLs in frontend code

---

## Quick Reference

| Action | Frontend | Backend | n8n | Database |
|--------|----------|---------|-----|----------|
| Create User | ✅ Form | ✅ Validate | - | - |
| Generate Password | - | ✅ Auto | - | - |
| Save User | - | ✅ Insert | - | ✅ Store |
| Send Email | - | ✅ Trigger | ✅ Send | - |
| Handle Failure | ⚠️ Warning | ⚠️ Log | - | ✅ User Still Saved |

---

## Support Contacts

**Technical Issues:**
- Check `N8N_WEBHOOK_INTEGRATION.md` for detailed troubleshooting
- Review backend console logs
- Verify n8n workflow status

**User Access Issues:**
- Verify user exists in database
- Check account status (active/inactive)
- Reset password if needed

---

Last Updated: 2026-02-04
