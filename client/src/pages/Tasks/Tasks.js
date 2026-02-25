import React, { useState, useEffect, useCallback } from 'react';
import MainLayout from '../../components/Layout/MainLayout';
import Modal from '../../components/Modal/Modal';
import { taskAPI, userAPI } from '../../api/api';
import '../Employees/Employees.css';

const Tasks = () => {
    const [tasks, setTasks] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({ status: '', priority: '', assigned_to: '' });
    const [showModal, setShowModal] = useState(false);
    const [editingTask, setEditingTask] = useState(null);
    const [sortKey, setSortKey] = useState('due_date');
    const [sortDir, setSortDir] = useState('asc');

    const fetchTasks = useCallback(async () => {
        try {
            const response = await taskAPI.getAll(filters);
            setTasks(response.data.tasks);
        } catch (error) {
            console.error('Failed to fetch tasks:', error);
        } finally {
            setLoading(false);
        }
    }, [filters]);

    const fetchEmployees = useCallback(async () => {
        try {
            const response = await userAPI.getAll({ role: 'employee' });
            setEmployees(response.data.users);
        } catch (error) {
            console.error('Failed to fetch employees:', error);
        }
    }, []);

    useEffect(() => {
        fetchTasks();
        fetchEmployees();
    }, [fetchTasks, fetchEmployees]);

    const handleFilterChange = (key, value) => {
        setFilters({ ...filters, [key]: value });
    };

    const handleAddTask = () => {
        setEditingTask(null);
        setShowModal(true);
    };

    const handleEditTask = (task) => {
        setEditingTask(task);
        setShowModal(true);
    };

    const handleDeleteTask = async (id) => {
        if (!window.confirm('Are you sure you want to delete this task?')) return;

        try {
            await taskAPI.delete(id);
            fetchTasks();
        } catch (error) {
            alert('Failed to delete task');
        }
    };

    const handleModalClose = () => {
        setShowModal(false);
        setEditingTask(null);
    };

    const handleModalSuccess = () => {
        fetchTasks();
        handleModalClose();
    };

    const toggleSort = (key) => {
        if (sortKey === key) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
        else { setSortKey(key); setSortDir('asc'); }
    };

    const sortedTasks = [...tasks].sort((a, b) => {
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
            <MainLayout title="Task Management">
                <div className="loader-container">
                    <div className="loader"></div>
                </div>
            </MainLayout>
        );
    }

    return (
        <MainLayout title="Task Management">
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
                            <option value="in-progress">In Progress</option>
                            <option value="completed">Completed</option>
                            <option value="cancelled">Cancelled</option>
                        </select>

                        <select
                            className="form-select"
                            value={filters.priority}
                            onChange={(e) => handleFilterChange('priority', e.target.value)}
                        >
                            <option value="">All Priorities</option>
                            <option value="low">Low</option>
                            <option value="medium">Medium</option>
                            <option value="high">High</option>
                            <option value="urgent">Urgent</option>
                        </select>

                        <select
                            className="form-select"
                            value={filters.assigned_to}
                            onChange={(e) => handleFilterChange('assigned_to', e.target.value)}
                        >
                            <option value="">All Employees</option>
                            {employees.map(emp => (
                                <option key={emp.id} value={emp.id}>{emp.name}</option>
                            ))}
                        </select>
                    </div>

                    <button className="btn btn-primary" onClick={handleAddTask}>
                        ➕ Assign Task
                    </button>
                </div>

                <div className="card">
                    <div className="table-container">
                        <table className="table">
                            <thead>
                                <tr>
                                    <SortTh label="Title" k="title" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
                                    <SortTh label="Assigned To" k="assigned_to_name" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
                                    <SortTh label="Priority" k="priority" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
                                    <SortTh label="Status" k="status" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
                                    <SortTh label="Due Date" k="due_date" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
                                    <th>Created By</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sortedTasks.length === 0 ? (
                                    <tr>
                                        <td colSpan="7" className="text-center" style={{ padding: '2rem', color: 'var(--gray-500)' }}>
                                            No tasks found
                                        </td>
                                    </tr>
                                ) : (
                                    sortedTasks.map((task) => (
                                        <tr key={task.id}>
                                            <td>
                                                <div style={{ fontWeight: '500' }}>{task.title}</div>
                                                {task.description && (
                                                    <div style={{ fontSize: '0.8125rem', color: 'var(--gray-500)', marginTop: '0.25rem' }}>
                                                        {task.description.substring(0, 50)}{task.description.length > 50 ? '...' : ''}
                                                    </div>
                                                )}
                                            </td>
                                            <td>{task.assigned_to_name}</td>
                                            <td>
                                                <span className={`badge badge-${getPriorityColor(task.priority)}`}>
                                                    {task.priority}
                                                </span>
                                            </td>
                                            <td>
                                                <span className={`badge badge-${getStatusColor(task.status)}`}>
                                                    {task.status}
                                                </span>
                                            </td>
                                            <td>{task.due_date ? new Date(task.due_date).toLocaleDateString() : '-'}</td>
                                            <td>{task.assigned_by_name}</td>
                                            <td>
                                                <div className="action-buttons">
                                                    <button
                                                        className="btn btn-sm btn-secondary"
                                                        onClick={() => handleEditTask(task)}
                                                    >
                                                        ✏️ Edit
                                                    </button>
                                                    <button
                                                        className="btn btn-sm btn-danger"
                                                        onClick={() => handleDeleteTask(task.id)}
                                                    >
                                                        🗑️ Delete
                                                    </button>
                                                </div>
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
                <TaskModal
                    task={editingTask}
                    employees={employees}
                    onClose={handleModalClose}
                    onSuccess={handleModalSuccess}
                />
            )}
        </MainLayout>
    );
};

const TaskModal = ({ task, employees, onClose, onSuccess }) => {
    const isEditing = !!task;
    const [formData, setFormData] = useState({
        title: task?.title || '',
        description: task?.description || '',
        assigned_to: task?.assigned_to || '',
        priority: task?.priority || 'medium',
        status: task?.status || 'pending',
        due_date: task?.due_date || ''
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
            if (isEditing) {
                await taskAPI.update(task.id, formData);
            } else {
                if (!formData.assigned_to) {
                    setError('Please select an employee to assign the task');
                    setLoading(false);
                    return;
                }
                await taskAPI.create(formData);
            }
            onSuccess();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to save task');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            isOpen={true}
            onClose={onClose}
            title={isEditing ? 'Edit Task' : 'Assign New Task'}
            footer={
                <>
                    <button className="btn btn-secondary" onClick={onClose}>
                        Cancel
                    </button>
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
                    <label className="form-label">Title *</label>
                    <input
                        type="text"
                        name="title"
                        value={formData.title}
                        onChange={handleChange}
                        className="form-input"
                        required
                    />
                </div>

                <div className="form-group">
                    <label className="form-label">Description</label>
                    <textarea
                        name="description"
                        value={formData.description}
                        onChange={handleChange}
                        className="form-textarea"
                        rows="3"
                    ></textarea>
                </div>

                <div className="form-group">
                    <label className="form-label">Assign To *</label>
                    <select
                        name="assigned_to"
                        value={formData.assigned_to}
                        onChange={handleChange}
                        className="form-select"
                        required
                    >
                        <option value="">Select Employee</option>
                        {employees.map((emp) => (
                            <option key={emp.id} value={emp.id}>
                                {emp.name} ({emp.email})
                            </option>
                        ))}
                    </select>
                </div>

                <div className="form-group">
                    <label className="form-label">Priority *</label>
                    <select
                        name="priority"
                        value={formData.priority}
                        onChange={handleChange}
                        className="form-select"
                        required
                    >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="urgent">Urgent</option>
                    </select>
                </div>

                {isEditing && (
                    <div className="form-group">
                        <label className="form-label">Status *</label>
                        <select
                            name="status"
                            value={formData.status}
                            onChange={handleChange}
                            className="form-select"
                            required
                        >
                            <option value="pending">Pending</option>
                            <option value="in-progress">In Progress</option>
                            <option value="completed">Completed</option>
                            <option value="cancelled">Cancelled</option>
                        </select>
                    </div>
                )}

                <div className="form-group">
                    <label className="form-label">Due Date</label>
                    <input
                        type="date"
                        name="due_date"
                        value={formData.due_date}
                        onChange={handleChange}
                        className="form-input"
                    />
                </div>
            </form>
        </Modal>
    );
};

const getStatusColor = (status) => {
    const colorMap = {
        'pending': 'warning',
        'in-progress': 'info',
        'completed': 'success',
        'cancelled': 'danger'
    };
    return colorMap[status] || 'gray';
};

const getPriorityColor = (priority) => {
    const colorMap = {
        'low': 'gray',
        'medium': 'info',
        'high': 'warning',
        'urgent': 'danger'
    };
    return colorMap[priority] || 'gray';
};

export default Tasks;

// ── Helpers ───────────────────────────────────────────────────────────────────
const SortTh = ({ label, k, sortKey, sortDir, onClick }) => (
    <th onClick={() => onClick(k)} style={{ cursor: 'pointer', userSelect: 'none' }} title={`Sort by ${label}`}>
        {label}
        <span style={{ marginLeft: '0.5rem', opacity: sortKey === k ? 1 : 0.3 }}>
            {sortKey === k ? (sortDir === 'desc' ? '↓' : '↑') : '⇅'}
        </span>
    </th>
);
