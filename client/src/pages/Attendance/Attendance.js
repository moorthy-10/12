import React, { useState, useEffect } from 'react';
import MainLayout from '../../components/Layout/MainLayout';
import Modal from '../../components/Modal/Modal';
import { attendanceAPI, userAPI } from '../../api/api';
import { useAuth } from '../../context/AuthContext';
import '../Employees/Employees.css';

const Attendance = () => {
    const { user, isAdmin } = useAuth();
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({ start_date: '', end_date: '', status: '' });
    const [showModal, setShowModal] = useState(false);
    const [selectedRecord, setSelectedRecord] = useState(null);
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
        // Sync month/year selection to filters
        const firstDay = new Date(exportYear, exportMonth - 1, 1);
        const lastDay = new Date(exportYear, exportMonth, 0);

        const formatDate = (date) => {
            const y = date.getFullYear();
            const m = String(date.getMonth() + 1).padStart(2, '0');
            const d = String(date.getDate()).padStart(2, '0');
            return `${y}-${m}-${d}`;
        };

        setFilters(prev => ({
            ...prev,
            start_date: formatDate(firstDay),
            end_date: formatDate(lastDay)
        }));
    }, [exportMonth, exportYear]);

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

    const handleEdit = (record) => {
        setSelectedRecord(record);
        setShowModal(true);
    };

    const handleMarkAttendance = () => {
        setSelectedRecord(null);
        setShowModal(true);
    };

    const handleUnifiedReport = async (isExport = false) => {
        if (!filters.start_date || !filters.end_date) {
            setExportError('Please select a date range first');
            return;
        }

        if (isExport) setExporting(true);
        setExportError('');

        try {
            const params = {
                start: filters.start_date,
                end: filters.end_date,
                export: isExport ? 'true' : 'false',
                status: filters.status
            };

            const response = await attendanceAPI.getReport(params);

            if (isExport) {
                const blob = new Blob([response.data], {
                    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                });
                const url = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `attendance_report_${filters.start_date}_to_${filters.end_date}.xlsx`;
                document.body.appendChild(link);
                link.click();
                link.remove();
                window.URL.revokeObjectURL(url);
            } else {
                setRecords(response.data.records);
            }
        } catch (err) {
            console.error('Report failed:', err);
            setExportError('Operation failed. Check permissions.');
        } finally {
            if (isExport) setExporting(false);
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
    const yearOptions = [currentYear - 1, currentYear, currentYear + 1];

    return (
        <MainLayout title="Attendance Management">
            <div className="employees-page">

                {/* ── Unified Modern Toolbar ───────────────────────────────── */}
                <div className="card" style={{
                    marginBottom: '1.5rem',
                    padding: '1.25rem',
                    background: '#1e293b',
                    borderRadius: 'var(--radius)',
                    border: '1px solid rgba(255,255,255,0.05)'
                }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'flex-end' }}>

                        <div style={{ display: 'flex', gap: '0.5rem', flex: '1 1 auto' }}>
                            <div className="form-group" style={{ marginBottom: 0, minWidth: '140px' }}>
                                <label className="form-label" style={{ color: '#94a3b8', fontSize: '0.75rem' }}>Quick Month</label>
                                <select className="form-select" value={exportMonth} onChange={(e) => setExportMonth(Number(e.target.value))}>
                                    {monthNames.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
                                </select>
                            </div>
                            <div className="form-group" style={{ marginBottom: 0, minWidth: '90px' }}>
                                <label className="form-label" style={{ color: '#94a3b8', fontSize: '0.75rem' }}>Year</label>
                                <select className="form-select" value={exportYear} onChange={(e) => setExportYear(Number(e.target.value))}>
                                    {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
                                </select>
                            </div>
                        </div>

                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label" style={{ color: '#94a3b8', fontSize: '0.75rem' }}>Start Date</label>
                            <input type="date" className="form-input" value={filters.start_date} onChange={(e) => handleFilterChange('start_date', e.target.value)} />
                        </div>

                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label" style={{ color: '#94a3b8', fontSize: '0.75rem' }}>End Date</label>
                            <input type="date" className="form-input" value={filters.end_date} onChange={(e) => handleFilterChange('end_date', e.target.value)} />
                        </div>

                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label" style={{ color: '#94a3b8', fontSize: '0.75rem' }}>Status</label>
                            <select className="form-select" value={filters.status} onChange={(e) => handleFilterChange('status', e.target.value)}>
                                <option value="">All Status</option>
                                <option value="present">Present</option>
                                <option value="absent">Absent</option>
                                <option value="half-day">Half Day</option>
                                <option value="leave">Leave</option>
                            </select>
                        </div>

                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button className="btn btn-primary" onClick={() => handleUnifiedReport(false)} style={{ padding: '0.6rem 1rem' }}>
                                🔍 Search
                            </button>
                            <button
                                className="btn btn-secondary"
                                onClick={() => handleUnifiedReport(true)}
                                disabled={exporting}
                                style={{ background: '#475569', padding: '0.6rem 1rem' }}
                            >
                                {exporting ? '⏳...' : '⬇️ Excel'}
                            </button>
                            <button className="btn btn-primary" onClick={handleMarkAttendance} style={{ background: '#10b981', padding: '0.6rem 1rem' }}>
                                ➕ Mark
                            </button>
                        </div>
                    </div>
                    {exportError && <div style={{ color: '#fb7185', fontSize: '0.8rem', marginTop: '0.5rem' }}>⚠️ {exportError}</div>}
                </div>

                {/* ── Attendance Records Table ────────────────────────────── */}
                <div className="card">
                    <div className="table-container">
                        <table className="table">
                            <thead>
                                <tr>
                                    <SortTh label="Date" k="date" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
                                    <SortTh label="Employee" k="user_name" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
                                    <SortTh label="Dept" k="department" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
                                    <SortTh label="Status" k="status" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
                                    <th style={{ textAlign: 'center' }}>In</th>
                                    <th style={{ textAlign: 'center' }}>Out</th>
                                    <th style={{ textAlign: 'center' }}>Hours</th>
                                    <th>Notes</th>
                                    {isAdmin && <th style={{ textAlign: 'center' }}>Actions</th>}
                                </tr>
                            </thead>
                            <tbody>
                                {records.length === 0 ? (
                                    <tr>
                                        <td colSpan={isAdmin ? "9" : "8"} className="text-center" style={{ padding: '2rem', color: 'var(--gray-500)' }}>
                                            No attendance records found
                                        </td>
                                    </tr>
                                ) : (
                                    [...records].sort((a, b) => {
                                        const multi = sortDir === 'desc' ? -1 : 1;
                                        let valA = a[sortKey];
                                        let valB = b[sortKey];

                                        // Handle case-insensitive comparison for strings
                                        if (typeof valA === 'string') valA = valA.toLowerCase();
                                        if (typeof valB === 'string') valB = valB.toLowerCase();

                                        if (valA < valB) return -1 * multi;
                                        if (valA > valB) return 1 * multi;
                                        return 0;
                                    }).map((record) => (
                                        <tr key={record.id || record._id}>
                                            <td>{new Date(record.date).toLocaleDateString()}</td>
                                            <td>{record.user_name || record.user?.name}</td>
                                            <td>{record.department || record.user?.department || '-'}</td>
                                            <td>
                                                <span className={`badge badge-${getStatusColor(record.status)}`}>
                                                    {record.status}
                                                </span>
                                            </td>
                                            <td style={{ textAlign: 'center' }}>{record.check_in_time || '-'}</td>
                                            <td style={{ textAlign: 'center' }}>{record.check_out_time || '-'}</td>
                                            <td style={{ textAlign: 'center' }}>{(record.totalHours || 0).toFixed(1)}h</td>
                                            <td>{record.notes || '-'}</td>
                                            {isAdmin && (
                                                <td style={{ textAlign: 'center' }}>
                                                    <button className="btn btn-sm btn-outline-primary" onClick={() => handleEdit(record)}>Edit</button>
                                                </td>
                                            )}
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {showModal && (
                    <AttendanceModal
                        record={selectedRecord}
                        onClose={() => { setShowModal(false); setSelectedRecord(null); }}
                        onSuccess={() => { handleUnifiedReport(false); setShowModal(false); setSelectedRecord(null); }}
                    />
                )}
            </div>
        </MainLayout>
    );
};

// ── Attendance Override Modal (Admin) ──────────────────────────────────────────
const AttendanceModal = ({ record, onClose, onSuccess }) => {
    const { isAdmin } = useAuth();
    const [employees, setEmployees] = useState([]);

    // Safely extract UID even if populated
    const getUID = (user) => {
        if (!user) return '';
        return typeof user === 'object' ? (user._id || user.id) : user;
    };

    const [formData, setFormData] = useState({
        user_id: getUID(record?.user),
        date: record ? new Date(record.date).toISOString().split('T')[0] : new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }),
        status: record?.status || 'present',
        check_in: record?.check_in_time || '',
        check_out: record?.check_out_time || '',
        reason: record?.notes || ''
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (isAdmin) fetchEmployees();
    }, [isAdmin]);

    const fetchEmployees = async () => {
        try {
            const res = await userAPI.getAll();
            setEmployees(res.data.users);
        } catch (err) { console.error(err); }
    };

    const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const payload = { ...formData };
            if (formData.check_in) payload.check_in = `${formData.date}T${formData.check_in}`;
            if (formData.check_out) payload.check_out = `${formData.date}T${formData.check_out}`;

            if (isAdmin) await attendanceAPI.adminOverride(payload);
            else await attendanceAPI.create(formData);

            onSuccess();
        } catch (err) {
            setError(err.response?.data?.message || 'Update failed');
        } finally { setLoading(false); }
    };

    return (
        <Modal
            isOpen={true}
            onClose={onClose}
            title={record ? "Edit Attendance" : "Mark Attendance"}
            footer={
                <>
                    <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
                    <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>{loading ? 'Saving...' : 'Save'}</button>
                </>
            }
        >
            <form onSubmit={handleSubmit}>
                {error && <div className="form-error" style={{ background: '#fee2e2', color: '#dc2626', padding: '0.5rem', marginBottom: '1rem', borderRadius: '4px' }}>⚠️ {error}</div>}

                {isAdmin && !record && (
                    <div className="form-group">
                        <label className="form-label">Employee *</label>
                        <select name="user_id" value={formData.user_id} onChange={handleChange} className="form-select" required>
                            <option value="">-- Choose --</option>
                            {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
                        </select>
                    </div>
                )}

                {record && (
                    <div className="form-group">
                        <label className="form-label">Employee</label>
                        <input type="text" className="form-input" value={record.user_name || record.user?.name} disabled style={{ background: '#f8fafc' }} />
                    </div>
                )}

                <div className="form-group">
                    <label className="form-label">Date</label>
                    <input type="date" name="date" value={formData.date} onChange={handleChange} className="form-input" required disabled={!!record} />
                </div>

                <div className="form-group">
                    <label className="form-label">Status</label>
                    <select name="status" value={formData.status} onChange={handleChange} className="form-select" required>
                        <option value="present">Present</option>
                        <option value="absent">Absent</option>
                        <option value="half-day">Half Day</option>
                        <option value="leave">Leave</option>
                    </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div className="form-group">
                        <label className="form-label">Check In</label>
                        <input type="time" name="check_in" value={formData.check_in} onChange={handleChange} className="form-input" />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Check Out</label>
                        <input type="time" name="check_out" value={formData.check_out} onChange={handleChange} className="form-input" />
                    </div>
                </div>

                <div className="form-group">
                    <label className="form-label">Reason *</label>
                    <textarea name="reason" value={formData.reason} onChange={handleChange} className="form-textarea" rows="2" required></textarea>
                </div>
            </form>
        </Modal>
    );
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const SortTh = ({ label, k, sortKey, sortDir, onClick }) => (
    <th onClick={() => onClick(k)} style={{ cursor: 'pointer', whiteSpace: 'nowrap' }}>
        {label} <span style={{ opacity: sortKey === k ? 1 : 0.2 }}>{sortKey === k ? (sortDir === 'desc' ? '↓' : '↑') : '⇅'}</span>
    </th>
);

const getStatusColor = (status) => {
    const map = { 'present': 'success', 'absent': 'danger', 'half-day': 'warning', 'leave': 'info' };
    return map[status] || 'gray';
};

export default Attendance;
