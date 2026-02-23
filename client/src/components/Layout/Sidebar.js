import './Sidebar.css';
import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const Sidebar = ({ isOpen, onClose }) => {
    const { user, isAdmin } = useAuth();

    const adminMenuItems = [
        { path: '/dashboard', label: 'Dashboard' },
        { path: '/employees', label: 'Employees' },
        { path: '/attendance', label: 'Attendance' },
        { path: '/leaves', label: 'Leave Requests' },
        { path: '/tasks', label: 'Tasks' },
        { path: '/groups', label: 'Group Chat' },
        { path: '/calendar', label: 'Calendar' },
    ];

    const employeeMenuItems = [
        { path: '/dashboard', label: 'Dashboard' },
        { path: '/my-attendance', label: 'My Attendance' },
        { path: '/my-leaves', label: 'My Leaves' },
        { path: '/my-tasks', label: 'My Tasks' },
        { path: '/groups', label: 'Group Chat' },
        { path: '/calendar', label: 'Calendar' },
    ];

    const menuItems = isAdmin ? adminMenuItems : employeeMenuItems;

    return (
        <>
            {/* Mobile overlay backdrop */}
            {isOpen && (
                <div
                    className="sidebar-overlay"
                    onClick={onClose}
                    aria-label="Close sidebar"
                />
            )}

            <aside className={`sidebar${isOpen ? ' sidebar-open' : ''}`}>
                <div className="sidebar-header">
                    <NavLink to="/dashboard" className="logo-link" onClick={onClose}>
                        <img
                            src="/genlab-logo.png"
                            alt="GenLab Logo"
                            className="logo-image"
                        />
                    </NavLink>
                    {/* Close button visible on mobile */}
                    <button
                        className="sidebar-close-btn"
                        onClick={onClose}
                        aria-label="Close sidebar"
                    >
                        ✕
                    </button>
                </div>

                <nav className="sidebar-nav">
                    {menuItems.map((item) => (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            onClick={onClose}
                            className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                        >
                            <span className="sidebar-label">{item.label}</span>
                        </NavLink>
                    ))}
                </nav>

                <div className="sidebar-footer">
                    <div className="user-info">
                        <div className="user-avatar">
                            {user?.name?.charAt(0).toUpperCase()}
                        </div>
                        <div className="user-details">
                            <div className="user-name">{user?.name}</div>
                            <div className="user-role">{user?.role}</div>
                        </div>
                    </div>
                </div>
            </aside>
        </>
    );
};

export default Sidebar;
