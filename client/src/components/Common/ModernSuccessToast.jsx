import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const ModernSuccessToast = ({ message, isVisible, onClose, duration = 2000 }) => {
    useEffect(() => {
        if (isVisible) {
            const timer = setTimeout(() => {
                onClose();
            }, duration);
            return () => clearTimeout(timer);
        }
    }, [isVisible, onClose, duration]);

    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    style={{
                        position: 'fixed',
                        bottom: '24px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        zIndex: 10000,
                        backgroundColor: '#111111',
                        color: '#ffffff',
                        padding: '12px 20px',
                        borderRadius: '12px',
                        fontSize: '0.875rem',
                        fontWeight: '500',
                        boxShadow: '0 8px 16px rgba(0, 0, 0, 0.4)',
                        borderLeft: '3px solid #bcf000',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        minWidth: '280px',
                        maxWidth: '90vw',
                    }}
                >
                    <div style={{ flex: 1 }}>{message}</div>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: 'rgba(255,255,255,0.4)',
                            cursor: 'pointer',
                            fontSize: '1.25rem',
                            padding: '4px',
                            lineHeight: 1,
                        }}
                    >
                        ×
                    </button>
                    {/* Responsive for Desktop (bottom-right) */}
                    <style>
                        {`
                        @media (min-width: 768px) {
                            .modern-toast-wrapper {
                                left: auto !important;
                                right: 24px !important;
                                transform: none !important;
                            }
                        }
                        `}
                    </style>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default ModernSuccessToast;
