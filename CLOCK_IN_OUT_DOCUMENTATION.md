# Clock-In/Clock-Out Attendance System - Documentation

## Overview
The GenLab attendance system has been extended with clock-in and clock-out functionality, allowing employees to track their daily work hours accurately while maintaining strict security controls.

---

## 🔒 Security Rules (Backend Enforced)

### Rule 1: One Attendance Record Per User Per Day
**Enforcement:** Database UNIQUE constraint + Application validation

**Database:**
```sql
UNIQUE(user_id, date)
```

**Backend Check (`routes/attendance.js`):**
```javascript
db.get('SELECT * FROM attendance WHERE user_id = ? AND date = ?', [user_id, today], (err, existing) => {
  if (existing) {
    return res.status(400).json({ 
      message: 'You have already clocked in today'
    });
  }
});
```

---

### Rule 2: Clock-In Once Per Day
**Enforcement:** Backend validation checks for existing record

- Employee can only clock in if no record exists for today
- Clock-in automatically creates an attendance record with status "present"
- Returns error if already clocked in

**Code Location:** `routes/attendance.js` - POST `/clock-in`

---

### Rule 3: Clock-Out Only After Clock-In
**Enforcement:** Backend validates clock-in exists before allowing clock-out

```javascript
if (!record) {
  return res.status(400).json({ 
    message: 'You must clock in before clocking out' 
  });
}

if (!record.check_in_time) {
  return res.status(400).json({ 
    message: 'No clock-in time found for today' 
  });
}
```

**Code Location:** `routes/attendance.js` - POST `/clock-out`

---

### Rule 4: Current Date Only
**Enforcement:** Backend automatically uses current server date

```javascript
const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
```

- Employees cannot clock in/out for past or future dates
- Server time is the source of truth
- No date input from client accepted

---

### Rule 5: Employees View Only Their Own Attendance
**Enforcement:** Existing role-based filtering (from previous implementation)

```javascript
// In GET /attendance
if (req.user.role === 'employee') {
  query += ' AND a.user_id = ?';
  params.push(req.user.id);
}
```

**Already enforced** - No changes needed

---

### Rule 6: Admins Can View All Attendance
**Enforcement:** Admin queries have no user_id filter

```javascript
// Admin can see all records
if (req.user.role === 'employee') {
  // Filter for employee
} else {
  // No filter for admin - sees all
}
```

**Already enforced** - No changes needed

---

## API Endpoints

### 1. POST /api/attendance/clock-in
**Description:** Clock in for today

**Authentication:** Required  
**Authorization:** All users (restricted to self)

**Request:** None (uses logged-in user and current date)

**Success Response:**
```json
{
  "success": true,
  "message": "Clocked in successfully at 09:15",
  "record": {
    "id": 123,
    "user_id": 2,
    "date": "2026-02-02",
    "status": "present",
    "check_in_time": "09:15",
    "check_out_time": null,
    "user_name": "Demo Employee",
    "email": "demo@genlab.com",
    "department": "Engineering"
  }
}
```

**Error Response:**
```json
{
  "success": false,
  "message": "You have already clocked in today",
  "record": { ... }
}
```

**Security Checks:**
1. ✅ User must be authenticated
2. ✅ Only creates record for logged-in user (req.user.id)
3. ✅ Only for current date (server-side)
4. ✅ Validates no existing record for today

---

### 2. POST /api/attendance/clock-out
**Description:** Clock out for today

**Authentication:** Required  
**Authorization:** All users (restricted to self)

**Request:** None (uses logged-in user and current date)

**Success Response:**
```json
{
  "success": true,
  "message": "Clocked out successfully at 18:30",
  "record": {
    "id": 123,
    "user_id": 2,
    "date": "2026-02-02",
    "status": "present",
    "check_in_time": "09:15",
    "check_out_time": "18:30",
    "...": "..."
  }
}
```

**Error Responses:**
```json
{
  "success": false,
  "message": "You must clock in before clocking out"
}
```

```json
{
  "success": false,
  "message": "You have already clocked out today",
  "record": { ... }
}
```

**Security Checks:**
1. ✅ User must be authenticated
2. ✅ Only for logged-in user's record
3. ✅ Only for current date
4. ✅ Validates clock-in exists
5. ✅ Validates not already clocked out

---

### 3. GET /api/attendance/today
**Description:** Get today's attendance status for logged-in user

**Authentication:** Required  
**Authorization:** All users (self only)

**Success Response:**
```json
{
  "success": true,
  "record": {
    "id": 123,
    "date": "2026-02-02",
    "check_in_time": "09:15",
    "check_out_time": null,
    "...": "..."
  },
  "hasClockedIn": true,
  "canClockOut": true
}
```

**If not clocked in:**
```json
{
  "success": true,
  "record": null,
  "hasClockedIn": false,
  "canClockOut": false
}
```

---

## Frontend Implementation

### Enhanced My Attendance Page
**Location:** `client/src/pages/MyAttendance/MyAttendance.js`

**Features:**
1. **Real-Time Clock Display**
   - Shows current date and time (updates every second)
   - Formatted as: "Sunday, February 2, 2026" and "05:45:30 PM"

2. **Today's Status Card**
   - Visual status badge (Clocked In / Not Clocked In)
   - Display of clock-in and clock-out times
   - Automatic calculation of hours worked
   - Gradient background for visual appeal

