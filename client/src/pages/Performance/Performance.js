import './Performance.css';
import React, { useState, useEffect } from 'react';
import MainLayout from '../../components/Layout/MainLayout';
import { performanceAPI } from '../../api/api';
import {
    FaTrophy, FaCheckCircle, FaExclamationTriangle,
    FaChartBar, FaSync, FaUserTie
} from 'react-icons/fa';

// ── Score badge colour logic ────────────────────────────────────────────────
const scoreBadge = (score) => {
    if (score >= 80) return { label: 'Excellent', cls: 'badge-score-green' };
    if (score >= 50) return { label: 'Average', cls: 'badge-score-yellow' };
    return { label: 'Needs Work', cls: 'badge-score-red' };
};

// ── Mini circular-progress ring ─────────────────────────────────────────────
const RingProgress = ({ pct, color }) => {
    const r = 26, circ = 2 * Math.PI * r;
    const offset = circ - (pct / 100) * circ;
    return (
        <svg width="64" height="64" viewBox="0 0 64 64" className="ring-svg">
            <circle cx="32" cy="32" r={r} fill="none" stroke="#e5e7eb" strokeWidth="6" />
            <circle
                cx="32" cy="32" r={r} fill="none"
                stroke={color} strokeWidth="6"
                strokeDasharray={circ} strokeDashoffset={offset}
                strokeLinecap="round"
                transform="rotate(-90 32 32)"
                style={{ transition: 'stroke-dashoffset 0.8s ease' }}
            />
            <text x="32" y="37" textAnchor="middle" fontSize="13" fontWeight="700" fill={color}>
                {pct}%
            </text>
        </svg>
    );
};

const Performance = () => {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [sortKey, setSortKey] = useState('performanceScore');
    const [sortDir, setSortDir] = useState('desc');
    const [search, setSearch] = useState('');

    const fetchData = async () => {
        setLoading(true);
        setError('');
        try {
            const res = await performanceAPI.get();
            setData(res.data.performance || []);
        } catch (err) {
            setError('Failed to load performance data. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    // Sort + filter
    const sorted = [...data]
        .filter(e => (e.name || "").toLowerCase().includes(search.toLowerCase()))
        .sort((a, b) => {
            const multi = sortDir === 'desc' ? -1 : 1;
            if (typeof a[sortKey] === 'string') return multi * a[sortKey].localeCompare(b[sortKey]);
            return multi * (a[sortKey] - b[sortKey]);
        });

    const toggleSort = (key) => {
        if (sortKey === key) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
        else { setSortKey(key); setSortDir('desc'); }
    };

    // Summary stats
    const avg = data.length
        ? (data.reduce((s, e) => s + e.performanceScore, 0) / data.length).toFixed(1)
        : 0;
    const topPerformer = data.length
        ? data.reduce((best, e) => e.performanceScore > best.performanceScore ? e : best, data[0])
        : null;

    if (loading) {
        return (
            <MainLayout title="Performance">
                <div className="perf-loader">
                    <div className="perf-spinner" />
                    <p>Calculating performance…</p>
                </div>
            </MainLayout>
        );
    }

    return (
        <MainLayout title="Performance">
            <div className="perf-page">

                {/* ── Header row ── */}
                <div className="perf-header">
                    <div className="perf-title-block">
                        <FaChartBar className="perf-title-icon" />
                        <div>
                            <h1 className="perf-title">Employee Performance</h1>
                            <p className="perf-subtitle">Calculated dynamically from task completion data</p>
                        </div>
                    </div>
                    <button className="perf-refresh-btn" onClick={fetchData} title="Refresh">
                        <FaSync />
                    </button>
                </div>

                {error && <div className="perf-error">{error}</div>}

                {/* ── Summary cards ── */}
                {data.length > 0 && (
                    <div className="perf-summary-grid">
                        <div className="perf-summary-card perf-summary-blue">
                            <FaUserTie className="perf-summary-icon" />
                            <div>
                                <div className="perf-summary-label">Total Employees</div>
                                <div className="perf-summary-value">{data.length}</div>
                            </div>
                        </div>
                        <div className="perf-summary-card perf-summary-purple">
                            <FaTrophy className="perf-summary-icon" />
                            <div>
                                <div className="perf-summary-label">Avg Score</div>
                                <div className="perf-summary-value">{avg}</div>
                            </div>
                        </div>
                        <div className="perf-summary-card perf-summary-green">
                            <FaCheckCircle className="perf-summary-icon" />
                            <div>
                                <div className="perf-summary-label">Top Performer</div>
                                <div className="perf-summary-value perf-summary-name">{topPerformer?.name || '—'}</div>
                            </div>
                        </div>
                        <div className="perf-summary-card perf-summary-orange">
                            <FaExclamationTriangle className="perf-summary-icon" />
                            <div>
                                <div className="perf-summary-label">Late Tasks (Total)</div>
                                <div className="perf-summary-value">{data.reduce((s, e) => s + e.lateTasks, 0)}</div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── Filters ── */}
                <div className="perf-filters">
                    <input
                        id="perf-search"
                        className="perf-search"
                        type="text"
                        placeholder="Search employee…"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>

                {/* ── Table ── */}
                {sorted.length === 0 ? (
                    <div className="perf-empty">No performance data available yet.</div>
                ) : (
                    <div className="perf-table-wrap">
                        <table className="perf-table">
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <SortTh label="Employee" k="name" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
                                    <SortTh label="Assigned" k="totalTasksAssigned" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
                                    <SortTh label="Completed" k="totalTasksCompleted" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
                                    <SortTh label="Late" k="lateTasks" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
                                    <SortTh label="Points" k="totalPointsEarned" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
                                    <th>Completion %</th>
                                    <SortTh label="Score" k="performanceScore" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
                                    <th>Badge</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sorted.map((emp, i) => {
                                    const badge = scoreBadge(emp.performanceScore);
                                    const ringColor = badge.cls === 'badge-score-green'
                                        ? '#16a34a'
                                        : badge.cls === 'badge-score-yellow'
                                            ? '#d97706'
                                            : '#dc2626';
                                    return (
                                        <tr key={emp.userId} className="perf-row">
                                            <td className="perf-rank">{i + 1}</td>
                                            <td>
                                                <div className="perf-employee-cell">
                                                    <div className="perf-avatar">{emp.name.charAt(0).toUpperCase()}</div>
                                                    <div>
                                                        <div className="perf-emp-name">{emp.name}</div>
                                                        <div className="perf-emp-email">{emp.email}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="perf-num">{emp.totalTasksAssigned}</td>
                                            <td className="perf-num perf-completed">{emp.totalTasksCompleted}</td>
                                            <td className="perf-num perf-late">{emp.lateTasks}</td>
                                            <td className="perf-num">{emp.totalPointsEarned}</td>
                                            <td>
                                                <RingProgress pct={emp.completionRate} color={ringColor} />
                                            </td>
                                            <td className="perf-score-cell">
                                                <span className="perf-score-num">{emp.performanceScore}</span>
                                            </td>
                                            <td>
                                                <span className={`perf-badge ${badge.cls}`}>{badge.label}</span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </MainLayout>
    );
};

// Helper: sortable header
const SortTh = ({ label, k, sortKey, sortDir, onClick }) => (
    <th onClick={() => onClick(k)} className="perf-sort-th" title={`Sort by ${label}`}>
        {label}
        <span className="sort-arrow">
            {sortKey === k ? (sortDir === 'desc' ? ' ↓' : ' ↑') : ' ⇅'}
        </span>
    </th>
);


export default Performance;
