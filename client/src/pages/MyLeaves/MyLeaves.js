import React, { useState, useEffect } from 'react';
import MainLayout from '../../components/Layout/MainLayout';
import Modal from '../../components/Modal/Modal';
import { leaveAPI } from '../../api/api';
import '../Employees/Employees.css';

const MyLeaves = () => {
    const [leaves, setLeaves] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);

    useEffect(() => {
        fetchLeaves();
    }, []);

    const fetchLeaves = async () => {
        try {
            const response = await leaveAPI.getAll();
            setLeaves(response.data.leaves);
        } catch (error) {
            console.error('Failed to fetch leaves:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this leave request?')) return;

        try {
            await leaveAPI.delete(id);
            fetchLeaves();
        } catch (error) {
            alert(error.response?.data?.message || 'Failed to delete leave request');
        }
    };

    if (loading) {
        return (
            <MainLayout title="My Leaves">
                <div className="loader-container">
                    <div className="loader"></div>
                </div>
            </MainLayout>
        );
    }

    return (
        <MainLayout title="My Leaves">
            <div className="employees-page">
                <div className="page-header">
                    <div></div>
                    <button className="btn btn-primary" onClick={() => setShowModal(true)}>
                        ➕ Request Leave
                    </button>
                </div>

                <div className="card">
                    <div className="table-container">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Type</th>
                                    <th>Start Date</th>
                                    <th>End Date</th>
                                    <th>Days</th>
                                    <th>Reason</th>
                                    <th>Status</th>
                                    <th>Review Notes</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {leaves.length === 0 ? (
                                    <tr>
                                        <td colSpan="8" className="text-center" style={{ padding: '2rem', color: 'var(--gray-500)' }}>
                                            No leave requests found
                                        </td>
                                    </tr>
                                ) : (
                                    leaves.map((leave) => (
                                        <tr key={leave.id}>
                                            <td>
                                                <span className="badge badge-info">
                                                    {leave.leave_type}
                                                </span>
                                            </td>
                                            <td>{new Date(leave.start_date).toLocaleDateString()}</td>
                                            <td>{new Date(leave.end_date).toLocaleDateString()}</td>
                                            <td>{leave.days}</td>
                                            <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {leave.reason}
                                            </td>
                                            <td>
                                                <span className={`badge badge-${getStatusColor(leave.status)}`}>
                                                    {leave.status}
                                                </span>
                                            </td>
                                            <td>{leave.review_notes || '-'}</td>
                                            <td>
                                                {leave.status === 'pending' && (
                                                    <button
                                                        className="btn btn-sm btn-danger"
                                                        onClick={() => handleDelete(leave.id)}
                                                    >
                                                        🗑️ Delete
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {showModal && (
                <LeaveRequestModal
                    onClose={() => setShowModal(false)}
                    onSuccess={() => {
                        fetchLeaves();
                        setShowModal(false);
                    }}
                />
            )}
        </MainLayout>
    );
};

const LeaveRequestModal = ({ onClose, onSuccess }) => {
    const [formData, setFormData] = useState({
        leave_type: 'casual',
        start_date: '',
        end_date: '',
        days: 1,
        reason: ''
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData({ ...formData, [name]: value });

        // Auto-calculate days when dates change
        if (name === 'start_date' || name === 'end_date') {
            const startDate = name === 'start_date' ? new Date(value) : new Date(formData.start_date);
            const endDate = name === 'end_date' ? new Date(value) : new Date(formData.end_date);

            if (startDate && endDate && endDate >= startDate) {
                const diffTime = Math.abs(endDate - startDate);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
                setFormData(prev => ({ ...prev, days: diffDays }));
            }
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            await leaveAPI.create(formData);
            onSuccess();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to create leave request');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            isOpen={true}
            onClose={onClose}
            title="Request Leave"
            footer={
                <>
                    <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
                    <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
                        {loading ? 'Submitting...' : 'Submit Request'}
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
                    <label className="form-label">Leave Type *</label>
                    <select name="leave_type" value={formData.leave_type} onChange={handleChange} className="form-select" required>
                        <option value="casual">Casual Leave</option>
                        <option value="sick">Sick Leave</option>
                        <option value="vacation">Vacation</option>
                        <option value="unpaid">Unpaid Leave</option>
                    </select>
                </div>

                <div className="form-group">
                    <label className="form-label">Start Date *</label>
                    <input
                        type="date"
                        name="start_date"
                        value={formData.start_date}
                        onChange={handleChange}
                        className="form-input"
                        required
                    />
                </div>

                <div className="form-group">
                    <label className="form-label">End Date *</label>
                    <input
                        type="date"
                        name="end_date"
                        value={formData.end_date}
                        onChange={handleChange}
                        className="form-input"
                        min={formData.start_date}
                        required
                    />
                </div>

                <div className="form-group">
                    <label className="form-label">Number of Days</label>
                    <input
                        type="number"
                        name="days"
                        value={formData.days}
                        onChange={handleChange}
                        className="form-input"
                        min="1"
                        required
                        readOnly
                    />
                </div>

                <div className="form-group">
                    <label className="form-label">Reason *</label>
                    <textarea
                        name="reason"
                        value={formData.reason}
                        onChange={handleChange}
                        className="form-textarea"
                        rows="4"
                        required
                        placeholder="Please provide a reason for your leave request..."
                    ></textarea>
                </div>
            </form>
        </Modal>
    );
};

const getStatusColor = (status) => {
    const colorMap = {
        'pending': 'warning',
        'approved': 'success',
        'rejected': 'danger'
    };
    return colorMap[status] || 'gray';
};

export default MyLeaves;
