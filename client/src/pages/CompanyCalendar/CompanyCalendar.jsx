import React, { useState, useEffect, useRef, useCallback } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import MainLayout from '../../components/Layout/MainLayout';
import { eventAPI, userAPI } from '../../api/api';
import { useAuth } from '../../context/AuthContext';
import './CompanyCalendar.css';

// ── Constants ─────────────────────────────────────────────────────────────────
const EVENT_TYPES = [
    { value: 'holiday', label: '🏖️ Holiday', color: '#ef4444' },
    { value: 'meeting', label: '📅 Meeting', color: '#3b82f6' },
    { value: 'announcement', label: '📢 Announcement', color: '#22c55e' },
    { value: 'training', label: '🎓 Training', color: '#f97316' },
    { value: 'company-event', label: '🏢 Company Event', color: '#8b5cf6' },
    { value: 'other', label: '📌 Other', color: '#6b7280' },
];

const RECURRENCE_OPTIONS = [
    { value: 'none', label: 'Does not repeat' },
    { value: 'monthly', label: 'Monthly' },
    { value: 'yearly', label: 'Yearly' },
];

const colorFor = (type) =>
    EVENT_TYPES.find(t => t.value === type)?.color || '#6b7280';

const toLocalDate = (d) => {
    if (!d) return '';
    return new Date(d).toISOString().slice(0, 10);
};

const BLANK_FORM = {
    title: '',
    description: '',
    startDate: '',
    endDate: '',
    startTime: '09:00',
    endTime: '10:00',
    allDay: true,
    location: '',
    type: 'announcement',
    recurrence: 'none',
    recurrenceInterval: 1,
    participants: [],   // array of user IDs (strings)
};

