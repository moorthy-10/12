import React, { useState, useEffect } from 'react';
import MainLayout from '../../components/Layout/MainLayout';
import Modal from '../../components/Modal/Modal';
import { attendanceAPI } from '../../api/api';
import '../Employees/Employees.css';

const Attendance = () => {
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({ start_date: '', end_date: '', status: '' });
    const [showModal, setShowModal] = useState(false);

    useEffect(() => {
        fetchRecords();
    }, [filters]);

    const fetchRecords = async () => {
        try {
            const response = await attendanceAPI.getAll(filters);
            setRecords(response.data.records);
        } catch (error) {
            console.error('Failed to fetch attendance:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleFilterChange = (key, value) => {
        setFilters({ ...filters, [key]: value });
    };

    if (loading) {
        return (
            <MainLayout title="Attendance Management">
                <div className="loader-container">
                    <div className="loader"></div>
                </div>
            </MainLayout>
        );
    }

    return (
        <MainLayout title="Attendance Management">
            <div className="employees-page">
                <div className="page-header">
                    <div className="page-filters">
                        <input
                            type="date"
                            className="form-input"
                            value={filters.start_date}
                            onChange={(e) => handleFilterChange('start_date', e.target.value)}
                        />
                        <input
                            type="date"
                            className="form-input"
                            value={filters.end_date}
                            onChange={(e) => handleFilterChange('end_date', e.target.value)}
                        />
                        <select
                            className="form-select"
                            value={filters.status}
                            onChange={(e) => handleFilterChange('status', e.target.value)}
                        >
                            <option value="">All Status</option>
                            <option value="present">Present</option>
                            <option value="absent">Absent</option>
                            <option value="half-day">Half Day</option>
                            <option value="leave">Leave</option>
                        </select>
                    </div>
                    <button className="btn btn-primary" onClick={() => setShowModal(true)}>
                        ➕ Mark Attendance
                    </button>
                </div>

                <div className="card">
                    <div className="table-container">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Employee</th>
                                    <th>Department</th>
                                    <th>Status</th>
                                    <th>Check In</th>
                                    <th>Check Out</th>
                                    <th>Notes</th>
                                </tr>
                            </thead>
                            <tbody>
                                {records.length === 0 ? (
                                    <tr>
                                        <td colSpan="7" className="text-center" style={{ padding: '2rem', color: 'var(--gray-500)' }}>
                                            No attendance records found
                                        </td>
                                    </tr>
                                ) : (
                                    records.map((record) => (
                                        <tr key={record.id}>
                                            <td>{new Date(record.date).toLocaleDateString()}</td>
                                            <td>{record.user_name}</td>
                                            <td>{record.department || '-'}</td>
                                            <td>
                                                <span className={`badge badge-${getStatusColor(record.status)}`}>
                                                    {record.status}
                                                </span>
                                            </td>
                                            <td>{record.check_in_time || '-'}</td>
                                            <td>{record.check_out_time || '-'}</td>
                                            <td>{record.notes || '-'}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {showModal && (
                <AttendanceModal
                    onClose={() => setShowModal(false)}
                    onSuccess={() => {
                        fetchRecords();
                        setShowModal(false);
                    }}
                />
            )}
        </MainLayout>
    );
};

const AttendanceModal = ({ onClose, onSuccess }) => {
    const [formData, setFormData] = useState({
        date: new Date().toISOString().split('T')[0],
        status: 'present',
        check_in_time: '',
        check_out_time: '',
        notes: ''
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            await attendanceAPI.create(formData);
            onSuccess();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to mark attendance');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            isOpen={true}
            onClose={onClose}
            title="Mark Attendance"
            footer={
                <>
                    <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
                    <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
                        {loading ? 'Saving...' : 'Save'}
                    </button>
                </>
            }
        >
            <form onSubmit={handleSubmit}>
                {error && (
                    <div className="form-error" style={{ marginBottom: '1rem', padding: '0.75rem', background: 'var(--danger-light)', borderRadius: 'var(--radius)' }}>
                        {error}
                    </div>
                )}

                <div className="form-group">
                    <label className="form-label">Date *</label>
                    <input
                        type="date"
                        name="date"
                        value={formData.date}
                        onChange={handleChange}
                        className="form-input"
                        required
                    />
                </div>

                <div className="form-group">
                    <label className="form-label">Status *</label>
                    <select name="status" value={formData.status} onChange={handleChange} className="form-select" required>
                        <option value="present">Present</option>
                        <option value="absent">Absent</option>
                        <option value="half-day">Half Day</option>
                        <option value="leave">Leave</option>
                    </select>
                </div>

                <div className="form-group">
                    <label className="form-label">Check In Time</label>
                    <input
                        type="time"
                        name="check_in_time"
                        value={formData.check_in_time}
                        onChange={handleChange}
                        className="form-input"
                    />
                </div>

                <div className="form-group">
                    <label className="form-label">Check Out Time</label>
                    <input
                        type="time"
                        name="check_out_time"
                        value={formData.check_out_time}
                        onChange={handleChange}
                        className="form-input"
                    />
                </div>

                <div className="form-group">
                    <label className="form-label">Notes</label>
                    <textarea
                        name="notes"
                        value={formData.notes}
                        onChange={handleChange}
                        className="form-textarea"
                        rows="3"
                    ></textarea>
                </div>
            </form>
        </Modal>
    );
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

export default Attendance;
