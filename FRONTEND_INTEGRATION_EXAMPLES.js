/**
 * Frontend Integration Example
 * This file shows how to call the new admin create-user endpoint
 * from your existing React frontend
 */

import axios from 'axios';

// =============================================================================
// Example 1: Basic Function to Create User
// =============================================================================

/**
 * Create a new user (Admin only)
 * @param {string} name - User's full name
 * @param {string} email - User's email address
 * @param {string} adminToken - Admin JWT token
 * @returns {Promise<Object>} Created user data
 */
export async function createNewUser(name, email, adminToken) {
    try {
        const response = await axios.post(
            '/api/admin/create-user',
            {
                name: name.trim(),
                email: email.trim().toLowerCase()
            },
            {
                headers: {
                    'Authorization': `Bearer ${adminToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        return {
            success: true,
            user: response.data.user,
            message: response.data.message
        };
    } catch (error) {
        return {
            success: false,
            message: error.response?.data?.message || 'Failed to create user',
            errors: error.response?.data?.errors
        };
    }
}

// =============================================================================
// Example 2: React Component with Form
// =============================================================================

import React, { useState } from 'react';

function CreateUserForm({ adminToken }) {
    const [formData, setFormData] = useState({
        name: '',
        email: ''
    });
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState(null);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage(null);

        try {
            const response = await axios.post(
                '/api/admin/create-user',
                {
                    name: formData.name,
                    email: formData.email
                },
                {
                    headers: {
                        'Authorization': `Bearer ${adminToken}`
                    }
                }
            );

            if (response.data.success) {
                setMessage({
                    type: 'success',
                    text: response.data.message
                });

                // Reset form
                setFormData({ name: '', email: '' });

                // Optional: Refresh user list
                // refreshUserList();
            }
        } catch (error) {
            setMessage({
                type: 'error',
                text: error.response?.data?.message || 'Failed to create user'
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit}>
            <div>
                <label>Name:</label>
                <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                />
            </div>

            <div>
                <label>Email:</label>
                <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                />
            </div>

            <button type="submit" disabled={loading}>
                {loading ? 'Creating...' : 'Create User'}
            </button>

            {message && (
                <div className={`message ${message.type}`}>
                    {message.text}
                </div>
            )}
        </form>
    );
}

// =============================================================================
// Example 3: Integration with Existing "Create User" Button
// =============================================================================

// If you already have a "Create User" button, modify its onClick handler:

const handleCreateUserClick = async () => {
    // Get admin token from your auth context/state
    const token = localStorage.getItem('token'); // or from your auth context

    // Show a modal or form to get name and email
    const name = prompt('Enter user name:');
    const email = prompt('Enter user email:');

    if (!name || !email) {
        alert('Name and email are required');
        return;
    }

    try {
        const response = await axios.post(
            '/api/admin/create-user',
            { name, email },
            {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            }
        );

        if (response.data.success) {
            alert('✅ User created successfully! Credentials sent via email.');

            // Refresh your user list or close modal
            // refreshUsers();
        }
    } catch (error) {
        const errorMessage = error.response?.data?.message || 'Failed to create user';
        alert(`❌ ${errorMessage}`);

        // Handle specific errors
        if (error.response?.status === 403) {
            alert('You do not have admin privileges');
        }
    }
};

// =============================================================================
// Example 4: With React Context (Recommended)
// =============================================================================

import { useAuth } from '../contexts/AuthContext'; // Your auth context

function AdminPanel() {
    const { user, token } = useAuth();
    const [showCreateModal, setShowCreateModal] = useState(false);

    const createUser = async (name, email) => {
        try {
            const response = await axios.post(
                '/api/admin/create-user',
                { name, email },
                {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                }
            );

            if (response.data.success) {
                // Show success notification
                toast.success('User created and email sent!');
                setShowCreateModal(false);
                return true;
            }
        } catch (error) {
            // Show error notification
            toast.error(error.response?.data?.message || 'Failed to create user');
            return false;
        }
    };

    // Only show for admin users
    if (user?.role !== 'admin') {
        return null;
    }

    return (
        <div>
            <button onClick={() => setShowCreateModal(true)}>
                Create New User
            </button>

            {showCreateModal && (
                <CreateUserModal
                    onSubmit={createUser}
                    onClose={() => setShowCreateModal(false)}
                />
            )}
        </div>
    );
}

// =============================================================================
// Example 5: Error Handling with Specific Cases
// =============================================================================

async function createUserWithErrorHandling(name, email, token) {
    try {
        const response = await axios.post(
            '/api/admin/create-user',
            { name, email },
            {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            }
        );

        // Success - credentials sent
        return {
            success: true,
            user: response.data.user,
            message: 'User created successfully'
        };

    } catch (error) {
        const status = error.response?.status;
        const message = error.response?.data?.message;

        // Handle specific error cases
        if (status === 400) {
            if (message.includes('already exists')) {
                return {
                    success: false,
                    error: 'EMAIL_EXISTS',
                    message: 'A user with this email already exists'
                };
            } else {
                return {
                    success: false,
                    error: 'VALIDATION_ERROR',
                    message: message || 'Invalid input data'
                };
            }
        } else if (status === 401) {
            return {
                success: false,
                error: 'UNAUTHORIZED',
                message: 'Please login again'
            };
        } else if (status === 403) {
            return {
                success: false,
                error: 'FORBIDDEN',
                message: 'Admin privileges required'
            };
        } else if (status === 500) {
            return {
                success: false,
                error: 'SERVER_ERROR',
                message: 'Server error. Please try again later.'
            };
        } else {
            return {
                success: false,
                error: 'NETWORK_ERROR',
                message: 'Network error. Please check your connection.'
            };
        }
    }
}

// =============================================================================
// Example 6: TypeScript Version (if using TypeScript)
// =============================================================================

interface CreateUserRequest {
    name: string;
    email: string;
}

interface CreateUserResponse {
    success: boolean;
    message: string;
    user?: {
        id: number;
        name: string;
        email: string;
        role: string;
        status: string;
        created_at: string;
    };
    warning?: string;
}

const createUser = async (
    data: CreateUserRequest,
    token: string
): Promise<CreateUserResponse> => {
    const response = await axios.post < CreateUserResponse > (
        '/api/admin/create-user',
        data,
        {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        }
    );

    return response.data;
};

// =============================================================================
// Usage Notes
// =============================================================================

/*
IMPORTANT:
1. Never send the password from frontend - it's auto-generated on backend
2. Only send: { name, email }
3. Always include admin JWT token in Authorization header
4. Handle the case where email is sent but user should see success
5. User will receive credentials via email (n8n workflow)
6. The forcePasswordChange flag ensures user must change password on first login

RESPONSE TYPES:
- 201: Success - user created, email sent
- 201 with warning: User created but email failed
- 400: Validation error or duplicate email
- 401: No token provided
- 403: Not an admin user
- 500: Server error or n8n not configured

SUCCESS FLOW:
1. Admin clicks "Create User"
2. Admin enters name and email
3. Frontend calls POST /api/admin/create-user
4. Backend generates secure password
5. Backend saves user in database
6. Backend triggers n8n webhook
7. n8n sends email with credentials
8. Frontend shows success message
9. New user receives email and can login

ERROR HANDLING:
- Always show user-friendly messages
- Log detailed errors for debugging
- Allow retry on failure
- Show warning if email failed but user created
*/

export default createUser;
