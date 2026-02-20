import './MainLayout.css';
import React, { useState } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';

const MainLayout = ({ title, children }) => {
    const [sidebarOpen, setSidebarOpen] = useState(false);

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
                    {children}
                </main>
            </div>
        </div>
    );
};

export default MainLayout;
