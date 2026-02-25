import './Standup.css';
import React, { useState, useEffect, useCallback } from 'react';
import MainLayout from '../../components/Layout/MainLayout';
import { standupAPI } from '../../api/api';
import {
    FaClipboardCheck, FaPlus, FaTrash, FaClock,
    FaExclamationTriangle, FaCheckCircle, FaTasks,
    FaTrophy, FaFire, FaSync
} from 'react-icons/fa';

/* ─── colour helper ──────────────────────────────────────────── */
const perfColor = (score) => {
    if (score === null || score === undefined) return 'perf-neutral';
    if (score >= 0.7) return 'perf-green';
    if (score >= 0.4) return 'perf-yellow';
    return 'perf-red';
};
const scoreColor = (score) => {
    if (score >= 70) return 'perf-green';
    if (score >= 30) return 'perf-yellow';
    return 'perf-red';
};

/* ─── default empty task ─────────────────────────────────────── */
const emptyTask = () => ({ title: '', estimatedHours: '' });

const Standup = () => {
    const [todayStatus, setTodayStatus] = useState(null);   // null | submitted standup
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    /* form */
    const [yesterdayWork, setYesterdayWork] = useState('');
    const [tasks, setTasks] = useState([emptyTask()]);
    const [blockers, setBlockers] = useState('');

    /* performance */
    const [perf, setPerf] = useState(null);
    const [perfLoad, setPerfLoad] = useState(true);

    /* ── fetch today's standup status ── */
    const fetchToday = useCallback(async () => {
        setLoading(true);
        try {
            const res = await standupAPI.getToday();
            setTodayStatus(res.data.submitted ? res.data.standup : null);
        } catch {
            setError('Failed to load today\'s standup status.');
        } finally {
            setLoading(false);
        }
    }, []);

    /* ── fetch performance ── */
    const fetchPerf = useCallback(async () => {
        setPerfLoad(true);
        try {
            const res = await standupAPI.getPerformance();
            setPerf(res.data.performance);
        } catch {
            setPerf(null);
        } finally {
            setPerfLoad(false);
        }
    }, []);

    useEffect(() => {
        fetchToday();
        fetchPerf();
    }, [fetchToday, fetchPerf]);

    /* ── task helpers ── */
    const addTask = () => setTasks(prev => [...prev, emptyTask()]);
    const removeTask = (i) => setTasks(prev => prev.filter((_, idx) => idx !== i));
    const updateTask = (i, field, val) => setTasks(prev => {
        const copy = [...prev];
        copy[i] = { ...copy[i], [field]: val };
        return copy;
    });

    /* ── submit ── */
    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        // client-side validation
        if (!yesterdayWork.trim()) {
            return setError('Please describe what you did yesterday.');
        }
        for (let i = 0; i < tasks.length; i++) {
            if (!tasks[i].title.trim()) return setError(`Task ${i + 1} needs a title.`);
            const h = parseFloat(tasks[i].estimatedHours);
            if (isNaN(h) || h <= 0) return setError(`Task ${i + 1} needs estimated hours > 0.`);
        }

        setSubmitting(true);
        try {
            const payload = {
                yesterdayWork: yesterdayWork.trim(),
                todayTasks: tasks.map(t => ({
                    title: t.title.trim(),
                    estimatedHours: parseFloat(t.estimatedHours)
                })),
                blockers: blockers.trim()
            };
            const res = await standupAPI.submit(payload);
            setSuccess(res.data.message || 'Standup submitted!');
            setTodayStatus(res.data.standup);
            fetchPerf();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to submit standup.');
        } finally {
            setSubmitting(false);
        }
    };

    /* ── loader ── */
    if (loading) {
        return (
            <MainLayout title="Daily Standup">
                <div className="su-loader"><div className="su-spinner" /></div>
            </MainLayout>
        );
    }

    return (
        <MainLayout title="Daily Standup">
            <div className="su-page">

                {/* ── Page header ── */}
                <div className="su-header">
                    <div className="su-header-left">
                        <FaClipboardCheck className="su-header-icon" />
                        <div>
                            <h1 className="su-title">Daily Standup</h1>
                            <p className="su-subtitle">Share what you did, what you'll do, and any blockers.</p>
                        </div>
                    </div>
                    {/* Status pill */}
                    <div className={`su-status-pill ${todayStatus ? 'su-status-done' : 'su-status-pending'}`}>
                        {todayStatus
                            ? <><FaCheckCircle /> Submitted Today</>
                            : <><FaClock /> Not Submitted</>
                        }
                    </div>
                </div>

                <div className="su-body">
                    {/* ══ LEFT: form or submitted card ══ */}
                    <div className="su-left">
                        {todayStatus ? (
                            <SubmittedCard standup={todayStatus} />
                        ) : (
                            <form className="su-form" onSubmit={handleSubmit} noValidate>
                                {error && <div className="su-alert su-alert-err">{error}</div>}
                                {success && <div className="su-alert su-alert-ok">{success}</div>}

                                {/* Yesterday */}
                                <div className="su-field">
                                    <label className="su-label" htmlFor="su-yesterday">
                                        What did you do yesterday?
                                    </label>
                                    <textarea
                                        id="su-yesterday"
                                        className="su-textarea"
                                        rows={3}
                                        placeholder="Describe completed tasks, meetings, reviews…"
                                        value={yesterdayWork}
                                        onChange={e => setYesterdayWork(e.target.value)}
                                        required
                                    />
                                </div>

                                {/* Today's tasks */}
                                <div className="su-field">
                                    <div className="su-tasks-header">
                                        <label className="su-label">Today's Tasks</label>
                                        <button type="button" className="su-add-task-btn" onClick={addTask}>
                                            <FaPlus /> Add Task
                                        </button>
                                    </div>

                                    <div className="su-tasks-list">
                                        {tasks.map((task, i) => (
                                            <div key={i} className="su-task-row">
                                                <span className="su-task-num">{i + 1}</span>
                                                <input
                                                    className="su-input su-task-title"
                                                    type="text"
                                                    placeholder={`Task title…`}
                                                    value={task.title}
                                                    onChange={e => updateTask(i, 'title', e.target.value)}
                                                    required
                                                />
                                                <div className="su-hours-wrap">
                                                    <FaClock className="su-clock-icon" />
                                                    <input
                                                        className="su-input su-task-hours"
                                                        type="number"
                                                        min="0.1"
                                                        step="0.5"
                                                        placeholder="hrs"
                                                        value={task.estimatedHours}
                                                        onChange={e => updateTask(i, 'estimatedHours', e.target.value)}
                                                        required
                                                    />
                                                </div>
                                                {tasks.length > 1 && (
                                                    <button
                                                        type="button"
                                                        className="su-remove-task"
                                                        onClick={() => removeTask(i)}
                                                        title="Remove task"
                                                    >
                                                        <FaTrash />
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                    </div>

                                    {/* estimated total */}
                                    <div className="su-hours-total">
                                        Total estimated:&nbsp;
                                        <strong>
                                            {tasks.reduce((s, t) => s + (parseFloat(t.estimatedHours) || 0), 0).toFixed(1)} hrs
                                        </strong>
                                    </div>
                                </div>

                                {/* Blockers */}
                                <div className="su-field">
                                    <label className="su-label" htmlFor="su-blockers">
                                        <FaExclamationTriangle className="su-blocker-icon" />
                                        Blockers / Impediments <span className="su-optional">(optional)</span>
                                    </label>
                                    <textarea
                                        id="su-blockers"
                                        className="su-textarea"
                                        rows={2}
                                        placeholder="Any issues blocking your progress?"
                                        value={blockers}
                                        onChange={e => setBlockers(e.target.value)}
                                    />
                                </div>

                                <button
                                    type="submit"
                                    className="su-submit-btn"
                                    disabled={submitting}
                                >
                                    {submitting ? 'Submitting…' : 'Submit Standup'}
                                </button>
                            </form>
                        )}
                    </div>

                    {/* ══ RIGHT: performance panel ══ */}
                    <div className="su-right">
                        <div className="su-perf-card">
                            <div className="su-perf-header">
                                <FaTrophy className="su-perf-icon" /> My Performance
                                <button className="su-perf-refresh" onClick={fetchPerf} title="Refresh">
                                    <FaSync />
                                </button>
                            </div>

                            {perfLoad ? (
                                <div className="su-perf-loading">Calculating…</div>
                            ) : !perf ? (
                                <div className="su-perf-empty">No data yet.</div>
                            ) : (
                                <div className="su-perf-grid">
                                    <PerfMetric
                                        icon={<FaTasks />}
                                        label="Tasks Planned Today"
                                        value={perf.totalTasksPlanned}
                                        color="blue"
                                    />
                                    <PerfMetric
                                        icon={<FaClock />}
                                        label="Est. Hours Today"
                                        value={`${perf.totalEstimatedHours.toFixed(1)} h`}
                                        color="purple"
                                        warn={perf.totalEstimatedHours > 8}
                                    />
                                    <PerfMetric
                                        icon={<FaCheckCircle />}
                                        label="Completed Yesterday"
                                        value={perf.completedYesterday}
                                        color="green"
                                    />
                                    <PerfMetric
                                        icon={<FaFire />}
                                        label="Completion Ratio"
                                        value={
                                            perf.completionRatio !== null
                                                ? `${(perf.completionRatio * 100).toFixed(0)}%`
                                                : 'N/A'
                                        }
                                        colorClass={perf.completionRatio !== null ? perfColor(perf.completionRatio) : 'perf-neutral'}
                                    />
                                    <PerfMetric
                                        icon={<FaTrophy />}
                                        label="Weekly Score"
                                        value={perf.weeklyScore}
                                        colorClass={scoreColor(perf.weeklyScore)}
                                    />
                                    <PerfMetric
                                        icon={<FaExclamationTriangle />}
                                        label="Late Tasks"
                                        value={perf.lateTasks}
                                        colorClass={perf.lateTasks === 0 ? 'perf-green' : perf.lateTasks <= 2 ? 'perf-yellow' : 'perf-red'}
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </MainLayout>
    );
};

/* ── SubmittedCard ──────────────────────────────────────────── */
const SubmittedCard = ({ standup }) => (
    <div className="su-submitted-card">
        <div className="su-submitted-header">
            <FaCheckCircle className="su-submitted-icon" />
            <div>
                <h2 className="su-submitted-title">Standup Submitted ✓</h2>
                <p className="su-submitted-date">
                    {new Date(standup.submittedAt).toLocaleTimeString('en-IN', {
                        hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata'
                    })} IST — {standup.date}
                </p>
            </div>
        </div>

        <div className="su-submitted-section">
            <div className="su-submitted-label">Yesterday's Work</div>
            <p className="su-submitted-text">{standup.yesterdayWork}</p>
        </div>

        <div className="su-submitted-section">
            <div className="su-submitted-label">Today's Tasks ({standup.todayTasks.length})</div>
            <ul className="su-task-preview-list">
                {standup.todayTasks.map((t, i) => (
                    <li key={i} className="su-task-preview-item">
                        <span className="su-task-preview-title">{t.title}</span>
                        <span className="su-task-preview-hours">{t.estimatedHours} h</span>
                    </li>
                ))}
            </ul>
        </div>

        {standup.blockers && (
            <div className="su-submitted-section su-blocker-section">
                <div className="su-submitted-label"><FaExclamationTriangle /> Blockers</div>
                <p className="su-submitted-text">{standup.blockers}</p>
            </div>
        )}
    </div>
);

/* ── PerfMetric tile ─────────────────────────────────────────── */
const PerfMetric = ({ icon, label, value, color, colorClass, warn }) => (
    <div className={`su-metric-tile ${colorClass || ''} ${warn ? 'su-metric-warn' : ''}`}>
        <div className={`su-metric-icon su-metric-icon-${color || 'gray'}`}>{icon}</div>
        <div className="su-metric-body">
            <div className="su-metric-label">{label}</div>
            <div className="su-metric-value">{value}</div>
        </div>
    </div>
);

export default Standup;
