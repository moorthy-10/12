import './Employees.css';
import React, { useState, useEffect } from 'react';
import MainLayout from '../../components/Layout/MainLayout';
import Modal from '../../components/Modal/Modal';
import { userAPI, adminAPI, departmentAPI } from '../../api/api';

const Employees = () => {
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({ search: '', role: '', status: '' });
    const [showModal, setShowModal] = useState(false);
    const [editingEmployee, setEditingEmployee] = useState(null);
    const [passwordInfo, setPasswordInfo] = useState(null); // { name, email, password }
    const [resettingId, setResettingId] = useState(null);
    const [departments, setDepartments] = useState([]);
    const [availableManagers, setAvailableManagers] = useState([]);

    useEffect(() => {
        fetchInitialData();
    }, []);

    const fetchInitialData = async () => {
        try {
            const [deptRes, managersRes] = await Promise.all([
                departmentAPI.getAll(),
                userAPI.getAll({ role: 'manager' }) // Simplification for demo
            ]);
            setDepartments(deptRes.data.departments);
            setAvailableManagers(managersRes.data.users);
        } catch (error) {
            console.error('Failed to fetch initial data:', error);
        }
    };

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

    const handleModalSuccess = (tempPasswordData) => {
        fetchEmployees();
        handleModalClose();
        if (tempPasswordData) {
            setPasswordInfo(tempPasswordData);
        }
    };

    const handleResetPassword = async (employee) => {
        if (!window.confirm(`Reset password for ${employee.name}? A new temporary password will be generated.`)) return;
        setResettingId(employee.id);
        try {
            const res = await adminAPI.resetPassword(employee.id);
            setPasswordInfo({
                name: employee.name,
                email: employee.email,
                password: res.data.temporaryPassword
            });
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to reset password');
        } finally {
            setResettingId(null);
        }
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
                            <option value="hr_admin">HR Admin</option>
                            <option value="hr">HR</option>
                            <option value="manager">Manager</option>
                            <option value="teamlead">Team Lead</option>
                            <option value="employee">Employee</option>
                            <option value="intern">Intern</option>
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
                                                <div className="role-badges">
                                                    {(employee.roles && employee.roles.length > 0 ? employee.roles : [employee.role]).map(r => (
                                                        <span key={r} className={`badge badge-${r === 'hr_admin' || r === 'admin' ? 'info' : 'gray'}`} style={{ marginRight: '4px', fontSize: '0.7rem', display: 'inline-block' }}>
                                                            {r.replace('_', ' ')}
                                                        </span>
                                                    ))}
                                                </div>
                                            </td>
                                            <td>{employee.department_ref?.name || employee.department || '-'}</td>
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
                                                        className="btn btn-sm btn-warning"
                                                        onClick={() => handleResetPassword(employee)}
                                                        disabled={resettingId === employee.id}
                                                        title="Generate new temporary password"
                                                    >
                                                        {resettingId === employee.id ? '⏳' : '🔑'} Reset PW
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
                    departments={departments}
                    managers={availableManagers}
                    onClose={handleModalClose}
                    onSuccess={handleModalSuccess}
                />
            )}

            {passwordInfo && (
                <PasswordModal
                    info={passwordInfo}
                    onClose={() => setPasswordInfo(null)}
                />
            )}
        </MainLayout>
    );
};

