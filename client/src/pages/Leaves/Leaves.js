import React, { useState, useEffect } from 'react';
import MainLayout from '../../components/Layout/MainLayout';
import Modal from '../../components/Modal/Modal';
import { leaveAPI } from '../../api/api';
import '../Employees/Employees.css';

const Leaves = () => {
    const [leaves, setLeaves] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({ status: '', leave_type: '' });
    const [showModal, setShowModal] = useState(false);
    const [reviewingLeave, setReviewingLeave] = useState(null);
    const [sortKey, setSortKey] = useState('start_date');
    const [sortDir, setSortDir] = useState('desc');

    useEffect(() => {
        fetchLeaves();
    }, [filters]);

    const fetchLeaves = async () => {
        try {
            const response = await leaveAPI.getAll(filters);
            setLeaves(response.data.leaves);
        } catch (error) {
            console.error('Failed to fetch leaves:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleFilterChange = (key, value) => {
        setFilters({ ...filters, [key]: value });
    };

    const handleReview = (leave) => {
        setReviewingLeave(leave);
    };

    const toggleSort = (key) => {
        if (sortKey === key) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
        else { setSortKey(key); setSortDir('desc'); }
    };

    const sortedLeaves = [...leaves].sort((a, b) => {
        const multi = sortDir === 'desc' ? -1 : 1;
        let valA = a[sortKey] || '';
        let valB = b[sortKey] || '';

        if (typeof valA === 'string') valA = valA.toLowerCase();
        if (typeof valB === 'string') valB = valB.toLowerCase();

        if (valA < valB) return -1 * multi;
        if (valA > valB) return 1 * multi;
        return 0;
    });

    if (loading) {
        return (
            <MainLayout title="Leave Requests">
                <div className="loader-container">
                    <div className="loader"></div>
                </div>
            </MainLayout>
        );
    }

    return (
        <MainLayout title="Leave Requests">
            <div className="employees-page">
                <div className="page-header">
                    <div className="page-filters">
                        <select
                            className="form-select"
                            value={filters.status}
                            onChange={(e) => handleFilterChange('status', e.target.value)}
                        >
                            <option value="">All Status</option>
                            <option value="pending">Pending</option>
                            <option value="approved">Approved</option>
                            <option value="rejected">Rejected</option>
                        </select>

                        <select
                            className="form-select"
                            value={filters.leave_type}
                            onChange={(e) => handleFilterChange('leave_type', e.target.value)}
                        >
                            <option value="">All Types</option>
                            <option value="sick">Sick Leave</option>
                            <option value="casual">Casual Leave</option>
                            <option value="vacation">Vacation</option>
                            <option value="unpaid">Unpaid Leave</option>
                        </select>
                    </div>
                </div>

                <div className="card">
                    <div className="table-container">
                        <table className="table">
                            <thead>
                                <tr>
                                    <SortTh label="Employee" k="user_name" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
                                    <SortTh label="Type" k="leave_type" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
                                    <SortTh label="Start Date" k="start_date" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
                                    <SortTh label="End Date" k="end_date" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
                                    <SortTh label="Days" k="days" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
                                    <th>Reason</th>
                                    <SortTh label="Status" k="status" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sortedLeaves.length === 0 ? (
                                    <tr>
                                        <td colSpan="8" className="text-center" style={{ padding: '2rem', color: 'var(--gray-500)' }}>
                                            No leave requests found
                                        </td>
                                    </tr>
                                ) : (
                                    sortedLeaves.map((leave) => (
                                        <tr key={leave.id}>
                                            <td>{leave.user_name}</td>
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
                                            <td>
                                                {leave.status === 'pending' && (
                                                    <button
                                                        className="btn btn-sm btn-primary"
                                                        onClick={() => handleReview(leave)}
                                                    >
                                                        ✅ Review
                                                    </button>
                                                )}
                                                {leave.status !== 'pending' && leave.reviewer_name && (
                                                    <small style={{ color: 'var(--gray-500)' }}>
                                                        By {leave.reviewer_name}
                                                    </small>
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

            {reviewingLeave && (
                <ReviewModal
                    leave={reviewingLeave}
                    onClose={() => setReviewingLeave(null)}
                    onSuccess={() => {
                        fetchLeaves();
                        setReviewingLeave(null);
                    }}
                />
            )}
        </MainLayout>
    );
};

const ReviewModal = ({ leave, onClose, onSuccess }) => {
    const [formData, setFormData] = useState({
        status: 'approved',
        review_notes: ''
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
            await leaveAPI.review(leave.id, formData);
            onSuccess();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to review leave request');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            isOpen={true}
            onClose={onClose}
            title="Review Leave Request"
            footer={
                <>
                    <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
                    <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
                        {loading ? 'Saving...' : 'Submit Review'}
                    </button>
                </>
            }
        >
            <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ padding: '1rem', background: 'var(--gray-50)', borderRadius: 'var(--radius)', marginBottom: '1rem' }}>
                    <div style={{ marginBottom: '0.5rem' }}>
                        <strong>Employee:</strong> {leave.user_name}
                    </div>
                    <div style={{ marginBottom: '0.5rem' }}>
                        <strong>Type:</strong> {leave.leave_type}
                    </div>
                    <div style={{ marginBottom: '0.5rem' }}>
                        <strong>Duration:</strong> {new Date(leave.start_date).toLocaleDateString()} - {new Date(leave.end_date).toLocaleDateString()} ({leave.days} days)
                    </div>
                    <div>
                        <strong>Reason:</strong> {leave.reason}
                    </div>
                </div>
            </div>

            <form onSubmit={handleSubmit}>
                {error && (
                    <div className="form-error" style={{ marginBottom: '1rem', padding: '0.75rem', background: 'var(--danger-light)', borderRadius: 'var(--radius)' }}>
                        {error}
                    </div>
                )}

                <div className="form-group">
                    <label className="form-label">Decision *</label>
                    <select name="status" value={formData.status} onChange={handleChange} className="form-select" required>
                        <option value="approved">Approve</option>
                        <option value="rejected">Reject</option>
                    </select>
                </div>

                <div className="form-group">
                    <label className="form-label">Notes (Optional)</label>
                    <textarea
                        name="review_notes"
                        value={formData.review_notes}
                        onChange={handleChange}
                        className="form-textarea"
                        rows="3"
                        placeholder="Add any comments or notes..."
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

export default Leaves;

// ── Helpers ───────────────────────────────────────────────────────────────────
const SortTh = ({ label, k, sortKey, sortDir, onClick }) => (
    <th onClick={() => onClick(k)} style={{ cursor: 'pointer', userSelect: 'none' }} title={`Sort by ${label}`}>
        {label}
        <span style={{ marginLeft: '0.5rem', opacity: sortKey === k ? 1 : 0.3 }}>
            {sortKey === k ? (sortDir === 'desc' ? '↓' : '↑') : '⇅'}
        </span>
    </th>
);
