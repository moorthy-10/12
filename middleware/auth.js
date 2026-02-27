const jwt = require('jsonwebtoken');

// Verify JWT token
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({
            success: false,
            message: 'Access denied. No token provided.'
        });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(403).json({
            success: false,
            message: 'Invalid or expired token.'
        });
    }
};

// Check if user has elevated access (Admin, HR Admin, Manager)
const isAdmin = (req, res, next) => {
    const roles = req.user.roles || [req.user.role];
    const elevated = ['admin', 'hr_admin', 'manager'];
    if (!roles.some(r => elevated.includes(r))) {
        return res.status(403).json({ success: false, message: 'Elevated privileges required.' });
    }
    next();
};

// Check if user is active staff
const isEmployee = (req, res, next) => {
    const roles = req.user.roles || [req.user.role];
    if (!roles.some(r => ['admin', 'employee', 'manager', 'hr_admin', 'hr', 'teamlead', 'intern'].includes(r))) {
        return res.status(403).json({ success: false, message: 'Access denied.' });
    }
    next();
};

// Permission-based authorization
const authorize = (requiredPermissions = []) => {
    return (req, res, next) => {
        if (!req.user) return res.status(401).json({ success: false, message: 'Unauthorized' });

        // Admin bypass
        if (req.user.role === 'admin') return next();

        const userPermissions = req.user.permissions || [];
        const hasPermission = requiredPermissions.length === 0 ||
            requiredPermissions.some(p => userPermissions.includes(p));

        if (!hasPermission) {
            return res.status(403).json({
                success: false,
                message: `Forbidden: Requires ${requiredPermissions.join(', ')}`
            });
        }
        next();
    };
};

module.exports = {
    authenticateToken,
    isAdmin,
    isEmployee,
    authorize
};
