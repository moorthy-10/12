import './MainLayout.css';
import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';

const MainLayout = ({ title, children }) => {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const location = useLocation();

    return (
        <div className="main-layout">
            <Sidebar
                isOpen={sidebarOpen}
                onClose={() => setSidebarOpen(false)}
            />
            <div className="main-content">
                <Header
                    title={title}
                    onMenuToggle={() => setSidebarOpen(prev => !prev)}
                />
                <main className="page-content">
                    <div key={location.pathname} className="page-transition-wrapper">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
};

export default MainLayout;
