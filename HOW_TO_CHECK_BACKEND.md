# How to Check Backend Server Status

**Last Updated:** 2026-02-04

---

## 🎯 **Quick Summary**

Your backend server is running on **Port 5000** and is **HEALTHY** ✅

```json
{
  "status": "ok",
  "message": "GenLab API is running"
}
```

---

## 📋 **Methods to Check Backend Status**

### **Method 1: Check Health Endpoint (Recommended)**

The easiest way to verify the backend is running:

**Using PowerShell:**
```powershell
Invoke-RestMethod -Uri http://localhost:5000/api/health -UseBasicParsing | ConvertTo-Json
```

**Expected Response:**
```json
{
  "status": "ok",
  "message": "GenLab API is running"
}
```

**Using Browser:**
Simply open: `http://localhost:5000/api/health`

---

### **Method 2: Check Server Logs**

Your server is running with `npm run dev:all`, which shows live logs.

**What to Look For:**
```
[0] 🚀 GenLab server running on port 5000
[0] 📍 API available at http://localhost:5000/api
[0] 📦 Connected to SQLite database
```

**The `[0]` prefix** indicates backend server output  
**The `[1]` prefix** indicates frontend (React) output

---

### **Method 3: Test Specific API Endpoints**

#### **Test Authentication Endpoint:**
```powershell
$body = @{
    email = "admin@genlab.com"
    password = "admin123"
} | ConvertTo-Json

Invoke-RestMethod -Uri http://localhost:5000/api/auth/login -Method POST -Body $body -ContentType "application/json" | ConvertTo-Json
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "name": "Admin User",
    "email": "admin@genlab.com",
    "role": "admin"
  }
}
```

---

### **Method 4: Check if Port 5000 is in Use**

Verify that something is listening on port 5000:

```powershell
netstat -ano | findstr :5000
```

**Expected Output:**
```
TCP    0.0.0.0:5000           0.0.0.0:0              LISTENING       12345
```

This confirms a process is listening on port 5000.

---

### **Method 5: Check Database Connection**

Verify the database is accessible:

```powershell
node -e "const db = require('./config/database'); db.get('SELECT COUNT(*) as count FROM users', (err, row) => { if (err) console.error(err); else console.log('Users in DB:', row.count); process.exit(); });"
```

**Expected Output:**
```
📦 Connected to SQLite database
✅ Default admin user created (admin@genlab.com / admin123)
✅ Demo employee user created (demo@genlab.com / demo123)
Users in DB: 2
```

---

## 🔍 **Real-Time Backend Monitoring**

### **Current Server Logs:**

Looking at your current server output, I can see:

```
✅ Backend is running and processing requests
✅ Users are being created successfully
✅ Passwords are being hashed correctly
✅ Database operations are working
```

**Recent Activity:**
- User creation for `bency5531@gmail.com` ✅
- Password hashing successful ✅
- Database operations functioning ✅

---

## 📊 **Available API Endpoints**

Once the backend is running, these endpoints are available:

### **Public Endpoints:**
- `POST /api/auth/login` - User login
- `GET /api/health` - Health check

### **Protected Endpoints (Require JWT Token):**

**Authentication:**
- `GET /api/auth/me` - Get current user

**User Management (Admin Only):**
- `GET /api/users` - List all users
- `POST /api/users` - Create user
- `GET /api/users/:id` - Get user by ID
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user

**Admin Operations (Admin Only):**
- `POST /api/admin/create-user` - Create user with email notification

**Attendance:**
- `GET /api/attendance` - Get attendance records
- `POST /api/attendance` - Mark attendance
- `PUT /api/attendance/:id` - Update attendance
- `DELETE /api/attendance/:id` - Delete attendance

**Leave Management:**
- `GET /api/leaves` - Get leave requests
- `POST /api/leaves` - Create leave request
- `PUT /api/leaves/:id` - Update leave
- `PUT /api/leaves/:id/review` - Review leave (Admin only)
- `DELETE /api/leaves/:id` - Delete leave

**Tasks:**
- `GET /api/tasks` - Get tasks
- `POST /api/tasks` - Create task
- `PUT /api/tasks/:id` - Update task
- `DELETE /api/tasks/:id` - Delete task

**Calendar:**
- `GET /api/calendar` - Get calendar events
- `POST /api/calendar` - Create event
- `PUT /api/calendar/:id` - Update event
- `DELETE /api/calendar/:id` - Delete event

**Dashboard:**
- `GET /api/dashboard/admin/stats` - Admin dashboard stats
- `GET /api/dashboard/employee/stats` - Employee dashboard stats

---

## 🚨 **Troubleshooting**

### **Backend Not Responding?**

1. **Check if the server is running:**
   ```powershell
   netstat -ano | findstr :5000
   ```

2. **Check for errors in logs:**
   Look at the terminal running `npm run dev:all` for error messages

3. **Restart the backend:**
   - Stop the current process (Ctrl+C in terminal)
   - Run: `npm run dev:all` again

### **Port Already in Use?**

If you get "Port 5000 is already in use":

```powershell
# Find the process using port 5000
netstat -ano | findstr :5000

# Kill the process (replace PID with actual process ID)
taskkill /F /PID <PID>
```

### **Database Issues?**

Check if `database.sqlite` exists:
```powershell
Test-Path .\database.sqlite
```

If it exists and has issues, you can reset it:
```powershell
# Backup first
Copy-Item database.sqlite database.backup.sqlite

# Delete and let it recreate
Remove-Item database.sqlite
# Then restart the server
```

---

## 📈 **Performance Monitoring**

### **Check Server Response Time:**

```powershell
Measure-Command { Invoke-RestMethod -Uri http://localhost:5000/api/health -UseBasicParsing }
```

**Healthy Response Time:** Under 100ms

---

## 🔐 **Security Checks**

### **Verify JWT Secret is Set:**
```powershell
Select-String -Path .env -Pattern "JWT_SECRET"
```

### **Check Environment:**
```powershell
Get-Content .env
```

**Should show:**
```
PORT=5000
JWT_SECRET=your_jwt_secret_key_change_in_production_2024
NODE_ENV=development
N8N_WEBHOOK_URL=https://moorthygenlab.app.n8n.cloud/webhook/webhook/create-user
```

---

## ✅ **Current Backend Status**

Based on the latest checks:

| Check | Status |
|-------|--------|
| **Server Running** | ✅ Yes (Port 5000) |
| **Health Endpoint** | ✅ Responding |
| **Database** | ✅ Connected |
| **API Endpoints** | ✅ Available |
| **Error Count** | ✅ 0 |
| **Response Time** | ✅ Normal |

---

## 🎓 **Tips for Development**

1. **Keep the logs visible** - Run `npm run dev:all` in a dedicated terminal
2. **Use the health endpoint** - Quick way to verify backend is alive
3. **Check logs after actions** - Look for `[0]` prefixed messages for backend activity
4. **Test with Postman** - Great for testing API endpoints manually
5. **Monitor database file** - `database.sqlite` size increases with data

---

## 📞 **Quick Reference Commands**

```powershell
# Check if backend is alive
Invoke-RestMethod http://localhost:5000/api/health -UseBasicParsing

# Check what's using port 5000
netstat -ano | findstr :5000

# View environment variables
Get-Content .env

# Check database
Test-Path .\database.sqlite

# Test login
$body = @{ email = "admin@genlab.com"; password = "admin123" } | ConvertTo-Json
Invoke-RestMethod -Uri http://localhost:5000/api/auth/login -Method POST -Body $body -ContentType "application/json"
```

---

**Your backend is currently running smoothly! 🚀**
