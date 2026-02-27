'use strict';

const ROLE_PERMISSIONS = {
    hr_admin: [
        "MANAGE_EMPLOYEES",
        "EDIT_ANY_ATTENDANCE",
        "VIEW_ALL_ATTENDANCE",
        "APPROVE_ANY_LEAVE",
        "VIEW_ALL_REPORTS",
        "ASSIGN_ROLES",
        "ASSIGN_TASK",
        "VIEW_TEAM_PERFORMANCE"
    ],
    hr: [
        "MANAGE_EMPLOYEES",
        "VIEW_DEPARTMENT_ATTENDANCE",
        "APPROVE_DEPARTMENT_LEAVE",
        "VIEW_ALL_REPORTS"
    ],
    manager: [
        "VIEW_TEAM_ATTENDANCE",
        "APPROVE_TEAM_LEAVE",
        "ASSIGN_TASK",
        "VIEW_TEAM_PERFORMANCE"
    ],
    teamlead: [
        "VIEW_TEAM_ATTENDANCE",
        "ASSIGN_TASK"
    ],
    intern: [
        "SELF_ATTENDANCE",
        "SUBMIT_LEAVE",
        "VIEW_ASSIGNED_TASKS"
    ],
    // Legacy admin mapping
    admin: [
        "MANAGE_EMPLOYEES",
        "EDIT_ANY_ATTENDANCE",
        "VIEW_ALL_ATTENDANCE",
        "APPROVE_ANY_LEAVE",
        "VIEW_ALL_REPORTS",
        "ASSIGN_ROLES"
    ],
    employee: [
        "SELF_ATTENDANCE",
        "SUBMIT_LEAVE",
        "VIEW_ASSIGNED_TASKS"
    ]
};

const getPermissionsForRoles = (roles) => {
    const perms = new Set();
    roles.forEach(role => {
        const rolePerms = ROLE_PERMISSIONS[role.toLowerCase()] || [];
        rolePerms.forEach(p => perms.add(p));
    });
    return Array.from(perms);
};

module.exports = {
    ROLE_PERMISSIONS,
    getPermissionsForRoles
};
