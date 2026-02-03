import './Employees.css';
import React, { useState, useEffect } from 'react';
import MainLayout from '../../components/Layout/MainLayout';
import Modal from '../../components/Modal/Modal';
import { userAPI } from '../../api/api';

const Employees = () => {
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({ search: '', role: '', status: '' });
    const [showModal, setShowModal] = useState(false);
    const [editingEmployee, setEditingEmployee] = useState(null);

    useEffect(() => {
        fetchEmployees();
    }, [filters]);

    const fetchEmployees = async () => {
        try {
            const response = await userAPI.getAll(filters);
            setEmployees(response.data.users);
        } catch (error) {
            console.error('Failed to fetch employees:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleFilterChange = (key, value) => {
        setFilters({ ...filters, [key]: value });
    };

    const handleAddEmployee = () => {
        setEditingEmployee(null);
        setShowModal(true);
    };

    const handleEditEmployee = (employee) => {
        setEditingEmployee(employee);
        setShowModal(true);
    };

    const handleDeleteEmployee = async (id) => {
        if (!window.confirm('Are you sure you want to delete this employee?')) return;

        try {
            await userAPI.delete(id);
            fetchEmployees();
        } catch (error) {
            alert('Failed to delete employee');
        }
    };

    const handleModalClose = () => {
        setShowModal(false);
        setEditingEmployee(null);
    };

    const handleModalSuccess = () => {
        fetchEmployees();
        handleModalClose();
    };

    if (loading) {
        return (
            <MainLayout title="Employees">
                <div className="loader-container">
                    <div className="loader"></div>
                </div>
            </MainLayout>
        );
    }

    return (
        <MainLayout title="Employees">
            <div className="employees-page">
                <div className="page-header">
                    <div className="page-filters">
                        <input
                            type="text"
                            className="form-input"
                            placeholder="🔍 Search by name, email..."
                            value={filters.search}
                            onChange={(e) => handleFilterChange('search', e.target.value)}
                            style={{ minWidth: '250px' }}
                        />

                        <select
                            className="form-select"
                            value={filters.role}
                            onChange={(e) => handleFilterChange('role', e.target.value)}
                        >
                            <option value="">All Roles</option>
                            <option value="admin">Admin</option>
                            <option value="employee">Employee</option>
                        </select>

                        <select
                            className="form-select"
                            value={filters.status}
                            onChange={(e) => handleFilterChange('status', e.target.value)}
                        >
                            <option value="">All Status</option>
                            <option value="active">Active</option>
                            <option value="inactive">Inactive</option>
                        </select>
                    </div>

                    <button className="btn btn-primary" onClick={handleAddEmployee}>
                        ➕ Add Employee
                    </button>
                </div>

                <div className="card">
                    <div className="table-container">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Email</th>
                                    <th>Role</th>
                                    <th>Department</th>
                                    <th>Position</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {employees.length === 0 ? (
                                    <tr>
                                        <td colSpan="7" className="text-center" style={{ padding: '2rem', color: 'var(--gray-500)' }}>
                                            No employees found
                                        </td>
                                    </tr>
                                ) : (
                                    employees.map((employee) => (
                                        <tr key={employee.id}>
                                            <td>
                                                <div className="employee-name">
                                                    <div className="employee-avatar">{employee.name.charAt(0)}</div>
                                                    {employee.name}
                                                </div>
                                            </td>
                                            <td>{employee.email}</td>
                                            <td>
                                                <span className={`badge badge-${employee.role === 'admin' ? 'info' : 'gray'}`}>
                                                    {employee.role}
                                                </span>
                                            </td>
                                            <td>{employee.department || '-'}</td>
                                            <td>{employee.position || '-'}</td>
                                            <td>
                                                <span className={`badge badge-${employee.status === 'active' ? 'success' : 'danger'}`}>
                                                    {employee.status}
                                                </span>
                                            </td>
                                            <td>
                                                <div className="action-buttons">
                                                    <button
                                                        className="btn btn-sm btn-secondary"
                                                        onClick={() => handleEditEmployee(employee)}
                                                    >
                                                        ✏️ Edit
                                                    </button>
                                                    <button
                                                        className="btn btn-sm btn-danger"
                                                        onClick={() => handleDeleteEmployee(employee.id)}
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
                <EmployeeModal
                    employee={editingEmployee}
                    onClose={handleModalClose}
                    onSuccess={handleModalSuccess}
                />
            )}
        </MainLayout>
    );
};

const EmployeeModal = ({ employee, onClose, onSuccess }) => {
    const isEditing = !!employee;
    const [formData, setFormData] = useState({
        name: employee?.name || '',
        email: employee?.email || '',
        password: '',
        role: employee?.role || 'employee',
        department: employee?.department || '',
        position: employee?.position || '',
        phone: employee?.phone || '',
        status: employee?.status || 'active'
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
                await userAPI.update(employee.id, formData);
            } else {
                if (!formData.password || formData.password.length < 6) {
                    setError('Password must be at least 6 characters');
                    setLoading(false);
                    return;
                }
                await userAPI.create(formData);
            }
            onSuccess();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to save employee');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            isOpen={true}
            onClose={onClose}
            title={isEditing ? 'Edit Employee' : 'Add New Employee'}
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
                    <label className="form-label">Full Name *</label>
                    <input
                        type="text"
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                        className="form-input"
                        required
                    />
                </div>

                <div className="form-group">
                    <label className="form-label">Email Address *</label>
                    <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        className="form-input"
                        required
                    />
                </div>

                {!isEditing && (
                    <div className="form-group">
                        <label className="form-label">Password * (min 6 characters)</label>
                        <input
                            type="password"
                            name="password"
                            value={formData.password}
                            onChange={handleChange}
                            className="form-input"
                            required
                        />
                    </div>
                )}

                <div className="form-group">
                    <label className="form-label">Role *</label>
                    <select name="role" value={formData.role} onChange={handleChange} className="form-select" required>
                        <option value="employee">Employee</option>
                        <option value="admin">Admin</option>
                    </select>
                </div>

                <div className="form-group">
                    <label className="form-label">Department</label>
                    <input
                        type="text"
                        name="department"
                        value={formData.department}
                        onChange={handleChange}
                        className="form-input"
                    />
                </div>

                <div className="form-group">
                    <label className="form-label">Position</label>
                    <input
                        type="text"
                        name="position"
                        value={formData.position}
                        onChange={handleChange}
                        className="form-input"
                    />
                </div>

                <div className="form-group">
                    <label className="form-label">Phone</label>
                    <input
                        type="tel"
                        name="phone"
                        value={formData.phone}
                        onChange={handleChange}
                        className="form-input"
                    />
                </div>

                <div className="form-group">
                    <label className="form-label">Status *</label>
                    <select name="status" value={formData.status} onChange={handleChange} className="form-select" required>
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                    </select>
                </div>
            </form>
        </Modal>
    );
};

export default Employees;