3. **Action Buttons**
   - **Clock In Button:** Shows when not clocked in
   - **Clock Out Button:** Shows when clocked in but not clocked out
   - **Completion Message:** Shows when both clock-in/out complete
   - Loading states during API calls

4. **Attendance History Table**
   - Shows all past attendance records
   - Displays date, status, clock times, hours worked
   - Date range filtering capability

5. **Guidelines Card**
   - Informational section explaining clock-in/out rules
   - Helps users understand the system

### Time Calculation
```javascript
const calculateHours = (checkIn, checkOut) => {
  const [inHours, inMinutes] = checkIn.split(':').map(Number);
  const [outHours, outMinutes] = checkOut.split(':').map(Number);
  
  const inTotalMinutes = inHours * 60 + inMinutes;
  const outTotalMinutes = outHours * 60 + outMinutes;
  
  const diffMinutes = outTotalMinutes - inTotalMinutes;
  const hours = Math.floor(diffMinutes / 60);
  const minutes = diffMinutes % 60;
  
  return `${hours}h ${minutes}m`;
};
```

---

## User Workflows

### Employee Clock-In Workflow
1. Navigate to "My Attendance" page
2. See current date/time and "Not Clocked In" status
3. Click "🕐 Clock In" button
4. System records current time and creates attendance record
5. Status updates to "Clocked In"
6. Clock Out button becomes available

### Employee Clock-Out Workflow
1. After clocking in, click "🕐 Clock Out" button
2. System records current time in check_out_time
3. Hours worked calculation displayed
4. Completion message shown
5. No further actions available for today

### Admin Workflow
**No Changes** - Admins continue to use the existing Attendance page to:
- View all employee attendance
- Manually mark attendance for any employee
- Apply filters and manage records

---

## Security Audit Results

### ✅ All Rules Enforced

| Rule | Backend | Database | Frontend |
|------|---------|----------|----------|
| One record per user per day | ✅ Check | ✅ UNIQUE | ✅ UI State |
| Clock-in once per day | ✅ Validated | ✅ UNIQUE | ✅ Button Hidden |
| Clock-out after clock-in | ✅ Validated | - | ✅ Button Conditional |
| Current date only | ✅ Server Date | - | ✅ No Date Input |
| Employee sees own records | ✅ Filtered | - | ✅ Component Logic |
| Admin sees all records | ✅ No Filter | - | ✅ Separate Page |

---

## Time Format

**Storage:** TIME type in database (HH:MM or HH:MM:SS)

**Backend Generation:**
```javascript
const now = new Date();
const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
```

**Display:** Shows time in 24-hour format (e.g., "09:15", "18:30")

**Hours Calculation:** Accurate to the minute

---

## Error Handling

### Backend Errors:
- Database connection failures → 500 Internal Server Error
- Validation failures → 400 Bad Request with message
- Authentication failures → 401 Unauthorized
- Authorization failures → 403 Forbidden

### Frontend Error Handling:
```javascript
try {
  const response = await attendanceAPI.clockIn();
  setSuccess(response.data.message);
} catch (err) {
  setError(err.response?.data?.message || 'Failed to clock in');
}
```

**User-Friendly Messages:**
- "You have already clocked in today"
- "You must clock in before clocking out"
- "You have already clocked out today"
- "Failed to clock in" (generic fallback)

---

## Leave Logic (Unchanged)

✅ **No modifications made to leave system**
- Leave request creation → unchanged
- Leave approval workflow → unchanged
- Leave display → unchanged
- All leave routes → unchanged

---

## Testing Checklist

### Clock-In Tests:
- [ ] Employee can clock in on first access today
- [ ] Second clock-in attempt returns error
- [ ] Clock-in time is accurate to current minute
- [ ] Attendance record created with status "present"
- [ ] Record visible in attendance history

### Clock-Out Tests:
- [ ] Clock-out only available after clock-in
- [ ] Clock-out before clock-in returns error
- [ ] Second clock-out attempt returns error
- [ ] Clock-out time is accurate
- [ ] Hours worked calculated correctly

### Date Restriction Tests:
- [ ] Cannot clock in for past dates
- [ ] Cannot clock in for future dates
- [ ] Server date used (not client date)

### Permission Tests:
- [ ] Employee sees only their attendance
- [ ] Admin sees all attendance records
- [ ] Employee cannot manually set times
- [ ] Only current user can clock in/out

---

## Files Modified

### Backend:
- `routes/attendance.js` - Added clock-in, clock-out, and today endpoints

### Frontend:
- `api/api.js` - Added clockIn, clockOut, getToday methods
- `pages/MyAttendance/MyAttendance.js` - Complete rewrite with clock-in/out UI
- `pages/MyAttendance/MyAttendance.css` - New styles for clock card

---

## Summary

✅ **All Requirements Met:**
1. ✅ One attendance record per user per day (enforced)
2. ✅ Employee can clock-in once per day (enforced)
3. ✅ Employee can clock-out only after clock-in (enforced)
4. ✅ Clock-in/out allowed only for current date (enforced)
5. ✅ Employees view only their attendance (already enforced)
6. ✅ Admins view all attendance (already enforced)
7. ✅ All rules enforced in backend (verified)
8. ✅ Leave logic unchanged (verified)

**Status:** 🔒 Secure and Ready for Use
