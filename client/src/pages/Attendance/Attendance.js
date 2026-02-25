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
    const [sortKey, setSortKey] = useState('date');
    const [sortDir, setSortDir] = useState('desc');

    // Export state
    const now = new Date();
    const [exportMonth, setExportMonth] = useState(now.getMonth() + 1);
    const [exportYear, setExportYear] = useState(now.getFullYear());
    const [exporting, setExporting] = useState(false);
    const [exportError, setExportError] = useState('');
    const [exportRange, setExportRange] = useState({ startDate: '', endDate: '' });


    useEffect(() => {
        fetchRecords();
    }, [filters]); // eslint-disable-line react-hooks/exhaustive-deps

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

    const toggleSort = (key) => {
        if (sortKey === key) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
        else { setSortKey(key); setSortDir('desc'); }
    };

    const sortedRecords = [...records].sort((a, b) => {
        const multi = sortDir === 'desc' ? -1 : 1;
        let valA = a[sortKey];
        let valB = b[sortKey];

        // Handle case-insensitive comparison for strings
        if (typeof valA === 'string') valA = valA.toLowerCase();
        if (typeof valB === 'string') valB = valB.toLowerCase();

        if (valA < valB) return -1 * multi;
        if (valA > valB) return 1 * multi;
        return 0;
    });

    // ── Monthly Export Handler ─────────────────────────────────────────────────
    const handleExport = async () => {
        setExporting(true);
        setExportError('');
        try {
            const response = await attendanceAPI.exportMonthly(exportMonth, exportYear);
            const blob = new Blob([response.data], {
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            const monthStr = String(exportMonth).padStart(2, '0');
            link.href = url;
            link.download = `attendance_${exportYear}_${monthStr}.xlsx`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (err) {
            console.error('Export failed:', err);
            setExportError('Export failed. You may not have admin access.');
        } finally {
            setExporting(false);
        }
    };

    const handleExportRange = async () => {
        if (!exportRange.startDate || !exportRange.endDate) {
            setExportError('Please select both start and end dates');
            return;
        }
        setExporting(true);
        setExportError('');
        try {
            const response = await attendanceAPI.exportRange(exportRange.startDate, exportRange.endDate);
            const blob = new Blob([response.data], {
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `attendance_range_${exportRange.startDate}_to_${exportRange.endDate}.xlsx`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (err) {
            console.error('Range export failed:', err);
            setExportError('Export failed. Check console for details.');
        } finally {
            setExporting(false);
        }
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

    const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];

    // Build year list: current year ± 2
    const currentYear = new Date().getFullYear();
    const yearOptions = [currentYear - 2, currentYear - 1, currentYear, currentYear + 1];

    return (
        <MainLayout title="Attendance Management">
            <div className="employees-page">

                {/* ── Filters + Actions Row ───────────────────────────────── */}
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

                {/* ── Monthly Export Panel ────────────────────────────────── */}
                <div
                    className="card"
                    style={{
                        marginBottom: '1.5rem',
                        padding: '1rem 1.5rem',
                        background: 'linear-gradient(135deg, #1a2f50 0%, #0f1e35 100%)',
                        borderRadius: 'var(--radius)',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.18)'
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                        <span style={{ color: '#e2e8f0', fontWeight: 600, fontSize: '0.95rem', whiteSpace: 'nowrap' }}>
                            📊 Download Monthly Attendance
                        </span>

                        {/* Month selector */}
                        <select
                            id="export-month"
                            className="form-select"
                            value={exportMonth}
                            onChange={(e) => setExportMonth(Number(e.target.value))}
                            style={{ minWidth: '130px' }}
                        >
                            {monthNames.map((m, i) => (
                                <option key={i + 1} value={i + 1}>{m}</option>
                            ))}
                        </select>

                        {/* Year selector */}
                        <select
                            id="export-year"
                            className="form-select"
                            value={exportYear}
                            onChange={(e) => setExportYear(Number(e.target.value))}
                            style={{ minWidth: '90px' }}
                        >
                            {yearOptions.map(y => (
                                <option key={y} value={y}>{y}</option>
                            ))}
                        </select>

                        {/* Export button */}
                        <button
                            id="btn-export-monthly"
                            className="btn btn-primary"
                            onClick={handleExport}
                            disabled={exporting}
                            style={{
                                background: exporting ? '#4a5568' : '#3b82f6',
                                border: 'none',
                                whiteSpace: 'nowrap'
                            }}
                        >
                            {exporting ? '⏳ Generating...' : '⬇️ Export Excel'}
                        </button>

                        {exportError && (
                            <span style={{ color: '#fc8181', fontSize: '0.875rem' }}>{exportError}</span>
                        )}
                    </div>

                    <div style={{
                        marginTop: '1rem',
                        paddingTop: '1rem',
                        borderTop: '1px solid rgba(255,255,255,0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '1rem'
                    }}>
                        <span style={{ color: '#e2e8f0', fontWeight: 600, fontSize: '0.95rem', whiteSpace: 'nowrap' }}>
                            📅 Custom Date Range
                        </span>

                        <input
                            type="date"
                            className="form-input"
                            value={exportRange.startDate}
                            onChange={(e) => setExportRange({ ...exportRange, startDate: e.target.value })}
                            style={{ minWidth: '150px' }}
                        />

                        <span style={{ color: '#e2e8f0' }}>to</span>

                        <input
                            type="date"
                            className="form-input"
                            value={exportRange.endDate}
                            onChange={(e) => setExportRange({ ...exportRange, endDate: e.target.value })}
                            style={{ minWidth: '150px' }}
                        />

                        <button
                            id="btn-export-range"
                            className="btn btn-secondary"
                            onClick={handleExportRange}
                            disabled={exporting}
                            style={{
                                background: exporting ? '#2d3748' : '#6366f1',
                                color: 'white',
                                border: 'none',
                                whiteSpace: 'nowrap'
                            }}
                        >
                            {exporting ? '⏳ Generating...' : '⬇️ Export Range'}
                        </button>
                    </div>
                </div>

                {/* ── Attendance Records Table ────────────────────────────── */}
                <div className="card">
                    <div className="table-container">
                        <table className="table">
                            <thead>
                                <tr>
                                    <SortTh label="Date" k="date" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
                                    <SortTh label="Employee" k="user_name" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
                                    <SortTh label="Department" k="department" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
                                    <SortTh label="Status" k="status" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
                                    <th>Clock In</th>
                                    <th>Clock Out</th>
                                    <th>Total Hours</th>
                                    <th>Notes</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sortedRecords.length === 0 ? (
                                    <tr>
                                        <td colSpan="8" className="text-center" style={{ padding: '2rem', color: 'var(--gray-500)' }}>
                                            No attendance records found
                                        </td>
                                    </tr>
                                ) : (
                                    sortedRecords.map((record) => (
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
                                            <td>
                                                {record.totalHours != null
                                                    ? `${record.totalHours} hrs`
                                                    : (record.check_in_time && record.check_out_time
                                                        ? calcHours(record.check_in_time, record.check_out_time)
                                                        : '-')}
                                            </td>
                                            <td>{record.notes || '-'}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
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
            </div>
        </MainLayout>
    );
};

// ── Mark-Attendance Modal ──────────────────────────────────────────────────────
const AttendanceModal = ({ onClose, onSuccess }) => {
    const [formData, setFormData] = useState({
        date: new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }),
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

// ── Helpers ───────────────────────────────────────────────────────────────────
const SortTh = ({ label, k, sortKey, sortDir, onClick }) => (
    <th onClick={() => onClick(k)} style={{ cursor: 'pointer', userSelect: 'none' }} title={`Sort by ${label}`}>
        {label}
        <span style={{ marginLeft: '0.5rem', opacity: sortKey === k ? 1 : 0.3 }}>
            {sortKey === k ? (sortDir === 'desc' ? '↓' : '↑') : '⇅'}
        </span>
    </th>
);
const calcHours = (checkIn, checkOut) => {
    if (!checkIn || !checkOut) return '-';
    const [ih, im] = checkIn.split(':').map(Number);
    const [oh, om] = checkOut.split(':').map(Number);
    const diff = (oh * 60 + om) - (ih * 60 + im);
    if (diff <= 0) return '-';
    return `${(diff / 60).toFixed(2)} hrs`;
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
