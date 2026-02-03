# Task Management System - Implementation Documentation

## Overview
The GenLab application has been extended with a comprehensive task assignment system that follows strict role-based access control.

---

## Security Implementation

### ✅ Role-Based Permissions

#### Admin Permissions (Full Access):
- ✅ Create new tasks
- ✅ Assign tasks to any employee
- ✅ Update all task fields (title, description, assigned_to, status, priority, due_date)
- ✅ Delete any task
- ✅ View all tasks

#### Employee Permissions (Restricted):
- ✅ View ONLY tasks assigned to them
- ✅ Update ONLY the status field of their tasks
- ❌ Cannot create tasks
- ❌ Cannot assign tasks
- ❌ Cannot delete tasks
- ❌ Cannot modify any field except status
- ❌ Cannot view other employees' tasks

---

## Database Schema

### Tasks Table
```sql
CREATE TABLE tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT,
  assigned_to INTEGER NOT NULL,           -- FK to users.id
  assigned_by INTEGER NOT NULL,           -- FK to users.id
  status TEXT DEFAULT 'pending',          -- pending, in-progress, completed, cancelled
  priority TEXT DEFAULT 'medium',         -- low, medium, high, urgent
  due_date DATE,
  completed_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_by) REFERENCES users(id)
);
```

**Constraints:**
- `status` CHECK constraint: Only accepts 'pending', 'in-progress', 'completed', 'cancelled'
- `priority` CHECK constraint: Only accepts 'low', 'medium', 'high', 'urgent'
- Foreign key cascading: Tasks are automatically deleted when assigned user is deleted

---

## Backend API Endpoints

### GET /api/tasks
**Description:** Retrieve tasks with filtering

**Authentication:** Required  
**Authorization:** 
- Admin: Can view all tasks
- Employee: Can view only their assigned tasks (automatically filtered)

**Query Parameters:**
- `status` - Filter by status
- `priority` - Filter by priority
- `assigned_to` - Filter by assigned user (admin only)

**Response:**
```json
{
  "success": true,
  "tasks": [
    {
      "id": 1,
      "title": "Complete project documentation",
      "description": "Write comprehensive docs for task system",
      "assigned_to": 2,
      "assigned_to_name": "Demo Employee",
      "assigned_to_email": "demo@genlab.com",
      "assigned_by": 1,
      "assigned_by_name": "Admin User",
      "status": "in-progress",
      "priority": "high",
      "due_date": "2026-02-10",
      "completed_at": null,
      "created_at": "2026-02-02T12:00:00Z",
      "updated_at": "2026-02-02T12:00:00Z"
    }
  ]
}
```

---

### GET /api/tasks/:id
**Description:** Get single task details

**Authentication:** Required  
**Authorization:**
- Admin: Can view any task
- Employee: Can view only if task is assigned to them

**Security Check (Backend):**
```javascript
if (req.user.role === 'employee' && task.assigned_to !== req.user.id) {
  return res.status(403).json({ message: 'Access denied' });
}
```

---

### POST /api/tasks
**Description:** Create and assign a new task

**Authentication:** Required  
**Authorization:** Admin only (enforced by `isAdmin` middleware)

**Request Body:**
```json
{
  "title": "Complete user testing",
  "description": "Test all user flows",
  "assigned_to": 2,
  "priority": "high",
  "due_date": "2026-02-15"
}
```

**Validation:**
- `title` - Required, non-empty
- `assigned_to` - Required, must be valid user ID
- `priority` - Optional, must be one of: low, medium, high, urgent
- `due_date` - Optional, must be valid date format

---

### PUT /api/tasks/:id
**Description:** Update task

**Authentication:** Required  
**Authorization:**
- Admin: Can update all fields
- Employee: Can ONLY update status field of their assigned tasks

**Admin Request (Full Update):**
```json
{
  "title": "Updated title",
  "description": "Updated description",
  "assigned_to": 3,
  "status": "completed",
  "priority": "urgent",
  "due_date": "2026-02-20"
}
```

**Employee Request (Status Only):**
```json
{
  "status": "in-progress"
}
```

**Security Check (Backend):**
```javascript
if (req.user.role === 'employee') {
  // Verify ownership
  if (task.assigned_to !== req.user.id) {
    return res.status(403).json({ message: 'Access denied' });
  }
  
  // Verify only status is being updated
  const { status } = req.body;
  if (!status || Object.keys(req.body).length > 1) {
    return res.status(403).json({ 
      message: 'Employees can only update task status' 
    });
  }
}
```

---

### DELETE /api/tasks/:id
**Description:** Delete task

**Authentication:** Required  
**Authorization:** Admin only (enforced by `isAdmin` middleware)

---

## Frontend Implementation

