# GenLab - HR & Attendance Management System

A modern full-stack HR and attendance management system built with React and Node.js.

## Features

### Admin Features
- 👥 **Employee Management** - Add, edit, delete employees with role-based access
- 📅 **Attendance Management** - Track and manage employee attendance
- 🏖️ **Leave Management** - Review and approve/reject leave requests
- 📊 **Dashboard** - View statistics and recent activities

### Employee Features
- 📊 **Personal Dashboard** - View personal statistics
- 📅 **My Attendance** - View attendance history
- 🏖️ **Leave Requests** - Submit and track leave requests

## Tech Stack

### Backend
- Node.js + Express
- SQLite Database
- JWT Authentication
- Bcrypt for password hashing

### Frontend
- React 18
- React Router v6
- Axios for API calls
- Modern CSS with custom design system

## Getting Started

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn

### Installation

1. **Install backend dependencies:**
```bash
npm install
```

2. **Install frontend dependencies:**
```bash
cd client
npm install
cd ..
```

### Running the Application

#### Development Mode (Recommended)

Run both backend and frontend concurrently:
```bash
npm run dev:all
```

Or run them separately:

**Backend (Terminal 1):**
```bash
npm run dev
```

**Frontend (Terminal 2):**
```bash
npm run client
```

The backend will run on http://localhost:5000
The frontend will run on http://localhost:3000

#### Production Mode

1. Build the frontend:
```bash
npm run build
```

2. Start the server:
```bash
npm start
```

## Default Credentials

### Admin Account
- **Email:** admin@genlab.com
- **Password:** admin123

### Employee Account
- **Email:** demo@genlab.com
- **Password:** demo123

## Project Structure

```
genlab/
├── client/                 # React frontend
│   ├── public/
│   └── src/
│       ├── api/           # API client
│       ├── components/    # Reusable components
│       ├── context/       # React context (Auth)
│       ├── pages/         # Page components
│       └── index.css      # Global styles
├── config/                # Backend configuration
│   └── database.js        # Database setup
├── middleware/            # Express middleware
│   └── auth.js           # Authentication middleware
├── routes/               # API routes
│   ├── auth.js
│   ├── users.js
│   ├── attendance.js
│   ├── leaves.js
│   └── dashboard.js
├── server.js             # Express server
├── .env                  # Environment variables
└── package.json

```

## API Endpoints

### Authentication
- POST `/api/auth/login` - Login user
- GET `/api/auth/me` - Get current user
- PUT `/api/auth/change-password` - Change password

### Users (Admin only)
- GET `/api/users` - Get all users
- GET `/api/users/:id` - Get user by ID
- POST `/api/users` - Create new user
- PUT `/api/users/:id` - Update user
- DELETE `/api/users/:id` - Delete user

### Attendance
- GET `/api/attendance` - Get attendance records
- POST `/api/attendance` - Mark attendance
- PUT `/api/attendance/:id` - Update attendance
- DELETE `/api/attendance/:id` - Delete attendance (Admin)

### Leaves
- GET `/api/leaves` - Get leave requests
- POST `/api/leaves` - Create leave request
- PUT `/api/leaves/:id` - Update leave request
- PUT `/api/leaves/:id/review` - Review leave (Admin)
- DELETE `/api/leaves/:id` - Delete leave request

### Dashboard
- GET `/api/dashboard/admin/stats` - Get admin statistics
- GET `/api/dashboard/employee/stats` - Get employee statistics
- GET `/api/dashboard/admin/recent-activities` - Get recent activities

## Features Highlights

✨ **Modern SaaS UI** - Beautiful gradient sidebar, cards with shadows, smooth transitions
🔒 **Secure Authentication** - JWT-based authentication with role-based access control
📱 **Responsive Design** - Works seamlessly on desktop and mobile devices
🎨 **Status Badges** - Color-coded badges for attendance and leave status
🔍 **Advanced Filtering** - Search and filter employees, attendance, and leaves
📊 **Real-time Stats** - Dashboard with live statistics and recent activities
✅ **Form Validation** - Client and server-side validation for data integrity
🎭 **Modal Forms** - Clean modal dialogs for create and edit operations

## Database Schema

### Users Table
- id, name, email, password, role, department, position, phone, status, created_at, updated_at

### Attendance Table
- id, user_id, date, status, check_in_time, check_out_time, notes, created_at

### Leaves Table
- id, user_id, leave_type, start_date, end_date, days, reason, status, reviewed_by, reviewed_at, review_notes, created_at

## License

MIT

## Support

For issues and questions, please open an issue on the repository.
