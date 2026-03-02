import './Header.css';
import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import NotificationBell from './NotificationBell';
import { searchAPI } from '../../api/api';
import ScrumCallModal from '../Scrum/ScrumCallModal';
import AnimatedButton from '../Common/AnimatedButton';

const Header = ({ title, onMenuToggle }) => {
    const { logout, isAdmin, user, permissions } = useAuth();
    const navigate = useNavigate();

    const [scrumOpen, setScrumOpen] = useState(false);

    const [query, setQuery] = useState('');
    const [results, setResults] = useState(null);
    const [loading, setLoading] = useState(false);
    const [showDropdown, setShowDropdown] = useState(false);
    const dropdownRef = useRef(null);
    const searchRef = useRef(null);

    // Close dropdown on click outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target) &&
                searchRef.current && !searchRef.current.contains(event.target)) {
                setShowDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Debounced search
    useEffect(() => {
        if (!query || query.trim().length < 2) {
            setResults(null);
            setShowDropdown(false);
            return;
        }

        const timer = setTimeout(async () => {
            setLoading(true);
            try {
                const response = await searchAPI.query(query);
                setResults(response.data.results);
                setShowDropdown(true);
            } catch (error) {
                console.error('Search failed:', error);
            } finally {
                setLoading(false);
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [query]);

    const handleResultClick = (link) => {
        navigate(link);
        setQuery('');
        setShowDropdown(false);
    };

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

                    <div className="header-search-container" ref={searchRef}>
                        <div className="search-input-wrapper">
                            <input
                                type="text"
                                className="header-search-input"
                                placeholder="Search employees, tasks, groups..."
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                onFocus={() => query.length >= 2 && setShowDropdown(true)}
                            />
                            {loading && <div className="search-loader" />}
                        </div>

                        {showDropdown && results && (
                            <div className="search-dropdown" ref={dropdownRef}>
                                {Object.keys(results).every(k => results[k].length === 0) ? (
                                    <div className="search-no-results">No matches found</div>
                                ) : (
                                    Object.keys(results).map(category => (
                                        results[category].length > 0 && (
                                            <div key={category} className="search-section">
                                                <div className="search-section-title">{category.toUpperCase()}</div>
                                                {results[category].map(item => (
                                                    <div
                                                        key={item.id}
                                                        className="search-result-item"
                                                        onClick={() => handleResultClick(item.link)}
                                                    >
                                                        <div className="result-title">{item.title}</div>
                                                        <div className="result-caption">{item.caption}</div>
                                                    </div>
                                                ))}
                                            </div>
                                        )
                                    ))
                                )}
                            </div>
                        )}
                    </div>
                </div>

                <div className="header-actions">
                    {permissions.includes('START_SCRUM') && (
                        <AnimatedButton
                            className="btn btn-primary btn-sm scrum-trigger-btn"
                            onClick={() => setScrumOpen(true)}
                            title="Start a Scrum Call"
                        >
                            <span className="scrum-label">Scrum Call</span>
                        </AnimatedButton>
                    )}
                    <AnimatedButton className="btn btn-secondary btn-sm" onClick={() => navigate('/change-password')} title="Settings">
                        <span className="logout-label">Settings</span>
                    </AnimatedButton>
                    <NotificationBell isAdmin={isAdmin} />
                    <AnimatedButton className="btn btn-secondary btn-sm" onClick={handleLogout}>
                        <span className="logout-label">Logout</span>
                    </AnimatedButton>

                    <ScrumCallModal
                        isOpen={scrumOpen}
                        onClose={() => setScrumOpen(false)}
                    />
                </div>
            </div>
        </header>
    );
};

export default Header;
