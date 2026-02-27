import './Dashboard.css';
import React, { useState, useEffect } from 'react';
import MainLayout from '../../components/Layout/MainLayout';
import { dashboardAPI, attendanceAPI, scrumAPI } from '../../api/api';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { FaUsers, FaUserCheck, FaCalendarCheck, FaUserClock, FaHourglassHalf, FaUmbrellaBeach, FaChartLine, FaCheckCircle, FaStar, FaExclamationTriangle, FaTasks, FaClipboardList, FaUserPlus, FaCalendarAlt } from 'react-icons/fa';


const Dashboard = () => {
    const { isAdmin } = useAuth();
    const [stats, setStats] = useState(null);
    const [analytics, setAnalytics] = useState(null);
    const [activities, setActivities] = useState([]);
    const [loading, setLoading] = useState(true);
    const [incompleteAttendance, setIncompleteAttendance] = useState(false);
    const [activeScrums, setActiveScrums] = useState([]);


    useEffect(() => {
        fetchDashboardData();

        // Live Scrum Listener
        const socket = window.socket; // Assuming global socket or similar
        if (socket) {
            socket.on('SCRUM_STARTED', (data) => {
                setActiveScrums(prev => [data, ...prev]);
            });
        }
        return () => {
            if (socket) socket.off('SCRUM_STARTED');
        };
    }, [isAdmin]);

    const fetchDashboardData = async () => {
        try {
            if (isAdmin) {
                const [statsRes, activitiesRes, analyticsRes] = await Promise.all([
                    dashboardAPI.getAdminStats(),
                    dashboardAPI.getUnifiedActivity(),
                    dashboardAPI.getAnalytics()
                ]);
                setStats(statsRes.data.stats);
                setActivities(activitiesRes.data.activities);
                setAnalytics(analyticsRes.data.analytics);
            } else {
                const [statsRes, todayRes, analyticsRes] = await Promise.all([
                    dashboardAPI.getEmployeeStats(),
                    attendanceAPI.getToday(),
                    dashboardAPI.getAnalytics()
                ]);
                setStats(statsRes.data.stats);
                setIncompleteAttendance(todayRes.data.incompleteAttendance);
                setAnalytics(analyticsRes.data.analytics);
            }

        } catch (error) {
            console.error('Failed to fetch dashboard data:', error);
        }

        // Always fetch active scrums
        try {
            const scrumRes = await scrumAPI.getActive();
            setActiveScrums(scrumRes.data.sessions);
        } catch (err) {
            console.error('Failed to fetch scrums:', err);
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
            {incompleteAttendance && (
                <div className="alert alert-warning" style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <FaExclamationTriangle />
                    <span>⚠️ Incomplete Attendance Record - Please check your previous clock-outs.</span>
                </div>
            )}

            {activeScrums.length > 0 && (
                <div className="active-scrums-section" style={{ marginBottom: '2rem' }}>
                    <h3 style={{ fontSize: '0.9rem', color: 'var(--gray-500)', marginBottom: '0.75rem', fontWeight: 600 }}>📡 LIVE SCRUM CALLS</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
                        {activeScrums.map(scrum => (
                            <ActiveScrumCard key={scrum._id || scrum.sessionId} scrum={scrum} />
                        ))}
                    </div>
                </div>
            )}

            {isAdmin
                ? <AdminDashboard stats={stats} activities={activities} analytics={analytics} />
                : <EmployeeDashboard stats={stats} analytics={analytics} />}
        </MainLayout>

    );
};

const AdminDashboard = ({ stats, activities, analytics }) => {
    const navigate = useNavigate();

    const statCards = [
        { label: 'Total Users', value: stats?.totalUsers || 0, icon: FaUsers, color: 'blue', link: '/employees' },
        { label: 'Active Users', value: stats?.activeUsers || 0, icon: FaUserCheck, color: 'green', link: '/employees?status=active' },
        { label: 'Today Attendance', value: stats?.todayAttendance || 0, icon: FaCalendarCheck, color: 'purple' },
        { label: 'Present Today', value: stats?.presentToday || 0, icon: FaUserClock, color: 'indigo' },
        { label: 'Pending Leaves', value: stats?.pendingLeaves || 0, icon: FaHourglassHalf, color: 'orange', link: '/leaves?status=pending' },
        { label: 'Approved Leaves (Month)', value: stats?.approvedLeavesThisMonth || 0, icon: FaUmbrellaBeach, color: 'pink' },
        { label: 'Tasks', value: stats?.totalTasks || 0, icon: FaTasks, color: 'blue', link: '/tasks' },
    ];


    return (
        <div className="dashboard">
            <div className="stats-grid">
                {statCards.map((card, index) => {
                    const IconComponent = card.icon;
                    return (
                        <div
                            key={index}
                            className={`stat-card stat-card-${card.color} ${card.link ? 'clickable' : ''}`}
                            onClick={() => card.link && navigate(card.link)}
                            style={card.link ? { cursor: 'pointer' } : {}}
                        >
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
                <h2 className="section-title">Quick Insights (Weekly)</h2>
                <div className="analytics-grid">
                    <AnalyticsCard
                        label="Tasks Completed"
                        value={analytics?.tasksCompletedWeek || 0}
                        icon={<FaCheckCircle />}
                        color="green"
                    />
                    <AnalyticsCard
                        label="Approved Leave Days"
                        value={analytics?.totalLeaveDaysMonth || 0}
                        icon={<FaUmbrellaBeach />}
                        color="pink"
                    />
                    <AnalyticsCard
                        label="Avg. Work Hours"
                        value={`${analytics?.avgHoursWeek || 0}h`}
                        icon={<FaUserClock />}
                        color="blue"
                    />
                    <AnalyticsCard
                        label="Standup Rate"
                        value={`${analytics?.standupRateToday || 0}%`}
                        icon={<FaClipboardList />}
                        color="orange"
                    />
                </div>
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
                                        <div className="activity-icon" style={{ color: getActivityColor(activity.type) }}>
                                            {getActivityIcon(activity.type)}
                                        </div>
                                        <div className="activity-content">
                                            <div className="activity-description">
                                                {activity.message}
                                            </div>
                                        </div>
                                        <div className="activity-date">
                                            {new Date(activity.timestamp).toLocaleString()}
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

const EmployeeDashboard = ({ stats, analytics }) => {
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
                <h2 className="section-title">My Insights (This Week)</h2>
                <div className="analytics-grid">
                    <AnalyticsCard
                        label="Tasks Completed"
                        value={analytics?.tasksCompletedWeek || 0}
                        icon={<FaCheckCircle />}
                        color="green"
                    />
                    <AnalyticsCard
                        label="Leave Days"
                        value={analytics?.totalLeaveDaysMonth || 0}
                        icon={<FaUmbrellaBeach />}
                        color="pink"
                    />
                    <AnalyticsCard
                        label="Avg. Work Hours"
                        value={`${analytics?.avgHoursWeek || 0}h`}
                        icon={<FaUserClock />}
                        color="blue"
                    />
                </div>
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

const getActivityIcon = (type) => {
    switch (type) {
        case 'attendance': return <FaCalendarCheck />;
        case 'leave': return <FaUmbrellaBeach />;
        case 'task': return <FaTasks />;
        case 'standup': return <FaClipboardList />;
        case 'user': return <FaUserPlus />;
        default: return <FaChartLine />;
    }
};

const getActivityColor = (type) => {
    switch (type) {
        case 'attendance': return '#6366f1';
        case 'leave': return '#ec4899';
        case 'task': return '#10b981';
        case 'standup': return '#f59e0b';
        case 'user': return '#3b82f6';
        default: return '#94a3b8';
    }
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

const AnalyticsCard = ({ label, value, icon, color }) => (
    <div className={`analytics-card analytics-card-${color}`}>
        <div className="analytics-icon">{icon}</div>
        <div className="analytics-content">
            <div className="analytics-value">{value}</div>
            <div className="analytics-label">{label}</div>
        </div>
    </div>
);

const ActiveScrumCard = ({ scrum }) => {
    const handleJoin = async () => {
        try {
            await scrumAPI.join(scrum._id || scrum.sessionId);
            window.open(scrum.meet_link, '_blank');
        } catch (err) {
            console.error('Join failed:', err);
            window.open(scrum.meet_link, '_blank'); // Open anyway if join fail persistently
        }
    };

    return (
        <div className="active-scrum-card" style={{
            background: 'white',
            padding: '1.25rem',
            borderRadius: '12px',
            borderLeft: '4px solid #6366f1',
            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
        }}>
            <div>
                <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>{scrum.title}</h4>
                <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: 'var(--gray-500)' }}>
                    Started by {scrum.started_by?.name || scrum.started_by || 'Manager'}
                </p>
            </div>
            <button
                onClick={handleJoin}
                style={{
                    background: '#6366f1',
                    color: 'white',
                    border: 'none',
                    padding: '0.5rem 1rem',
                    borderRadius: '6px',
                    fontWeight: 600,
                    cursor: 'pointer'
                }}
            >
                Join Now
            </button>
        </div>
    );
};

export default Dashboard;
