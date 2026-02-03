# Company Calendar - Quick Start Guide

## ✅ Feature Successfully Added!

The company calendar system is now fully integrated with holiday management and clock-in integration.

---

## 🚀 Quick Test

### Step 1: Create a Holiday (Admin)

**API Request:**
```bash
POST http://localhost:5000/api/calendar
Authorization: Bearer {admin_token}
Content-Type: application/json

{
  "title": "Test Holiday",
  "description": "Testing holiday integration",
  "event_type": "holiday",
  "start_date": "2026-02-02",
  "end_date": "2026-02-02"
}
```

**Using curl:**
```bash
curl -X POST http://localhost:5000/api/calendar \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Test Holiday","event_type":"holiday","start_date":"2026-02-02","end_date":"2026-02-02"}'
```

### Step 2: Try to Clock-In (Employee)

**Navigate to:** http://localhost:3000/my-attendance

**Expected Behavior:**
- Click "🕐 Clock In" button
- See error message: "Today is a holiday: Test Holiday. Clock-in is disabled. Attendance auto-marked."
- Check attendance history - should see record with status "leave" and note "Holiday: Test Holiday"

---

## 📋 Features

### Admin Capabilities:
✅ Create calendar events (holidays, company events, meetings)  
✅ Update existing events  
✅ Delete events  
✅ View all events with filtering  

### Employee Capabilities:
✅ View all calendar events (read-only)  
✅ Automatic holiday handling during clock-in  
✅ Attendance auto-marked on holidays  

### Holiday Integration:
✅ Clock-in disabled on holidays  
✅ Attendance auto-created with "leave" status  
✅ Holiday note added to attendance record  
✅ Prevents duplicate attendance marking  

---

## 🔐 Security

**Admin-Only Operations:**
- POST /api/calendar (create event)
- PUT /api/calendar/:id (update event)
- DELETE /api/calendar/:id (delete event)

**All Users:**
- GET /api/calendar (view events)
- GET /api/calendar/:id (view event details)
- GET /api/calendar/check-holiday/:date (check if date is holiday)

**Backend Enforcement:**
- `isAdmin` middleware on create/update/delete endpoints
- Cannot be bypassed from frontend
- Holiday check happens in backend before clock-in

---

## 📊 Event Types

| Type | Description | Auto-Holiday|
|------|-------------|-------------|
| `holiday` | Company holidays | ✅ Yes |
| `company-event` | Company-wide events | ❌ No (unless manually set) |
| `meeting` | Scheduled meetings | ❌ No |
| `other` | Miscellaneous events | ❌ No |

---

## 💡 Usage Examples

### Create Company Event (Not a Holiday)
```json
{
  "title": "Annual Company Meeting",
  "description": "All-hands meeting",
  "event_type": "company-event",
  "start_date": "2026-03-15",
  "end_date": "2026-03-15",
  "is_holiday": false
}
```
→ Employees CAN clock-in on this date

### Create Multi-Day Holiday
```json
{
  "title": "Year-End Break",
  "description": "Office closed",
  "event_type": "holiday",
  "start_date": "2026-12-24",
  "end_date": "2026-12-31"
}
```
→ Clock-in blocked for entire date range

### Update Existing Event
```json
PUT /api/calendar/1

{
  "title": "Updated Holiday Title",
  "description": "New description"
}
```

### Check if Today is Holiday
```bash
GET /api/calendar/check-holiday/2026-02-02

Response:
{
  "success": true,
  "isHoliday": true,
  "holiday": { ... }
}
```

---

## 🧪 Testing Workflow

**Test 1: Holiday Creation & Integration**
1. Login as admin (`admin@genlab.com` / `admin123`)
2. Create holiday for today's date
3. Login as employee (`demo@genlab.com` / `demo123`)
4. Go to My Attendance
5. Click "Clock In"
6. Verify error message about holiday
7. Check attendance history - should show auto-marked "leave"

**Test 2: Non-Holiday Event**
1. Create event with type="company-event" and is_holiday=false
2. Try to clock-in
3. Should work normally

**Test 3: Update/Delete**
1. Create a holiday
2. Update title/description
3. Delete the holiday
4. Verify clock-in works after deletion

---

## 📁 Files Added/Modified

**Backend:**
- ✅ `routes/calendar.js` - NEW
- ✅ `utils/holidayHelpers.js` - NEW
- ✅ `config/database.js` - MODIFIED (added table)
- ✅ `routes/attendance.js` - MODIFIED (added holiday check)
- ✅ `server.js` - MODIFIED (registered routes)

**Frontend:**
- ✅ `client/src/api/api.js` - MODIFIED (added calendarAPI)

**Documentation:**
- ✅ `CALENDAR_FEATURE_DOCUMENTATION.md` - Full docs
- ✅ `CALENDAR_QUICKSTART.md` - This guide

---

## ⚠️ Important Notes

1. **Event Type "holiday" Auto-Sets is_holiday:**
   - If `event_type` is "holiday", `is_holiday` is automatically set to 1
   - No need to manually set `is_holiday` when creating holidays

2. **Multi-Day Events:**
   - Use `start_date` and `end_date` for events lasting multiple days
   - Holiday check validates if today falls within this range

3. **Auto-Mark Once:**
   - Attendance is auto-marked only on first clock-in attempt
   - Subsequent attempts show "already marked" message

4. **Leave System Untouched:**
   - All leave request functionality remains unchanged
   - Holiday auto-mark uses status="leave" but separate from leave requests

5. **Timezone:**
   - Server uses ISO date format (YYYY-MM-DD)
   - Dates are compared as strings (no timezone conversion)

---

## 🎯 Quick Reference

**Admin Login:**
- Email: `admin@genlab.com`
- Password: `admin123`

**Employee Login:**
- Email: `demo@genlab.com`
- Password: `demo123`

**API Base URL:**
- http://localhost:5000/api/calendar

**Frontend:**
- My Attendance: http://localhost:3000/my-attendance

---

**Status:** ✅ **Ready to Use!**

Both backend and frontend are configured and running. Calendar feature is fully functional and integrated with the attendance system.
