import './StandupAdmin.css';
import React, { useState, useEffect, useCallback } from 'react';
import MainLayout from '../../components/Layout/MainLayout';
import { standupAPI } from '../../api/api';
import {
    FaClipboardList, FaUsers, FaCheckCircle, FaExclamationTriangle,
    FaFire, FaSync, FaChevronDown, FaChevronUp, FaFireAlt
} from 'react-icons/fa';

/* ─── helpers ──────────────────────────────────────────────── */
function todayStr() {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}
const pct = (a, b) => (b === 0 ? 0 : Math.round((a / b) * 100));

const StandupAdmin = () => {
    const [date, setDate] = useState(todayStr());
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [reminding, setReminding] = useState(false);
    const [error, setError] = useState('');
    const [expanded, setExpanded] = useState(null);   // which standup row is open

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const res = await standupAPI.getAll(date);
            setData(res.data);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to load standup data.');
        } finally {
            setLoading(false);
        }
    }, [date]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleRemindMissing = async () => {
        if (!window.confirm('Send reminders to all employees who haven\'t submitted their standup yet?')) return;
        setReminding(true);
        try {
            const res = await standupAPI.remindMissing();
            alert(res.data.message);
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to send reminders.');
        } finally {
            setReminding(false);
        }
    };

    const toggleRow = (id) => setExpanded(prev => prev === id ? null : id);

    const summaryRate = data ? pct(data.submittedCount, data.totalEmployees) : 0;

    return (
        <MainLayout title="Standup Summary">
            <div className="sa-page">

                {/* ── Header ── */}
                <div className="sa-header">
                    <div className="sa-header-left">
                        <FaClipboardList className="sa-header-icon" />
                        <div>
                            <h1 className="sa-title">Daily Standup Summary</h1>
                            <p className="sa-subtitle">Track team participation and blockers in real-time.</p>
                        </div>
                    </div>
                    <div className="sa-header-controls">
                        {date === todayStr() && (
                            <button
                                className="sa-remind-btn"
                                onClick={handleRemindMissing}
                                disabled={reminding}
                                title="Send reminder to missing employees"
                            >
                                <FaClipboardList /> {reminding ? 'Sending...' : 'Remind Missing'}
                            </button>
                        )}
                        <input
                            id="sa-date-picker"
                            type="date"
                            className="sa-date-input"
                            value={date}
                            max={todayStr()}
                            onChange={e => setDate(e.target.value)}
                        />
                        <button className="sa-refresh-btn" onClick={fetchData} title="Refresh">
                            <FaSync />
                        </button>
                    </div>
                </div>

                {error && <div className="sa-alert">{error}</div>}

                {loading ? (
                    <div className="sa-loader"><div className="sa-spinner" /></div>
                ) : !data ? null : (
                    <>
                        {/* ── Summary Cards ── */}
                        <div className="sa-summary-grid">
                            <SummaryCard
                                icon={<FaUsers />}
                                label="Total Employees"
                                value={data.totalEmployees}
                                color="blue"
                            />
                            <SummaryCard
                                icon={<FaCheckCircle />}
                                label="Submitted"
                                value={data.submittedCount}
                                sub={`${summaryRate}% participation`}
                                color="green"
                            />
                            <SummaryCard
                                icon={<FaExclamationTriangle />}
                                label="Missing"
                                value={data.missingCount}
                                sub={data.missingCount > 0 ? 'Need follow-up' : 'All submitted'}
                                color={data.missingCount > 0 ? 'orange' : 'green'}
                            />
                            <SummaryCard
                                icon={<FaFire />}
                                label="Blockers Reported"
                                value={data.totalBlockers}
                                sub={data.totalBlockers > 0 ? 'Needs attention' : 'No blockers 🎉'}
                                color={data.totalBlockers > 0 ? 'red' : 'green'}
                            />
                            <SummaryCard
                                icon={<FaFireAlt />}
                                label="High Workload (>8h)"
                                value={data.highWorkloadEmployees?.length || 0}
                                sub={data.highWorkloadEmployees?.map(e => e.name).join(', ') || '—'}
                                color="purple"
                            />
                        </div>

                        {/* ── Participation bar ── */}
                        <div className="sa-progress-section">
                            <div className="sa-progress-label">
                                Participation: <strong>{data.submittedCount}/{data.totalEmployees}</strong>
                            </div>
                            <div className="sa-progress-track">
                                <div
                                    className="sa-progress-fill"
                                    style={{ width: `${summaryRate}%` }}
                                    data-pct={`${summaryRate}%`}
                                />
                            </div>
                        </div>

                        {/* ── Standup List ── */}
                        <div className="sa-list-section">
                            <h2 className="sa-list-title">
                                Submitted Standups
                                <span className="sa-list-count">{data.standups.length}</span>
                            </h2>

                            {data.standups.length === 0 ? (
                                <div className="sa-empty">No standups submitted for {date}.</div>
                            ) : (
                                <div className="sa-table-wrap">
                                    <table className="sa-table">
                                        <thead>
                                            <tr>
                                                <th>#</th>
                                                <th>Employee</th>
                                                <th>Tasks</th>
                                                <th>Est. Hours</th>
                                                <th>Blockers</th>
                                                <th>Submitted</th>
                                                <th></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {data.standups.map((s, i) => {
                                                const totalHours = s.todayTasks.reduce((sum, t) => sum + t.estimatedHours, 0);
                                                const isOpen = expanded === s.id;
                                                const hasBlocker = !!(s.blockers && s.blockers.trim());
                                                return (
                                                    <React.Fragment key={s.id || i}>
                                                        <tr
                                                            className={`sa-row ${isOpen ? 'sa-row-open' : ''} ${totalHours > 8 ? 'sa-row-highload' : ''}`}
                                                            onClick={() => toggleRow(s.id || i)}
                                                        >
                                                            <td className="sa-num">{i + 1}</td>
                                                            <td>
                                                                <div className="sa-emp-cell">
                                                                    <div className="sa-avatar">
                                                                        {(s.userId?.name || '?').charAt(0).toUpperCase()}
                                                                    </div>
                                                                    <div>
                                                                        <div className="sa-emp-name">{s.userId?.name || '—'}</div>
                                                                        <div className="sa-emp-email">{s.userId?.email || ''}</div>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            <td className="sa-num">{s.todayTasks.length}</td>
                                                            <td>
                                                                <span className={`sa-hours-badge ${totalHours > 8 ? 'sa-hours-high' : ''}`}>
                                                                    {totalHours.toFixed(1)} h
                                                                </span>
                                                            </td>
                                                            <td>
                                                                {hasBlocker
                                                                    ? <span className="sa-blocker-badge"><FaExclamationTriangle /> Blocker</span>
                                                                    : <span className="sa-no-blocker">—</span>
                                                                }
                                                            </td>
                                                            <td className="sa-time">
                                                                {new Date(s.submittedAt).toLocaleTimeString('en-IN', {
                                                                    hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata'
                                                                })} IST
                                                            </td>
                                                            <td className="sa-expand-btn">
                                                                {isOpen ? <FaChevronUp /> : <FaChevronDown />}
                                                            </td>
                                                        </tr>

                                                        {isOpen && (
                                                            <tr className="sa-detail-row">
                                                                <td colSpan={7}>
                                                                    <div className="sa-detail-panel">
                                                                        <div className="sa-detail-section">
                                                                            <div className="sa-detail-label">Yesterday's Work</div>
                                                                            <p className="sa-detail-text">{s.yesterdayWork}</p>
                                                                        </div>
                                                                        <div className="sa-detail-section">
                                                                            <div className="sa-detail-label">Today's Tasks</div>
                                                                            <ul className="sa-task-list">
                                                                                {s.todayTasks.map((t, j) => (
                                                                                    <li key={j} className="sa-task-item">
                                                                                        <span className="sa-task-name">{t.title}</span>
                                                                                        <span className="sa-task-hrs">{t.estimatedHours} h</span>
                                                                                    </li>
                                                                                ))}
                                                                            </ul>
                                                                        </div>
                                                                        {hasBlocker && (
                                                                            <div className="sa-detail-section sa-detail-blocker">
                                                                                <div className="sa-detail-label">
                                                                                    <FaExclamationTriangle /> Blockers
                                                                                </div>
                                                                                <p className="sa-detail-text">{s.blockers}</p>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        )}
                                                    </React.Fragment>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        </MainLayout>
    );
};

/* ── Summary Card Component ─────────────────────────────────── */
const SummaryCard = ({ icon, label, value, sub, color }) => (
    <div className={`sa-card sa-card-${color}`}>
        <div className="sa-card-icon">{icon}</div>
        <div className="sa-card-body">
            <div className="sa-card-label">{label}</div>
            <div className="sa-card-value">{value}</div>
            {sub && <div className="sa-card-sub">{sub}</div>}
        </div>
    </div>
);

export default StandupAdmin;
