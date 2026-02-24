import './MyPerformance.css';
import React, { useState, useEffect } from 'react';
import MainLayout from '../../components/Layout/MainLayout';
import { performanceAPI } from '../../api/api';
import {
    FaTrophy, FaCheckCircle, FaExclamationTriangle,
    FaClipboardList, FaStar, FaSync
} from 'react-icons/fa';

// ── Score badge logic ────────────────────────────────────────────────────────
const scoreBadge = (score) => {
    if (score >= 80) return { label: 'Excellent', cls: 'my-badge-green', msg: 'Keep up the great work!' };
    if (score >= 50) return { label: 'Average', cls: 'my-badge-yellow', msg: 'You are on track — aim higher!' };
    return { label: 'Needs Work', cls: 'my-badge-red', msg: 'Focus on completing tasks on time.' };
};

// ── Arc progress (half-donut) ────────────────────────────────────────────────
const ArcProgress = ({ pct, color }) => {
    // Draw a 180° arc from left to right
    const r = 54, cx = 70, cy = 70;
    const toRad = deg => (deg * Math.PI) / 180;
    const arcX = (deg) => cx + r * Math.cos(toRad(deg));
    const arcY = (deg) => cy + r * Math.sin(toRad(deg));

    // Background arc: 180° → 0° (left to right via bottom, going anticlockwise on screen)
    const bgPath = `M ${arcX(180)} ${arcY(180)} A ${r} ${r} 0 0 1 ${arcX(0)} ${arcY(0)}`;

    // Value arc
    const endDeg = 180 - pct * 1.8; // 180 → 0 maps to 0%→100%
    const largeArc = (180 - endDeg) >= 180 ? 1 : 0;
    const fgPath = pct > 0
        ? `M ${arcX(180)} ${arcY(180)} A ${r} ${r} 0 ${largeArc} 1 ${arcX(endDeg)} ${arcY(endDeg)}`
        : null;

    return (
        <svg width="140" height="85" viewBox="0 0 140 85" className="arc-svg">
            {/* background track */}
            <path d={bgPath} fill="none" stroke="#e5e7eb" strokeWidth="12" strokeLinecap="round" />
            {/* progress */}
            {fgPath && (
                <path d={fgPath} fill="none" stroke={color} strokeWidth="12" strokeLinecap="round"
                    style={{ transition: 'all 1s ease' }} />
            )}
            {/* centre label */}
            <text x="70" y="68" textAnchor="middle" fontSize="22" fontWeight="800" fill={color}>{pct}%</text>
        </svg>
    );
};

const MyPerformance = () => {
    const [perf, setPerf] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const fetchData = async () => {
        setLoading(true);
        setError('');
        try {
            const res = await performanceAPI.get();
            setPerf(res.data.performance);
        } catch (err) {
            setError('Failed to load your performance. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    if (loading) {
        return (
            <MainLayout title="My Performance">
                <div className="my-perf-loader">
                    <div className="my-perf-spinner" />
                    <p>Calculating your performance…</p>
                </div>
            </MainLayout>
        );
    }

    const badge = perf ? scoreBadge(perf.performanceScore) : null;
    const ringColor = badge?.cls === 'my-badge-green'
        ? '#16a34a'
        : badge?.cls === 'my-badge-yellow'
            ? '#d97706'
            : '#dc2626';

    return (
        <MainLayout title="My Performance">
            <div className="my-perf-page">

                {/* ── Header ── */}
                <div className="my-perf-header">
                    <div className="my-perf-title-block">
                        <FaTrophy className="my-perf-icon" />
                        <div>
                            <h1 className="my-perf-title">My Performance</h1>
                            <p className="my-perf-sub">Based on your task completion history</p>
                        </div>
                    </div>
                    <button className="my-refresh-btn" onClick={fetchData} title="Refresh">
                        <FaSync />
                    </button>
                </div>

                {error && <div className="my-perf-error">{error}</div>}

                {perf && (
                    <>
                        {/* ── Score hero card ── */}
                        <div className="my-hero-card">
                            <div className="my-hero-arc">
                                <ArcProgress pct={perf.completionRate} color={ringColor} />
                                <div className="my-arc-label">Completion Rate</div>
                            </div>

                            <div className="my-hero-body">
                                <div className="my-hero-name">{perf.name}</div>
                                <div className={`my-score-badge ${badge.cls}`}>
                                    <FaStar /> {badge.label}
                                </div>
                                <div className="my-score-number">
                                    Score: <strong>{perf.performanceScore}</strong><span> / 100</span>
                                </div>
                                <p className="my-hero-msg">{badge.msg}</p>
                            </div>
                        </div>

                        {/* ── Metric cards ── */}
                        <div className="my-metrics-grid">
                            <MetricCard
                                icon={<FaClipboardList />}
                                label="Tasks Assigned"
                                value={perf.totalTasksAssigned}
                                color="blue"
                            />
                            <MetricCard
                                icon={<FaCheckCircle />}
                                label="Tasks Completed"
                                value={perf.totalTasksCompleted}
                                color="green"
                            />
                            <MetricCard
                                icon={<FaExclamationTriangle />}
                                label="Late Tasks"
                                value={perf.lateTasks}
                                color="red"
                            />
                            <MetricCard
                                icon={<FaStar />}
                                label="Points Earned"
                                value={perf.totalPointsEarned}
                                color="purple"
                            />
                        </div>

                        {/* ── Breakdown panel ── */}
                        <div className="my-breakdown-card">
                            <h2 className="my-breakdown-title">Score Breakdown</h2>
                            <div className="my-breakdown-rows">
                                <BreakdownRow label="Points from completed tasks" value={`+${perf.totalPointsEarned} pts`} positive />
                                <BreakdownRow label="Late task penalty (×2 each)" value={`−${perf.lateTasks * 2} pts`} negative />
                                <BreakdownRow label="Completion rate" value={`${perf.completionRate}%`} />
                                <BreakdownRow label="Overall performance score" value={<strong>{perf.performanceScore} / 100</strong>} highlight />
                            </div>

                            <div className="my-scoring-info">
                                <h3>How is your score calculated?</h3>
                                <ul>
                                    <li><span className="dot dot-low" /> Low priority task = <strong>1 point</strong></li>
                                    <li><span className="dot dot-med" /> Medium priority task = <strong>2 points</strong></li>
                                    <li><span className="dot dot-high" /> High / Urgent priority task = <strong>3 points</strong></li>
                                    <li><span className="dot dot-late" /> Each late task deducts <strong>2 points</strong></li>
                                </ul>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </MainLayout>
    );
};

// ── Sub-components ───────────────────────────────────────────────────────────
const MetricCard = ({ icon, label, value, color }) => (
    <div className={`my-metric-card my-metric-${color}`}>
        <div className="my-metric-icon">{icon}</div>
        <div>
            <div className="my-metric-label">{label}</div>
            <div className="my-metric-value">{value}</div>
        </div>
    </div>
);

const BreakdownRow = ({ label, value, positive, negative, highlight }) => (
    <div className={`my-bd-row ${highlight ? 'my-bd-highlight' : ''}`}>
        <span className="my-bd-label">{label}</span>
        <span className={`my-bd-value ${positive ? 'my-bd-pos' : negative ? 'my-bd-neg' : ''}`}>
            {value}
        </span>
    </div>
);

export default MyPerformance;