const EmployeeModal = ({ employee, departments, managers, onClose, onSuccess }) => {
    const isEditing = !!employee;
    const [formData, setFormData] = useState({
        name: employee?.name || '',
        email: employee?.email || '',
        password: '',
        role: employee?.role || 'employee',
        roles: employee?.roles || (employee?.role ? [employee.role] : ['employee']),
        department_ref: employee?.department_ref?._id || employee?.department_ref || '',
        position: employee?.position || '',
        phone: employee?.phone || '',
        status: employee?.status || 'active',
        reports_to: employee?.reports_to?._id || employee?.reports_to || '',
        employment_type: employee?.employment_type || 'fulltime'
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData({ ...formData, [name]: value });
    };

    const handleRoleToggle = (role) => {
        const newRoles = formData.roles.includes(role)
            ? formData.roles.filter(r => r !== role)
            : [...formData.roles, role];
        setFormData({ ...formData, roles: newRoles });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            if (isEditing) {
                await userAPI.update(employee.id, formData);
                onSuccess();
            } else {
                const response = await adminAPI.createUser(formData);
                // Pass temp password back to parent so it shows in PasswordModal
                onSuccess(
                    response.data.temporaryPassword
                        ? { name: formData.name, email: formData.email, password: response.data.temporaryPassword }
                        : null
                );
            }
        } catch (err) {
            const errorMessage = err.response?.data?.message || 'Failed to save employee';
            setError(errorMessage);
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

                {!isEditing && (
                    <div style={{ marginBottom: '1rem', padding: '0.75rem', background: '#f0fde4', borderRadius: 'var(--radius)', color: '#3a5c00', border: '1px solid #bcf000' }}>
                        🔑 A secure temporary password will be generated automatically and shown to you after creation.
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

                <div className="form-group">
                    <label className="form-label">Roles (Detailed Permissions) *</label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', padding: '10px', background: '#f5f5f5', borderRadius: 'var(--radius)' }}>
                        {['hr_admin', 'hr', 'manager', 'teamlead', 'intern', 'employee'].map(r => (
                            <label key={r} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', cursor: 'pointer' }}>
                                <input
                                    type="checkbox"
                                    checked={formData.roles.includes(r)}
                                    onChange={() => handleRoleToggle(r)}
                                />
                                {r.replace('_', ' ').toUpperCase()}
                            </label>
                        ))}
                    </div>
                </div>

                <div className="form-group">
                    <label className="form-label">Employment Type</label>
                    <select name="employment_type" value={formData.employment_type} onChange={handleChange} className="form-select">
                        <option value="fulltime">Full-time</option>
                        <option value="intern">Intern</option>
                    </select>
                </div>

                <div className="form-group">
                    <label className="form-label">Department</label>
                    <select name="department_ref" value={formData.department_ref} onChange={handleChange} className="form-select">
                        <option value="">Select Department</option>
                        {departments.map(d => (
                            <option key={d._id} value={d._id}>{d.name}</option>
                        ))}
                    </select>
                </div>

                <div className="form-group">
                    <label className="form-label">Reports To (Manager)</label>
                    <select name="reports_to" value={formData.reports_to} onChange={handleChange} className="form-select">
                        <option value="">None</option>
                        {managers.map(m => (
                            <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                    </select>
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

// ── Password Reveal Modal ─────────────────────────────────────────────────────
const PasswordModal = ({ info, onClose }) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(info.password).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2500);
        });
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" style={{ maxWidth: '440px' }} onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2 className="modal-title">🔑 Temporary Password</h2>
                    <button className="modal-close" onClick={onClose}>×</button>
                </div>
                <div className="modal-body">
                    <div style={{ marginBottom: '1rem', padding: '0.875rem', background: '#fff8e1', borderRadius: 'var(--radius)', border: '1px solid #ffd54f' }}>
                        ⚠️ <strong>Share this password with the user immediately.</strong> It will not be shown again.
                    </div>

                    <div style={{ marginBottom: '0.5rem' }}>
                        <span style={{ fontSize: '0.8125rem', color: 'var(--gray-500)', fontWeight: '500' }}>User</span>
                        <div style={{ fontWeight: '600', color: 'var(--gray-900)' }}>{info.name}</div>
                        <div style={{ fontSize: '0.8125rem', color: 'var(--gray-500)' }}>{info.email}</div>
                    </div>

                    <div style={{ marginTop: '1.25rem' }}>
                        <span style={{ fontSize: '0.8125rem', color: 'var(--gray-500)', fontWeight: '500', display: 'block', marginBottom: '0.375rem' }}>Temporary Password</span>
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: '0.625rem',
                            background: '#101010', borderRadius: 'var(--radius)',
                            padding: '0.75rem 1rem'
                        }}>
                            <code style={{
                                flex: 1, fontFamily: 'monospace', fontSize: '1.05rem',
                                letterSpacing: '0.05em', color: '#bcf000',
                                wordBreak: 'break-all'
                            }}>
                                {info.password}
                            </code>
                            <button
                                onClick={handleCopy}
                                style={{
                                    background: copied ? '#bcf000' : 'rgba(188,240,0,0.15)',
                                    border: '1px solid #bcf000',
                                    color: copied ? '#000' : '#bcf000',
                                    borderRadius: 'var(--radius-sm)',
                                    padding: '0.375rem 0.75rem',
                                    cursor: 'pointer',
                                    fontSize: '0.8125rem',
                                    fontWeight: '600',
                                    flexShrink: 0,
                                    transition: 'all 0.2s'
                                }}
                            >
                                {copied ? '✓ Copied' : '📋 Copy'}
                            </button>
                        </div>
                    </div>
                </div>
                <div className="modal-footer">
                    <button className="btn btn-primary" onClick={onClose}>Done</button>
                </div>
            </div>
        </div>
    );
};
