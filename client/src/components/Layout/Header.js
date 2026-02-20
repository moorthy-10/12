import './Header.css';
import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import NotificationBell from './NotificationBell';

const Header = ({ title, onMenuToggle }) => {
    const { logout, isAdmin } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <header className="header">
            <div className="header-content">
                <div className="header-left">
                    {/* Hamburger — only visible on mobile/tablet */}
                    <button
                        className="hamburger-btn"
                        onClick={onMenuToggle}
                        aria-label="Toggle navigation menu"
                        id="hamburger-toggle"
                    >
                        <span className="hamburger-line"></span>
                        <span className="hamburger-line"></span>
                        <span className="hamburger-line"></span>
                    </button>
                    <h1 className="header-title">{title}</h1>
                </div>

                <div className="header-actions">
                    <NotificationBell isAdmin={isAdmin} />
                    <button className="btn btn-secondary btn-sm" onClick={handleLogout}>
                        🚪 <span className="logout-label">Logout</span>
                    </button>
                </div>
            </div>
        </header>
    );
};

export default Header;
