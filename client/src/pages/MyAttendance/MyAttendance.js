import React, { useState, useEffect, useCallback } from 'react';
import MainLayout from '../../components/Layout/MainLayout';
import { attendanceAPI, calendarAPI } from '../../api/api';
import '../Employees/Employees.css';
import './MyAttendance.css';

const MyAttendance = () => {
    const [records, setRecords] = useState([]);
    const [todayRecord, setTodayRecord] = useState(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [filters, setFilters] = useState({ start_date: '', end_date: '' });
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const fetchRecords = useCallback(async () => {
        try {
            const response = await attendanceAPI.getAll(filters);
            setRecords(response.data.records);
        } catch (error) {
            console.error('Failed to fetch attendance:', error);
        } finally {
            setLoading(false);
        }
    }, [filters]);

    const fetchTodayStatus = useCallback(async () => {
        try {
            const response = await attendanceAPI.getToday();
            setTodayRecord(response.data.record);
        } catch (error) {
            console.error('Failed to fetch today status:', error);
        }
    }, []);

    useEffect(() => {
        fetchRecords();
        fetchTodayStatus();
    }, [fetchRecords, fetchTodayStatus]);

    const handleFilterChange = (key, value) => {
        setFilters({ ...filters, [key]: value });
    };

    const handleClockIn = async () => {
        setError('');
        setSuccess('');
        setActionLoading(true);

        try {
            const response = await attendanceAPI.clockIn();
            setSuccess(response.data.message);
            setTodayRecord(response.data.record);
            fetchRecords(); // Refresh the list
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to clock in');
        } finally {
            setActionLoading(false);
        }
    };

    const handleClockOut = async () => {
        setError('');
        setSuccess('');
        setActionLoading(true);

        try {
            const response = await attendanceAPI.clockOut();
            setSuccess(response.data.message);
            setTodayRecord(response.data.record);
            fetchRecords(); // Refresh the list
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to clock out');
        } finally {
            setActionLoading(false);
        }
    };

    const canClockIn = !todayRecord;
    const canClockOut = todayRecord && todayRecord.check_in_time && !todayRecord.check_out_time;

    const getCurrentDate = () => {
        return new Date().toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };

    const getCurrentTime = () => {
        return new Date().toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    };

    const [currentTime, setCurrentTime] = useState(getCurrentTime());

    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(getCurrentTime());
        }, 1000);

        return () => clearInterval(timer);
    }, []);

    if (loading) {
        return (
            <MainLayout title="My Attendance">
                <div className="loader-container">
                    <div className="loader"></div>
                </div>
            </MainLayout>
        );
    }

    return (
        <MainLayout title="My Attendance">
            <div className="employees-page">
                {/* Clock In/Out Card */}
                <div className="clock-card">
                    <div className="clock-header">
                        <div className="clock-date-time">
                            <div className="current-date">{getCurrentDate()}</div>
                            <div className="current-time">{currentTime}</div>
                        </div>
                        <div className="clock-status">
                            {todayRecord ? (
                                <div className="status-badge status-clocked-in">
                                    ✓ Clocked In
                                </div>
                            ) : (
                                <div className="status-badge status-not-clocked">
                                    • Not Clocked In
                                </div>
                            )}
                        </div>
                    </div>

                    {(error || success) && (
                        <div className={`alert ${error ? 'alert-error' : 'alert-success'}`}>
                            {error || success}
                        </div>
                    )}

                    <div className="clock-details">
                        {todayRecord ? (
                            <div className="time-info">
                                <div className="time-item">
                                    <span className="time-label">Clock In:</span>
                                    <span className="time-value">{todayRecord.check_in_time || '-'}</span>
                                </div>
                                <div className="time-divider"></div>
                                <div className="time-item">
                                    <span className="time-label">Clock Out:</span>
                                    <span className="time-value">{todayRecord.check_out_time || 'Not yet'}</span>
                                </div>
                                {todayRecord.check_in_time && todayRecord.check_out_time && (
                                    <>
                                        <div className="time-divider"></div>
                                        <div className="time-item">
                                            <span className="time-label">Total Hours:</span>
                                            <span className="time-value">
                                                {calculateHours(todayRecord.check_in_time, todayRecord.check_out_time)}
                                            </span>
                                        </div>
                                    </>
                                )}
                            </div>
                        ) : (
                            <div className="no-record-message">
                                <p>You haven't clocked in today yet</p>
                            </div>
                        )}
                    </div>

                    <div className="clock-actions">
                        {canClockIn && (
                            <button
                                className="btn btn-primary btn-lg clock-btn"
                                onClick={handleClockIn}
                                disabled={actionLoading}
                            >
                                {actionLoading ? '⏳ Processing...' : '🕐 Clock In'}
                            </button>
                        )}
                        {canClockOut && (
                            <button
                                className="btn btn-danger btn-lg clock-btn"
                                onClick={handleClockOut}
                                disabled={actionLoading}
                            >
                                {actionLoading ? '⏳ Processing...' : '🕐 Clock Out'}
                            </button>
                        )}
                        {todayRecord && todayRecord.check_out_time && (
                            <div className="completed-message">
                                <span className="check-icon">✅</span>
                                <span>You've completed your attendance for today</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Filters */}
                <div className="page-header" style={{ marginTop: '2rem' }}>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: '600', color: 'var(--gray-700)' }}>
                        Attendance History
                    </h2>
                    <div className="page-filters">
                        <input
                            type="date"
                            className="form-input"
                            value={filters.start_date}
                            onChange={(e) => handleFilterChange('start_date', e.target.value)}
                            placeholder="Start Date"
                        />
                        <input
                            type="date"
                            className="form-input"
                            value={filters.end_date}
                            onChange={(e) => handleFilterChange('end_date', e.target.value)}
                            placeholder="End Date"
                        />
                    </div>
                </div>

                {/* Attendance Records Table */}
                <div className="card">
                    <div className="table-container">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Status</th>
                                    <th>Clock In</th>
                                    <th>Clock Out</th>
                                    <th>Hours Worked</th>
                                </tr>
                            </thead>
                            <tbody>
                                {records.length === 0 ? (
                                    <tr>
                                        <td colSpan="5" className="text-center" style={{ padding: '2rem', color: 'var(--gray-500)' }}>
                                            No attendance records found
                                        </td>
                                    </tr>
                                ) : (
                                    records.map((record) => (
                                        <tr key={record.id}>
                                            <td>{new Date(record.date).toLocaleDateString()}</td>
                                            <td>
                                                <span className={`badge badge-${getStatusColor(record.status)}`}>
                                                    {record.status}
                                                </span>
                                            </td>
                                            <td>{record.check_in_time || '-'}</td>
                                            <td>{record.check_out_time || '-'}</td>
                                            <td>
                                                {record.check_in_time && record.check_out_time
                                                    ? calculateHours(record.check_in_time, record.check_out_time)
                                                    : '-'}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Info Card */}
                <div className="card info-card" style={{ marginTop: '1.5rem' }}>
                    <div className="card-body">
                        <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1rem', color: 'var(--gray-700)' }}>
                            ℹ️ Clock-In/Out Guidelines
                        </h3>
                        <ul style={{ margin: 0, paddingLeft: '1.5rem', color: 'var(--gray-600)', fontSize: '0.875rem' }}>
                            <li>You can only clock in once per day for the current date</li>
                            <li>Clock out is only available after you have clocked in</li>
                            <li>Clock-in and clock-out are restricted to today's date only</li>
                            <li>Your attendance will automatically be marked as "present" when you clock in</li>
                        </ul>
                    </div>
                </div>
            </div>
        </MainLayout>
    );
};

// Helper function to calculate hours worked
const calculateHours = (checkIn, checkOut) => {
    if (!checkIn || !checkOut) return '-';

    const [inHours, inMinutes] = checkIn.split(':').map(Number);
    const [outHours, outMinutes] = checkOut.split(':').map(Number);

    const inTotalMinutes = inHours * 60 + inMinutes;
    const outTotalMinutes = outHours * 60 + outMinutes;

    const diffMinutes = outTotalMinutes - inTotalMinutes;
    const hours = Math.floor(diffMinutes / 60);
    const minutes = diffMinutes % 60;

    return `${hours}h ${minutes}m`;
};

const getStatusColor = (status) => {
    const colorMap = {
        'present': 'success',
        'absent': 'danger',
        'half-day': 'warning',
        'leave': 'info'
    };
    return colorMap[status] || 'gray';
};

export default MyAttendance;
