import './Header.css';
import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const Header = ({ title }) => {
    const { logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <header className="header">
            <div className="header-content">
                <h1 className="header-title">{title}</h1>

                <div className="header-actions">
                    <button className="btn btn-secondary btn-sm" onClick={handleLogout}>
                        🚪 Logout
                    </button>
                </div>
            </div>
        </header>
    );
};

export default Header;