// ── Main Component ────────────────────────────────────────────────────────────
const CompanyCalendar = () => {
    const { user } = useAuth();
    const isAdmin = user?.role === 'admin';
    const currentUserId = user?._id || user?.id || '';
    const calRef = useRef(null);

    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(false);
    const [currentMonth, setCurrentMonth] = useState(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    });

    // Modal state
    const [modalOpen, setModalOpen] = useState(false);
    const [editingEvent, setEditingEvent] = useState(null); // null = create
    const [form, setForm] = useState(BLANK_FORM);
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState('');

    // Employees list for participant picker (loaded when modal opens)
    const [employees, setEmployees] = useState([]);

    // View event detail (employee or admin)
    const [viewEvent, setViewEvent] = useState(null);

    // ── My Events Only filter ──────────────────────────────────────────────
    const [myEventsOnly, setMyEventsOnly] = useState(false);

    // ── Load events for month ────────────────────────────────────────
    const loadEvents = useCallback(async (month, myOnly = false) => {
        setLoading(true);
        try {
            const res = await eventAPI.getByMonth(month, myOnly);
            setEvents(res.data.events || []);
        } catch (err) {
            console.error('Failed to load events:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    // Re-fetch when month OR filter changes
    useEffect(() => { loadEvents(currentMonth, myEventsOnly); }, [currentMonth, myEventsOnly, loadEvents]);

    // ── Load employees for participant picker ────────────────────────────────
    const loadEmployees = useCallback(async () => {
        if (!isAdmin) return;
        try {
            const res = await userAPI.getAll({ role: 'employee', status: 'active' });
            setEmployees(res.data.users || []);
        } catch (err) {
            console.error('Failed to load employees for picker:', err);
        }
    }, [isAdmin]);

    // ── FullCalendar callbacks ────────────────────────────────────────────────
    const handleDatesSet = (info) => {
        // info.start is the first day visible — compute the middle of the view to get the month
        const mid = new Date((info.start.getTime() + info.end.getTime()) / 2);
        const m = `${mid.getFullYear()}-${String(mid.getMonth() + 1).padStart(2, '0')}`;
        if (m !== currentMonth) setCurrentMonth(m);
    };

    const handleDateClick = (info) => {
        if (!isAdmin) return;
        setEditingEvent(null);
        setFormError('');
        setForm({ ...BLANK_FORM, startDate: info.dateStr, endDate: info.dateStr });
        setModalOpen(true);
        loadEmployees();
    };

    const handleEventClick = (info) => {
        const ev = info.event;
        const ext = ev.extendedProps;

        if (!isAdmin) {
            // Employees get a read-only view popup
            setViewEvent({
                title: ev.title,
                description: ext.description,
                start: ev.startStr,
                end: ev.endStr,
                allDay: ev.allDay,
                location: ext.location,
                type: ext.type,
                recurrence: ext.recurrence,
                createdBy: ext.created_by_name,
                participants: Array.isArray(ext.participants) ? ext.participants : [],
            });
            return;
        }

        // Admin: open edit modal
        // Virtual recurring occurrences can't be edited (no real DB id)
        if (ext._virtual) {
            alert('Recurring occurrences cannot be edited individually.\nEdit the base event by clicking a non-recurring instance.');
            return;
        }

        const startDate = ev.allDay
            ? toLocalDate(ev.start)
            : new Date(ev.start).toISOString().slice(0, 10);
        const endDate = ev.allDay
            ? toLocalDate(new Date(ev.end.getTime() - 86400000)) // undo FC exclusivity
            : new Date(ev.end || ev.start).toISOString().slice(0, 10);
        const startTime = ev.allDay ? '09:00' : new Date(ev.start).toTimeString().slice(0, 5);
        const endTime = ev.allDay ? '10:00' : new Date(ev.end || ev.start).toTimeString().slice(0, 5);

        setEditingEvent({ id: ev.id });
        setFormError('');
        setForm({
            title: ev.title,
            description: ext.description || '',
            startDate,
            endDate,
            startTime,
            endTime,
            allDay: ev.allDay,
            location: ext.location || '',
            type: ext.type || 'announcement',
            recurrence: ext.recurrence || 'none',
            recurrenceInterval: ext.recurrence_interval || 1,
            participants: Array.isArray(ext.participants) ? ext.participants : [],
        });
        setModalOpen(true);
        loadEmployees();
    };

    // ── Form handlers ─────────────────────────────────────────────────────────
    const handleChange = (e) => {
        const { name, value, type: inputType, checked } = e.target;
        setForm(f => ({ ...f, [name]: inputType === 'checkbox' ? checked : value }));
    };

    const buildPayload = () => {
        const startDate = form.allDay
            ? form.startDate
            : `${form.startDate}T${form.startTime}`;
        const endDate = form.allDay
            ? form.endDate
            : `${form.endDate}T${form.endTime}`;
        return {
            title: form.title,
            description: form.description,
            startDate,
            endDate,
            allDay: form.allDay,
            location: form.location,
            type: form.type,
            recurrence: form.recurrence,
            recurrenceInterval: Number(form.recurrenceInterval),
            participants: form.participants,
        };
    };

    // Also pass myEventsOnly to post-save reload
    const handleSave = async (e) => {
        e.preventDefault();
        setFormError('');

        if (!form.title.trim()) { setFormError('Title is required'); return; }
        if (!form.startDate) { setFormError('Start date is required'); return; }
        if (!form.endDate) { setFormError('End date is required'); return; }
        if (form.startDate > form.endDate) {
            setFormError('End date must be on or after start date'); return;
        }

        setSaving(true);
        try {
            if (editingEvent) {
                await eventAPI.update(editingEvent.id, buildPayload());
            } else {
                await eventAPI.create(buildPayload());
            }
            setModalOpen(false);
            loadEvents(currentMonth, myEventsOnly);
        } catch (err) {
            setFormError(err.response?.data?.message || 'Failed to save event');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!editingEvent || !window.confirm('Delete this event?')) return;
        setSaving(true);
        try {
            await eventAPI.delete(editingEvent.id);
            setModalOpen(false);
            loadEvents(currentMonth, myEventsOnly);
        } catch (err) {
            setFormError(err.response?.data?.message || 'Failed to delete event');
        } finally {
            setSaving(false);
        }
    };

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <MainLayout title="Company Calendar">
            <div className="cc-page">

                {/* Legend */}
                <div className="cc-legend">
                    {EVENT_TYPES.map(t => (
                        <span key={t.value} className="cc-legend-item">
                            <span className="cc-legend-dot" style={{ background: t.color }} />
                            {t.label}
                        </span>
                    ))}

                    {/* ── My Events Only toggle ── */}
                    <label className="cc-my-events-toggle" htmlFor="cc-my-events-switch" title="Show only events you created or are tagged in">
                        <input
                            id="cc-my-events-switch"
                            type="checkbox"
                            checked={myEventsOnly}
                            onChange={e => setMyEventsOnly(e.target.checked)}
                        />
                        <span className="cc-toggle-track">
                            <span className="cc-toggle-thumb" />
                        </span>
                        <span className="cc-toggle-label">My Events</span>
                    </label>

                    {loading && <span className="cc-loading-badge">Loading…</span>}
                    {isAdmin && (
                        <button className="cc-add-btn" onClick={() => {
                            const today = new Date().toISOString().slice(0, 10);
                            setEditingEvent(null);
                            setFormError('');
                            setForm({ ...BLANK_FORM, startDate: today, endDate: today });
                            setModalOpen(true);
                            loadEmployees();
                        }}>
                            ＋ Add Event
                        </button>
                    )}
                </div>

                {/* FullCalendar */}
                <div className="cc-calendar-wrap">
                    <FullCalendar
                        ref={calRef}
                        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                        initialView="dayGridMonth"
                        headerToolbar={{
                            left: 'prev,next today',
                            center: 'title',
                            right: 'dayGridMonth,timeGridWeek,timeGridDay',
                        }}
                        events={events}
                        datesSet={handleDatesSet}
                        dateClick={isAdmin ? handleDateClick : undefined}
                        eventClick={handleEventClick}
                        eventDisplay="block"
                        dayMaxEvents={4}
                        height="auto"
                        editable={false}
                        selectable={isAdmin}
                        nowIndicator
                        eventContent={(arg) => {
                            const extParticipants = arg.event.extendedProps.participants || [];
                            const isTagged = currentUserId && extParticipants.includes(currentUserId);
                            return (
                                <div
                                    className={`cc-event-pill${isTagged ? ' cc-event-tagged' : ''}`}
                                    title={arg.event.title}
                                >
                                    <span className="cc-event-dot" style={{
                                        background: arg.event.backgroundColor
                                    }} />
                                    <span className="cc-event-title">{arg.event.title}</span>
                                    {isTagged && <span className="cc-event-tag-badge" title="You are tagged">🔔</span>}
                                </div>
                            );
                        }}
                    />
                </div>
            </div>

            {/* ── Create/Edit Modal (Admin only) ─────────────────────────── */}
            {modalOpen && (
                <div className="cc-modal-overlay" onClick={() => setModalOpen(false)}>
                    <div className="cc-modal" onClick={e => e.stopPropagation()}>
                        <div className="cc-modal-header">
                            <h2>{editingEvent ? 'Edit Event' : 'Create Event'}</h2>
                            <button className="cc-modal-close" onClick={() => setModalOpen(false)}>×</button>
                        </div>

                        <form className="cc-modal-body" onSubmit={handleSave}>
                            {formError && <div className="cc-form-error">{formError}</div>}

                            {/* Title */}
                            <div className="cc-form-group">
                                <label>Title *</label>
                                <input name="title" value={form.title} onChange={handleChange}
                                    className="cc-input" placeholder="Event title" required />
                            </div>

                            {/* Type */}
                            <div className="cc-form-group">
                                <label>Event Type</label>
                                <div className="cc-type-grid">
                                    {EVENT_TYPES.map(t => (
                                        <label key={t.value}
                                            className={`cc-type-chip ${form.type === t.value ? 'selected' : ''}`}
                                            style={form.type === t.value ? { borderColor: t.color, background: t.color + '22' } : {}}>
                                            <input type="radio" name="type" value={t.value}
                                                checked={form.type === t.value} onChange={handleChange}
                                                style={{ display: 'none' }} />
                                            {t.label}
                                        </label>
                                    ))}
                                </div>
                            </div>

                            {/* All-day toggle */}
                            <div className="cc-form-group cc-checkbox-row">
                                <label className="cc-checkbox-label">
                                    <input type="checkbox" name="allDay" checked={form.allDay}
                                        onChange={handleChange} />
                                    <span>All-day event</span>
                                </label>
                            </div>

                            {/* Dates */}
                            <div className="cc-form-row">
                                <div className="cc-form-group">
                                    <label>Start Date *</label>
                                    <input type="date" name="startDate" value={form.startDate}
                                        onChange={handleChange} className="cc-input" required />
                                </div>
                                {!form.allDay && (
                                    <div className="cc-form-group">
                                        <label>Start Time</label>
                                        <input type="time" name="startTime" value={form.startTime}
                                            onChange={handleChange} className="cc-input" />
                                    </div>
                                )}
                            </div>

                            <div className="cc-form-row">
                                <div className="cc-form-group">
                                    <label>End Date *</label>
                                    <input type="date" name="endDate" value={form.endDate}
                                        min={form.startDate}
                                        onChange={handleChange} className="cc-input" required />
                                </div>
                                {!form.allDay && (
                                    <div className="cc-form-group">
                                        <label>End Time</label>
                                        <input type="time" name="endTime" value={form.endTime}
                                            onChange={handleChange} className="cc-input" />
                                    </div>
                                )}
                            </div>

                            {/* Location */}
                            <div className="cc-form-group">
                                <label>Location</label>
                                <input name="location" value={form.location} onChange={handleChange}
                                    className="cc-input" placeholder="Optional location" />
                            </div>

                            {/* Description */}
                            <div className="cc-form-group">
                                <label>Description</label>
                                <textarea name="description" value={form.description}
                                    onChange={handleChange} className="cc-input cc-textarea"
                                    rows={3} placeholder="Optional details…" />
                            </div>

                            {/* Recurrence */}
                            <div className="cc-form-row">
                                <div className="cc-form-group">
                                    <label>Recurrence</label>
                                    <select name="recurrence" value={form.recurrence}
                                        onChange={handleChange} className="cc-input">
                                        {RECURRENCE_OPTIONS.map(o => (
                                            <option key={o.value} value={o.value}>{o.label}</option>
                                        ))}
                                    </select>
                                </div>
                                {form.recurrence !== 'none' && (
                                    <div className="cc-form-group" style={{ maxWidth: '120px' }}>
                                        <label>Every (n)</label>
                                        <input type="number" name="recurrenceInterval"
                                            value={form.recurrenceInterval} min={1} max={99}
                                            onChange={handleChange} className="cc-input" />
                                    </div>
                                )}
                            </div>

                            {/* Tagged Participants */}
                            {employees.length > 0 && (
                                <div className="cc-form-group">
                                    <label>Tag Employees <span className="cc-label-hint">(optional — they'll see a highlight)</span></label>
                                    <div className="cc-participant-list">
                                        {employees.map(emp => {
                                            const empId = emp._id?.toString() || emp.id?.toString();
                                            const isSelected = form.participants.includes(empId);
                                            return (
                                                <label
                                                    key={empId}
                                                    className={`cc-participant-item${isSelected ? ' selected' : ''}`}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={() => {
                                                            setForm(f => ({
                                                                ...f,
                                                                participants: isSelected
                                                                    ? f.participants.filter(id => id !== empId)
                                                                    : [...f.participants, empId]
                                                            }));
                                                        }}
                                                        style={{ display: 'none' }}
                                                    />
                                                    <span className="cc-participant-avatar">
                                                        {emp.name?.charAt(0).toUpperCase()}
                                                    </span>
                                                    <span className="cc-participant-name">{emp.name}</span>
                                                    {isSelected && <span className="cc-participant-check">✓</span>}
                                                </label>
                                            );
                                        })}
                                    </div>
                                    {form.participants.length > 0 && (
                                        <div className="cc-participant-count">
                                            {form.participants.length} employee{form.participants.length > 1 ? 's' : ''} tagged
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Footer */}
                            <div className="cc-modal-footer">
                                {editingEvent && (
                                    <button type="button" className="cc-btn-delete"
                                        onClick={handleDelete} disabled={saving}>
                                        🗑️ Delete
                                    </button>
                                )}
                                <div style={{ flex: 1 }} />
                                <button type="button" className="cc-btn-cancel"
                                    onClick={() => setModalOpen(false)} disabled={saving}>
                                    Cancel
                                </button>
                                <button type="submit" className="cc-btn-save" disabled={saving}>
                                    {saving ? 'Saving…' : editingEvent ? 'Save Changes' : 'Create Event'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ── View Modal (Employee read-only) ──────────────────────────── */}
            {viewEvent && (
                <div className="cc-modal-overlay" onClick={() => setViewEvent(null)}>
                    <div className="cc-modal" style={{ maxWidth: '480px' }}
                        onClick={e => e.stopPropagation()}>
                        <div className="cc-modal-header" style={{
                            borderLeft: `4px solid ${colorFor(viewEvent.type)}`,
                            paddingLeft: '1.25rem'
                        }}>
                            <div>
                                <div className="cc-view-type-badge" style={{
                                    background: colorFor(viewEvent.type) + '22',
                                    color: colorFor(viewEvent.type)
                                }}>
                                    {EVENT_TYPES.find(t => t.value === viewEvent.type)?.label || viewEvent.type}
                                </div>
                                <h2 style={{ marginTop: '0.25rem' }}>{viewEvent.title}</h2>
                            </div>
                            <button className="cc-modal-close" onClick={() => setViewEvent(null)}>×</button>
                        </div>
                        <div className="cc-modal-body">
                            <div className="cc-view-row">
                                <span className="cc-view-label">📅 When</span>
                                <span>{viewEvent.allDay
                                    ? `${viewEvent.start}${viewEvent.end && viewEvent.end !== viewEvent.start ? ` → ${viewEvent.end}` : ''}`
                                    : `${viewEvent.start}${viewEvent.end ? ` → ${viewEvent.end}` : ''}`
                                }</span>
                            </div>
                            {viewEvent.location && (
                                <div className="cc-view-row">
                                    <span className="cc-view-label">📍 Location</span>
                                    <span>{viewEvent.location}</span>
                                </div>
                            )}
                            {viewEvent.recurrence && viewEvent.recurrence !== 'none' && (
                                <div className="cc-view-row">
                                    <span className="cc-view-label">🔁 Repeats</span>
                                    <span style={{ textTransform: 'capitalize' }}>{viewEvent.recurrence}</span>
                                </div>
                            )}
                            {viewEvent.description && (
                                <div className="cc-view-row cc-view-desc">
                                    <span className="cc-view-label">📝 Notes</span>
                                    <span>{viewEvent.description}</span>
                                </div>
                            )}
                            {viewEvent.createdBy && (
                                <div className="cc-view-row">
                                    <span className="cc-view-label">👤 Created by</span>
                                    <span>{viewEvent.createdBy}</span>
                                </div>
                            )}
                            {/* Tagged callout — shown if current user is in participants */}
                            {Array.isArray(viewEvent.participants) && currentUserId &&
                                viewEvent.participants.includes(currentUserId) && (
                                    <div className="cc-view-tagged-badge">
                                        🔔 You are tagged in this event
                                    </div>
                                )}
                        </div>
                        <div className="cc-modal-footer" style={{ justifyContent: 'flex-end' }}>
                            <button className="cc-btn-save" onClick={() => setViewEvent(null)}>Close</button>
                        </div>
                    </div>
                </div>
            )}
        </MainLayout>
    );
};

export default CompanyCalendar;
