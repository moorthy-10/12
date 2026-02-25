import React, { useEffect } from 'react';
import { PushNotifications } from '@capacitor/push-notifications';
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login/Login';
import Dashboard from './pages/Dashboard/Dashboard';
import Employees from './pages/Employees/Employees';
import Attendance from './pages/Attendance/Attendance';
import Leaves from './pages/Leaves/Leaves';
import MyAttendance from './pages/MyAttendance/MyAttendance';
import MyLeaves from './pages/MyLeaves/MyLeaves';
import Tasks from './pages/Tasks/Tasks';
import MyTasks from './pages/MyTasks/MyTasks';
import Groups from './pages/Groups/Groups';
import GroupChat from './pages/GroupChat/GroupChat';
import CompanyCalendar from './pages/CompanyCalendar/CompanyCalendar';
import Performance from './pages/Performance/Performance';
import MyPerformance from './pages/MyPerformance/MyPerformance';
import Standup from './pages/Standup/Standup';
import StandupAdmin from './pages/StandupAdmin/StandupAdmin';
import { ChatProvider } from './chat/ChatProvider';
import { NotificationProvider } from './context/NotificationProvider';
import FloatingChatButton from './chat/FloatingChatButton';
import FloatingChatWindow from './chat/FloatingChatWindow';
import './chat/FloatingChat.css';

// Protected Route Component
const ProtectedRoute = ({ children, adminOnly = false }) => {
  const { isAuthenticated, isAdmin, loading } = useAuth();

  if (loading) {
    return (
      <div className="loader-container" style={{ minHeight: '100vh' }}>
        <div className="loader"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (adminOnly && !isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

// Public Route (redirect if already logged in)
const PublicRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="loader-container" style={{ minHeight: '100vh' }}>
        <div className="loader"></div>
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

function AppRoutes() {
  return (
    <Routes>
      {/* Public Routes */}
      <Route
        path="/login"
        element={
          <PublicRoute>
            <Login />
          </PublicRoute>
        }
      />

      {/* Protected Routes - All Users */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />

      {/* Protected Routes - Admin Only */}
      <Route
        path="/employees"
        element={
          <ProtectedRoute adminOnly>
            <Employees />
          </ProtectedRoute>
        }
      />
      <Route
        path="/attendance"
        element={
          <ProtectedRoute adminOnly>
            <Attendance />
          </ProtectedRoute>
        }
      />
      <Route
        path="/leaves"
        element={
          <ProtectedRoute adminOnly>
            <Leaves />
          </ProtectedRoute>
        }
      />
      <Route
        path="/tasks"
        element={
          <ProtectedRoute adminOnly>
            <Tasks />
          </ProtectedRoute>
        }
      />
      <Route
        path="/performance"
        element={
          <ProtectedRoute adminOnly>
            <Performance />
          </ProtectedRoute>
        }
      />
      <Route
        path="/standup-summary"
        element={
          <ProtectedRoute adminOnly>
            <StandupAdmin />
          </ProtectedRoute>
        }
      />

      {/* Protected Routes - Employee Only */}
      <Route
        path="/my-attendance"
        element={
          <ProtectedRoute>
            <MyAttendance />
          </ProtectedRoute>
        }
      />
      <Route
        path="/my-leaves"
        element={
          <ProtectedRoute>
            <MyLeaves />
          </ProtectedRoute>
        }
      />
      <Route
        path="/my-tasks"
        element={
          <ProtectedRoute>
            <MyTasks />
          </ProtectedRoute>
        }
      />
      <Route
        path="/my-performance"
        element={
          <ProtectedRoute>
            <MyPerformance />
          </ProtectedRoute>
        }
      />
      <Route
        path="/standup"
        element={
          <ProtectedRoute>
            <Standup />
          </ProtectedRoute>
        }
      />

      {/* Group Chat - All authenticated users */}
      <Route
        path="/groups"
        element={
          <ProtectedRoute>
            <Groups />
          </ProtectedRoute>
        }
      />
      <Route
        path="/groups/:id"
        element={
          <ProtectedRoute>
            <GroupChat />
          </ProtectedRoute>
        }
      />

      <Route
        path="/calendar"
        element={
          <ProtectedRoute>
            <CompanyCalendar />
          </ProtectedRoute>
        }
      />

      {/* Default Route */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
const PushManager = () => {
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    if (!isAuthenticated) return;

    // Request permission
    PushNotifications.requestPermissions().then(result => {
      if (result.receive === 'granted') {
        PushNotifications.register();
      } else {
        console.log('Push permission not granted');
      }
    });

    // When token generated
    PushNotifications.addListener('registration', async (token) => {
      console.log('FCM TOKEN:', token.value);

      const jwt = localStorage.getItem('token');
      if (!jwt) return;

      try {
        await fetch('https://one2-mti6.onrender.com/api/users/fcm-token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${jwt}`
          },
          body: JSON.stringify({
            fcmToken: token.value
          })
        });

        console.log('FCM token saved to backend');
      } catch (err) {
        console.error('Failed to save FCM token:', err);
      }
    });

    // Foreground push
    PushNotifications.addListener('pushNotificationReceived', notification => {
      console.log('Push received:', notification);
    });

  }, [isAuthenticated]);

  return null;
};

function App() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <ChatProvider>
          <BrowserRouter>
            <PushManager />   {/* 🔥 ADD THIS LINE */}
            <AppRoutes />
            <FloatingChatButton />
            <FloatingChatWindow />
          </BrowserRouter>
        </ChatProvider>
      </NotificationProvider>
    </AuthProvider>
  );
}

export default App;
