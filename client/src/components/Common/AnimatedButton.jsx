import React from 'react';
import { motion } from 'framer-motion';

const AnimatedButton = ({
    children,
    onClick,
    className = "btn btn-primary",
    disabled = false,
    type = "button",
    style = {}
}) => {
    return (
        <motion.button
            whileTap={{ scale: 0.97 }}
            whileHover={{ scale: 1.02 }}
            onClick={onClick}
            className={className}
            disabled={disabled}
            type={type}
            style={{
                ...style,
                position: 'relative',
                overflow: 'hidden',
                willChange: 'transform'
            }}
            transition={{
                duration: 0.12,
                ease: "easeOut"
            }}
        >
            {children}
        </motion.button>
    );
};

export default AnimatedButton;