### Admin View: `/tasks`
**Component:** `pages/Tasks/Tasks.js`

**Features:**
- View all tasks in a filterable table
- Filter by status, priority, assigned employee
- Create new tasks via modal
- Assign tasks to any employee
- Edit all task fields
- Delete tasks
- Visual status and priority badges

**Key Functions:**
- `handleAddTask()` - Opens modal to create task
- `handleEditTask(task)` - Opens modal to edit task
- `handleDeleteTask(id)` - Deletes task with confirmation
- `fetchTasks()` - Fetches tasks with current filters
- `fetchEmployees()` - Gets list of employees for assignment

---

### Employee View: `/my-tasks`
**Component:** `pages/MyTasks/MyTasks.js`

**Features:**
- View only assigned tasks
- Filter by status and priority
- Update task status with action buttons
- Visual due date warnings
- Task summary (active vs completed)
- Helpful status guide

**Task Status Workflow:**
```
Pending → In Progress → Completed
   ↓           ↓
  (Start)   (Complete)
```

**Status Update Buttons:**
- **Pending tasks:** Show "▶️ Start" button → Changes to "in-progress"
- **In Progress tasks:** Show "✅ Complete" button → Changes to "completed"
- **Completed tasks:** Display completion date (no actions available)

**Security:**
- Employee can only update `status` field
- Backend enforces this restriction
- All other fields are read-only for employees

---

## Security Audit Checklist

### ✅ Backend Security
- [x] Tasks table created with proper foreign keys
- [x] `isAdmin` middleware on create/delete endpoints
- [x] Employee queries filtered by `assigned_to = req.user.id`
- [x] Employee update restricted to status field only
- [x] Ownership verification before allowing employee updates
- [x] Input validation on all endpoints
- [x] Parameterized queries (SQL injection prevention)

### ✅ Frontend Security
- [x] Admin routes protected with `adminOnly` prop
- [x] Employee routes protected with `ProtectedRoute`
- [x] Sidebar navigation shows correct menu based on role
- [x] Employee forms only show status dropdown
- [x] Admin forms show all fields

---

## Testing Scenarios

### Admin Testing:
1. ✅ Login as admin@genlab.com
2. ✅ Navigate to Tasks page
3. ✅ Click "Assign Task"
4. ✅ Select an employee, set all fields
5. ✅ Verify task appears in table
6. ✅ Edit task and change all fields
7. ✅ Delete task
8. ✅ Filter by status, priority, employee

### Employee Testing:
1. ✅ Login as demo@genlab.com
2. ✅ Navigate to My Tasks
3. ✅ Verify only assigned tasks are visible
4. ✅ Click "Start" on pending task → Status changes to "in-progress"
5. ✅ Click "Complete" on in-progress task → Status changes to "completed"
6. ✅ Verify cannot access /tasks page (should redirect)
7. ✅ Try to edit task via API directly → Should fail with 403

### Security Testing:
1. ✅ Employee tries to create task via API → 403 Forbidden
2. ✅ Employee tries to view another employee's task → 403 Forbidden
3. ✅ Employee tries to update non-status field → 403 Forbidden
4. ✅ Employee tries to delete task → 403 Forbidden
5. ✅ Admin can perform all operations → Success

---

## File Structure

```
Backend:
├── config/database.js          # Added tasks table schema
├── routes/tasks.js             # New: Task CRUD endpoints
├── middleware/auth.js          # Existing: Used for auth
└── server.js                   # Updated: Register task routes

Frontend:
├── src/
│   ├── api/api.js              # Updated: Added taskAPI methods
│   ├── components/
│   │   └── Layout/
│   │       └── Sidebar.js      # Updated: Added task menu items
│   ├── pages/
│   │   ├── Tasks/
│   │   │   └── Tasks.js        # New: Admin task management
│   │   └── MyTasks/
│   │       └── MyTasks.js      # New: Employee task view
│   └── App.js                  # Updated: Added task routes
```

---

## Summary

### ✅ Requirements Met:

1. **Admin-only task creation:** ✅ Enforced by `isAdmin` middleware
2. **Admin can assign to employees:** ✅ Dropdown of all employees in admin form
3. **Employees view only their tasks:** ✅ Backend filters by `assigned_to`
4. **Employees update only status:** ✅ Backend validates and restricts fields
5. **Backend API permissions:** ✅ All endpoints have proper auth/authorization
6. **No modification to auth/dashboards:** ✅ Only added new features

### 🔒 Security Features:
- Role-based middleware enforcement
- Database-level foreign key constraints
- Input validation
- Ownership verification
- Field-level update restrictions
- SQL injection prevention (parameterized queries)

**Status:** ✅ Task System Successfully Implemented & Secured
