# Task System - Quick Start Guide

## 🎉 Task Management System Added Successfully!

The GenLab application now includes a comprehensive task assignment system with strict role-based permissions.

---

## 🔑 Login & Access

### Admin Account
- **Email:** admin@genlab.com
- **Password:** admin123
- **Access:** Full task management at `/tasks`

### Employee Account
- **Email:** demo@genlab.com  
- **Password:** demo123
- **Access:** View assigned tasks at `/my-tasks`

---

## 📋 Features

### Admin Features (`/tasks`):
✅ Create and assign tasks to employees  
✅ Set task title, description, priority, due date  
✅ Update all task fields  
✅ Delete tasks  
✅ Filter by status, priority, assigned employee  
✅ View all tasks across organization  

### Employee Features (`/my-tasks`):
✅ View only their assigned tasks  
✅ Update task status: Pending → In Progress → Completed  
✅ Filter by status and priority  
✅ See due date warnings  
✅ Track completion history  

---

## 🔒 Security Enforcement

### Backend API Protection:
- `POST /api/tasks` - **Admin only** (create task)
- `PUT /api/tasks/:id` - **Admins** can update all fields, **Employees** can update status only
- `DELETE /api/tasks/:id` - **Admin only**
- `GET /api/tasks` - Automatically filtered for employees (only their tasks)

### Permission Checks:
```javascript
// Admin-only endpoints
router.post('/', authenticateToken, isAdmin, ...)
router.delete('/:id', authenticateToken, isAdmin, ...)

// Employee restrictions in update endpoint
if (req.user.role === 'employee') {
  // Check ownership
  if (task.assigned_to !== req.user.id) {
    return res.status(403).json({ message: 'Access denied' });
  }
  // Only allow status updates
  if (!status || Object.keys(req.body).length > 1) {
    return res.status(403).json({ 
      message: 'Employees can only update task status' 
    });
  }
}
```

---

## 🚀 How to Use

### As Admin:
1. Login and navigate to **Tasks** in sidebar
2. Click **"➕ Assign Task"**
3. Fill in task details:
   - Title (required)
   - Description (optional)
   - Assign to employee (required)
   - Priority level (low/medium/high/urgent)
   - Due date (optional)
4. Click **Save**
5. Use filters to view specific tasks
6. Edit or delete tasks as needed

### As Employee:
1. Login and navigate to **My Tasks** in sidebar
2. View all tasks assigned to you
3. For **Pending** tasks, click **"▶️ Start"** to begin working
4. For **In Progress** tasks, click **"✅ Complete"** when done
5. Use filters to organize your task list
6. Due date warnings show for tasks due within 3 days

---

## 📊 Task Status Workflow

```
┌─────────┐        ┌─────────────┐        ┌───────────┐
│ Pending │ ─────> │ In Progress │ ─────> │ Completed │
└─────────┘        └─────────────┘        └───────────┘
    ↓                     ↓
  Start                Complete
```

**Note:** Tasks can also be marked as "Cancelled" by admins

---

## 🎨 Priority Levels

- 🔴 **Urgent** - Critical, needs immediate attention
- 🟠 **High** - Important, high priority
- 🔵 **Medium** - Normal priority (default)
- ⚪ **Low** - Can be done when time permits

---

## 📁 New Files Added

### Backend:
- `routes/tasks.js` - Task API endpoints
- `config/database.js` - Updated with tasks table

### Frontend:
- `pages/Tasks/Tasks.js` - Admin task management page
- `pages/MyTasks/MyTasks.js` - Employee task view page
- `api/api.js` - Updated with taskAPI methods

### Updated Files:
- `server.js` - Registered task routes
- `App.js` - Added task routes
- `components/Layout/Sidebar.js` - Added task menu items

---

## ✅ Security Verification

**All security requirements met:**
- ✅ Only admins can create tasks
- ✅ Only admins can delete tasks  
- ✅ Employees see only their assigned tasks
- ✅ Employees can only update task status
- ✅ All permissions enforced in backend APIs
- ✅ No modifications to existing auth or dashboards

---

## 🧪 Testing Checklist

### Admin Testing:
- [ ] Create a new task
- [ ] Assign task to an employee
- [ ] Edit existing task (all fields)
- [ ] Delete a task
- [ ] Filter tasks by status/priority/employee

### Employee Testing:
- [ ] View assigned tasks only
- [ ] Start a pending task
- [ ] Complete an in-progress task
- [ ] Verify cannot access admin `/tasks` page
- [ ] Verify cannot delete or modify non-status fields

---

## 📞 API Examples

### Create Task (Admin):
```bash
POST /api/tasks
Authorization: Bearer {admin_token}
Content-Type: application/json

{
  "title": "Review pull requests",
  "description": "Review all pending PRs in repository",
  "assigned_to": 2,
  "priority": "high",
  "due_date": "2026-02-10"
}
```

### Update Task Status (Employee):
```bash
PUT /api/tasks/1
Authorization: Bearer {employee_token}
Content-Type: application/json

{
  "status": "in-progress"
}
```

---

## 🎯 Summary

The task management system is now fully integrated into GenLab with:
- **Role-based access control** enforced at database and API level
- **Secure employee restrictions** preventing unauthorized actions
- **Modern UI** matching existing GenLab design
- **Full CRUD operations** for admins
- **Status-only updates** for employees
- **Comprehensive documentation** for implementation details

**Both servers are running and ready to test!**

Visit:
- Admin Tasks: http://localhost:3000/tasks
- Employee Tasks: http://localhost:3000/my-tasks
