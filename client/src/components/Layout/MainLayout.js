import './MainLayout.css';
import React from 'react';
import Sidebar from './Sidebar';
import Header from './Header';

const MainLayout = ({ title, children }) => {
    return (
        <div className="main-layout">
            <Sidebar />
            <div className="main-content">
                <Header title={title} />
                <main className="page-content">
                    {children}
                </main>
            </div>
        </div>
    );
};

export default MainLayout;
