import React, { useState, useEffect, useCallback } from 'react';
import MainLayout from '../../components/Layout/MainLayout';
import { taskAPI } from '../../api/api';
import '../Employees/Employees.css';

const MyTasks = () => {
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({ status: '', priority: '' });
    const [updatingTaskId, setUpdatingTaskId] = useState(null);

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

    useEffect(() => {
        fetchTasks();
    }, [fetchTasks]);

    const handleFilterChange = (key, value) => {
        setFilters({ ...filters, [key]: value });
    };

    const handleStatusUpdate = async (taskId, newStatus) => {
        setUpdatingTaskId(taskId);
        try {
            await taskAPI.update(taskId, { status: newStatus });
            fetchTasks();
        } catch (error) {
            alert(error.response?.data?.message || 'Failed to update task status');
        } finally {
            setUpdatingTaskId(null);
        }
    };

    if (loading) {
        return (
            <MainLayout title="My Tasks">
                <div className="loader-container">
                    <div className="loader"></div>
                </div>
            </MainLayout>
        );
    }

    const pendingTasks = tasks.filter(t => t.status === 'pending' || t.status === 'in-progress');
    const completedTasks = tasks.filter(t => t.status === 'completed');

    return (
        <MainLayout title="My Tasks">
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
                    </div>

                    <div style={{ color: 'var(--gray-600)', fontSize: '0.875rem' }}>
                        {pendingTasks.length} active • {completedTasks.length} completed
                    </div>
                </div>

                <div className="card">
                    <div className="table-container">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Task</th>
                                    <th>Priority</th>
                                    <th>Status</th>
                                    <th>Due Date</th>
                                    <th>Assigned By</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {tasks.length === 0 ? (
                                    <tr>
                                        <td colSpan="6" className="text-center" style={{ padding: '2rem', color: 'var(--gray-500)' }}>
                                            No tasks assigned to you
                                        </td>
                                    </tr>
                                ) : (
                                    tasks.map((task) => (
                                        <tr key={task.id}>
                                            <td>
                                                <div style={{ fontWeight: '500' }}>{task.title}</div>
                                                {task.description && (
                                                    <div style={{ fontSize: '0.8125rem', color: 'var(--gray-500)', marginTop: '0.25rem' }}>
                                                        {task.description}
                                                    </div>
                                                )}
                                            </td>
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
                                            <td>
                                                {task.due_date ? (
                                                    <div>
                                                        {new Date(task.due_date).toLocaleDateString()}
                                                        {isDueSoon(task.due_date) && task.status !== 'completed' && (
                                                            <div style={{ fontSize: '0.75rem', color: 'var(--danger)', marginTop: '0.25rem' }}>
                                                                ⚠️ Due soon
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    '-'
                                                )}
                                            </td>
                                            <td>{task.assigned_by_name}</td>
                                            <td>
                                                <div className="action-buttons">
                                                    {task.status === 'pending' && (
                                                        <button
                                                            className="btn btn-sm btn-primary"
                                                            onClick={() => handleStatusUpdate(task.id, 'in-progress')}
                                                            disabled={updatingTaskId === task.id}
                                                        >
                                                            {updatingTaskId === task.id ? '...' : '▶️ Start'}
                                                        </button>
                                                    )}
                                                    {task.status === 'in-progress' && (
                                                        <button
                                                            className="btn btn-sm btn-success"
                                                            onClick={() => handleStatusUpdate(task.id, 'completed')}
                                                            disabled={updatingTaskId === task.id}
                                                        >
                                                            {updatingTaskId === task.id ? '...' : '✅ Complete'}
                                                        </button>
                                                    )}
                                                    {task.status === 'completed' && (
                                                        <span style={{ color: 'var(--success)', fontSize: '0.875rem' }}>
                                                            ✓ Completed {task.completed_at && `on ${new Date(task.completed_at).toLocaleDateString()}`}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="card" style={{ marginTop: '1.5rem', background: 'var(--info-light)', borderLeft: '4px solid var(--info)' }}>
                    <div className="card-body">
                        <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1rem', color: 'var(--gray-700)' }}>
                            ℹ️ Task Status Guide
                        </h3>
                        <ul style={{ margin: 0, paddingLeft: '1.5rem', color: 'var(--gray-600)', fontSize: '0.875rem' }}>
                            <li><strong>Pending:</strong> Task assigned, click "Start" to begin working</li>
                            <li><strong>In Progress:</strong> Currently working on this task</li>
                            <li><strong>Completed:</strong> Task finished successfully</li>
                            <li>You can only update the status of tasks - use the action buttons</li>
                        </ul>
                    </div>
                </div>
            </div>
        </MainLayout>
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

const isDueSoon = (dueDate) => {
    const due = new Date(dueDate);
    const today = new Date();
    const diffTime = due - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays <= 3 && diffDays >= 0;
};

export default MyTasks;
