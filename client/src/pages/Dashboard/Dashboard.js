import './Dashboard.css';
import React, { useState, useEffect } from 'react';
import MainLayout from '../../components/Layout/MainLayout';
import { dashboardAPI } from '../../api/api';
import { useAuth } from '../../context/AuthContext';
import { FaUsers, FaUserCheck, FaCalendarCheck, FaUserClock, FaHourglassHalf, FaUmbrellaBeach, FaChartLine, FaCheckCircle, FaStar } from 'react-icons/fa';

const Dashboard = () => {
    const { isAdmin } = useAuth();
    const [stats, setStats] = useState(null);
    const [activities, setActivities] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchDashboardData();
    }, [isAdmin]);

    const fetchDashboardData = async () => {
        try {
            if (isAdmin) {
                const [statsRes, activitiesRes] = await Promise.all([
                    dashboardAPI.getAdminStats(),
                    dashboardAPI.getRecentActivities({ limit: 10 })
                ]);
                setStats(statsRes.data.stats);
                setActivities(activitiesRes.data.activities);
            } else {
                const statsRes = await dashboardAPI.getEmployeeStats();
                setStats(statsRes.data.stats);
            }
        } catch (error) {
            console.error('Failed to fetch dashboard data:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <MainLayout title="Dashboard">
                <div className="loader-container">
                    <div className="loader"></div>
                </div>
            </MainLayout>
        );
    }

    return (
        <MainLayout title="Dashboard">
            {isAdmin ? <AdminDashboard stats={stats} activities={activities} /> : <EmployeeDashboard stats={stats} />}
        </MainLayout>
    );
};

const AdminDashboard = ({ stats, activities }) => {
    const statCards = [
        { label: 'Total Users', value: stats?.totalUsers || 0, icon: FaUsers, color: 'blue' },
        { label: 'Active Users', value: stats?.activeUsers || 0, icon: FaUserCheck, color: 'green' },
        { label: 'Today Attendance', value: stats?.todayAttendance || 0, icon: FaCalendarCheck, color: 'purple' },
        { label: 'Present Today', value: stats?.presentToday || 0, icon: FaUserClock, color: 'indigo' },
        { label: 'Pending Leaves', value: stats?.pendingLeaves || 0, icon: FaHourglassHalf, color: 'orange' },
        { label: 'Approved Leaves (Month)', value: stats?.approvedLeavesThisMonth || 0, icon: FaUmbrellaBeach, color: 'pink' },
    ];

    return (
        <div className="dashboard">
            <div className="stats-grid">
                {statCards.map((card, index) => {
                    const IconComponent = card.icon;
                    return (
                        <div key={index} className={`stat-card stat-card-${card.color}`}>
                            <div className="stat-icon">
                                <IconComponent />
                            </div>
                            <div className="stat-content">
                                <div className="stat-label">{card.label}</div>
                                <div className="stat-value">{card.value}</div>
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="dashboard-section">
                <h2 className="section-title">Recent Activities</h2>
                <div className="card">
                    <div className="card-body">
                        {activities.length === 0 ? (
                            <p className="text-center" style={{ color: 'var(--gray-500)' }}>No recent activities</p>
                        ) : (
                            <div className="activities-list">
                                {activities.map((activity, index) => (
                                    <div key={index} className="activity-item">
                                        <div className="activity-content">
                                            <div className="activity-user">{activity.user_name}</div>
                                            <div className="activity-description">
                                                {activity.type === 'attendance' ? 'Marked attendance' : 'Requested leave'} -
                                                <span className={`badge badge-${getStatusColor(activity.status)}`} style={{ marginLeft: '0.5rem' }}>
                                                    {activity.status}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="activity-date">
                                            {new Date(activity.created_at).toLocaleDateString()}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

const EmployeeDashboard = ({ stats }) => {
    const statCards = [
        { label: 'Total Attendance', value: stats?.totalAttendance || 0, icon: FaChartLine, color: 'blue' },
        { label: 'Present This Month', value: stats?.presentThisMonth || 0, icon: FaCheckCircle, color: 'green' },
        { label: 'Total Leaves', value: stats?.totalLeaves || 0, icon: FaUmbrellaBeach, color: 'purple' },
        { label: 'Pending Leaves', value: stats?.pendingLeaves || 0, icon: FaHourglassHalf, color: 'orange' },
        { label: 'Approved Leaves', value: stats?.approvedLeaves || 0, icon: FaStar, color: 'indigo' },
    ];

    const todayAttendance = stats?.attendanceToday;

    return (
        <div className="dashboard">
            <div className="stats-grid">
                {statCards.map((card, index) => {
                    const IconComponent = card.icon;
                    return (
                        <div key={index} className={`stat-card stat-card-${card.color}`}>
                            <div className="stat-icon">
                                <IconComponent />
                            </div>
                            <div className="stat-content">
                                <div className="stat-label">{card.label}</div>
                                <div className="stat-value">{card.value}</div>
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="dashboard-section">
                <h2 className="section-title">Today's Attendance</h2>
                <div className="card">
                    <div className="card-body">
                        {todayAttendance ? (
                            <div className="today-attendance">
                                <div className="attendance-status">
                                    <span className={`badge badge-${getStatusColor(todayAttendance.status)}`}>
                                        {todayAttendance.status}
                                    </span>
                                </div>
                                <div className="attendance-details">
                                    <div className="attendance-detail-item">
                                        <span className="detail-label">Check In:</span>
                                        <span className="detail-value">{todayAttendance.check_in_time || 'N/A'}</span>
                                    </div>
                                    <div className="attendance-detail-item">
                                        <span className="detail-label">Check Out:</span>
                                        <span className="detail-value">{todayAttendance.check_out_time || 'N/A'}</span>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center" style={{ padding: '2rem', color: 'var(--gray-500)' }}>
                                <p>No attendance marked for today</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

const getStatusColor = (status) => {
    const colorMap = {
        'present': 'success',
        'approved': 'success',
        'absent': 'danger',
        'rejected': 'danger',
        'pending': 'warning',
        'half-day': 'info',
        'leave': 'info'
    };
    return colorMap[status] || 'gray';
};

export default Dashboard;
