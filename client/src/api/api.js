import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const api = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json'
    }
});

// Add token to requests if available
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Handle response errors
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

// Auth APIs
export const authAPI = {
    login: (credentials) => api.post('/auth/login', credentials),
    getCurrentUser: () => api.get('/auth/me'),
    changePassword: (data) => api.put('/auth/change-password', data)
};

// User APIs
export const userAPI = {
    getAll: (params) => api.get('/users', { params }),
    getById: (id) => api.get(`/users/${id}`),
    create: (data) => api.post('/users', data),
    update: (id, data) => api.put(`/users/${id}`, data),
    delete: (id) => api.delete(`/users/${id}`)
};

// Attendance APIs
export const attendanceAPI = {
    getAll: (params) => api.get('/attendance', { params }),
    getById: (id) => api.get(`/attendance/${id}`),
    create: (data) => api.post('/attendance', data),
    update: (id, data) => api.put(`/attendance/${id}`, data),
    delete: (id) => api.delete(`/attendance/${id}`),
    clockIn: () => api.post('/attendance/clock-in'),
    clockOut: () => api.post('/attendance/clock-out'),
    getToday: () => api.get('/attendance/today'),
    exportMonthly: (month, year) =>
        api.get('/attendance/export/monthly', {
            params: { month, year },
            responseType: 'blob'
        }),
    exportRange: (startDate, endDate) =>
        api.get('/attendance/export', {
            params: { startDate, endDate },
            responseType: 'blob'
        }),
    adminOverride: (data) => api.post('/attendance/admin', data),
    getReport: (params) => api.get('/attendance/report', {
        params,
        responseType: params.export === 'true' ? 'blob' : 'json'
    }),
};

// Leave APIs
export const leaveAPI = {
    getAll: (params) => api.get('/leaves', { params }),
    getById: (id) => api.get(`/leaves/${id}`),
    create: (data) => api.post('/leaves', data),
    update: (id, data) => api.put(`/leaves/${id}`, data),
    review: (id, data) => api.put(`/leaves/${id}/review`, data),
    delete: (id) => api.delete(`/leaves/${id}`)
};

// Dashboard APIs
export const dashboardAPI = {
    getAdminStats: () => api.get('/dashboard/admin/stats'),
    getEmployeeStats: () => api.get('/dashboard/employee/stats'),
    getRecentActivities: (params) => api.get('/dashboard/admin/recent-activities', { params }),
    getUnifiedActivity: () => api.get('/dashboard/activity'),
    getAnalytics: () => api.get('/dashboard/analytics')
};

// Calendar APIs
export const calendarAPI = {
    getAll: (params) => api.get('/calendar', { params }),
    getById: (id) => api.get(`/calendar/${id}`),
    checkHoliday: (date) => api.get(`/calendar/check-holiday/${date}`),
    create: (data) => api.post('/calendar', data),
    update: (id, data) => api.put(`/calendar/${id}`, data),
    delete: (id) => api.delete(`/calendar/${id}`)
};

// Task APIs
export const taskAPI = {
    getAll: (params) => api.get('/tasks', { params }),
    getById: (id) => api.get(`/tasks/${id}`),
    create: (data) => api.post('/tasks', data),
    update: (id, data) => api.put(`/tasks/${id}`, data),
    delete: (id) => api.delete(`/tasks/${id}`)
};

// Admin APIs
export const adminAPI = {
    createUser: (data) => api.post('/admin/create-user', data),
    resetPassword: (userId) => api.post(`/admin/reset-password/${userId}`)
};

// Group Chat APIs
export const groupAPI = {
    getAll: () => api.get('/groups'),
    getById: (id) => api.get(`/groups/${id}`),
    create: (data) => api.post('/groups', data),
    getMessages: (id, params) => api.get(`/groups/${id}/messages`, { params }),
    uploadFile: (id, formData) =>
        api.post(`/groups/${id}/files`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        })
};

// Private Message APIs
export const privateMessageAPI = {
    getHistory: (userId, params) => api.get(`/private-messages/${userId}`, { params })
};

// Event Calendar APIs
export const eventAPI = {
    getByMonth: (month, myEvents = false) => api.get(`/events?month=${month}${myEvents ? '&myEvents=true' : ''}`),
    getById: (id) => api.get(`/events/${id}`),
    create: (data) => api.post('/events', data),
    update: (id, data) => api.put(`/events/${id}`, data),
    delete: (id) => api.delete(`/events/${id}`)
};

// Performance APIs
export const performanceAPI = {
    get: () => api.get('/performance')
};

// Standup APIs
export const standupAPI = {
    submit: (data) => api.post('/standup', data),
    getToday: () => api.get('/standup/today'),
    getMy: () => api.get('/standup/my'),
    getPerformance: () => api.get('/standup/performance'),
    // admin
    getAll: (date) => api.get('/standup', { params: date ? { date } : {} }),
    getSummary: (date) => api.get('/standup/summary', { params: date ? { date } : {} }),
    remindMissing: () => api.post('/standup/remind-missing')
};

// Search APIs
export const searchAPI = {
    query: (q) => api.get('/search', { params: { q } })
};

// Department APIs
export const departmentAPI = {
    getAll: () => api.get('/departments')
};

export default api;

