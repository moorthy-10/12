import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const BrandSuccessAnimation = ({ isVisible, onClose }) => {
    useEffect(() => {
        if (isVisible) {
            const timer = setTimeout(() => {
                onClose();
            }, 600); // 450ms animation + some buffer
            return () => clearTimeout(timer);
        }
    }, [isVisible, onClose]);

    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: 'rgba(16, 16, 16, 0.4)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 9999,
                        pointerEvents: 'none',
                    }}
                >
                    <motion.div
                        initial={{ scale: 0.8, rotate: -15, opacity: 0 }}
                        animate={{
                            scale: [0.9, 1.1, 1],
                            rotate: [-10, 10, 0],
                            opacity: 1
                        }}
                        exit={{ scale: 1.2, opacity: 0 }}
                        transition={{
                            duration: 0.4,
                            ease: "easeInOut"
                        }}
                        style={{
                            width: '100px',
                            height: '100px',
                            backgroundColor: '#bcf000',
                            borderRadius: '24px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#101010',
                            fontSize: '2rem',
                            fontWeight: 'bold',
                            boxShadow: '0 0 30px rgba(188, 240, 0, 0.4)',
                        }}
                    >
                        GL
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default BrandSuccessAnimation;
