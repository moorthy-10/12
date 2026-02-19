import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import MainLayout from '../../components/Layout/MainLayout';
import Modal from '../../components/Modal/Modal';
import { groupAPI, userAPI } from '../../api/api';
import { useAuth } from '../../context/AuthContext';
import './Groups.css';

const Groups = () => {
    const { isAdmin } = useAuth();
    const navigate = useNavigate();
    const [groups, setGroups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);

    useEffect(() => {
        fetchGroups();
    }, []);

    const fetchGroups = async () => {
        try {
            const res = await groupAPI.getAll();
            setGroups(res.data.groups);
        } catch (err) {
            console.error('Failed to fetch groups:', err);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <MainLayout title="Group Chat">
                <div className="loader-container">
                    <div className="loader"></div>
                </div>
            </MainLayout>
        );
    }

    return (
        <MainLayout title="Group Chat">
            <div className="groups-page">
                <div className="page-header">
                    <div className="page-header-left">
                        <h2 className="page-title">💬 My Groups</h2>
                        <p className="page-subtitle">
                            {groups.length} group{groups.length !== 1 ? 's' : ''} available
                        </p>
                    </div>
                    {isAdmin && (
                        <button
                            id="create-group-btn"
                            className="btn btn-primary"
                            onClick={() => setShowCreate(true)}
                        >
                            + New Group
                        </button>
                    )}
                </div>

                {groups.length === 0 ? (
                    <div className="groups-empty">
                        <div className="empty-icon">💬</div>
                        <h3>No groups yet</h3>
                        <p>
                            {isAdmin
                                ? 'Create a group to start chatting with your team.'
                                : 'You have not been added to any group yet. Ask an admin to add you.'}
                        </p>
                    </div>
                ) : (
                    <div className="groups-grid">
                        {groups.map(group => (
                            <div
                                key={group.id}
                                className="group-card"
                                onClick={() => navigate(`/groups/${group.id}`)}
                                id={`group-card-${group.id}`}
                            >
                                <div className="group-card-icon">
                                    {group.name.charAt(0).toUpperCase()}
                                </div>
                                <div className="group-card-body">
                                    <div className="group-card-name">{group.name}</div>
                                    <div className="group-card-meta">
                                        <span>👤 {group.member_count} members</span>
                                        <span>💬 {group.message_count} messages</span>
                                    </div>
                                    <div className="group-card-creator">
                                        Created by {group.creator_name}
                                    </div>
                                </div>
                                <div className="group-card-arrow">›</div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {showCreate && (
                <CreateGroupModal
                    onClose={() => setShowCreate(false)}
                    onSuccess={() => {
                        fetchGroups();
                        setShowCreate(false);
                    }}
                />
            )}
        </MainLayout>
    );
};

// ── Create Group Modal ──────────────────────────────────────────────────────
const CreateGroupModal = ({ onClose, onSuccess }) => {
    const [name, setName] = useState('');
    const [users, setUsers] = useState([]);
    const [selectedIds, setSelectedIds] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const { user: currentUser } = useAuth();

    useEffect(() => {
        userAPI.getAll().then(res => {
            // Exclude self from the list — creator is auto-added
            setUsers(res.data.users.filter(u => u.id !== currentUser.id));
        }).catch(() => setError('Failed to load users'));
    }, [currentUser.id]);

    const toggleUser = (id) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!name.trim()) { setError('Group name is required'); return; }
        setError('');
        setLoading(true);
        try {
            await groupAPI.create({ name: name.trim(), memberIds: selectedIds });
            onSuccess();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to create group');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            isOpen={true}
            onClose={onClose}
            title="Create New Group"
            footer={
                <>
                    <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
                    <button
                        id="submit-create-group"
                        className="btn btn-primary"
                        onClick={handleSubmit}
                        disabled={loading}
                    >
                        {loading ? 'Creating...' : 'Create Group'}
                    </button>
                </>
            }
        >
            <form onSubmit={handleSubmit}>
                {error && (
                    <div style={{ marginBottom: '1rem', padding: '0.75rem', background: 'var(--danger-light)', borderRadius: 'var(--radius)', color: 'var(--danger)', fontSize: '0.875rem' }}>
                        {error}
                    </div>
                )}

                <div className="form-group">
                    <label className="form-label">Group Name *</label>
                    <input
                        id="group-name-input"
                        type="text"
                        className="form-input"
                        placeholder="e.g. Engineering Team"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        required
                    />
                </div>

                <div className="form-group">
                    <label className="form-label">Add Members</label>
                    <p style={{ fontSize: '0.8rem', color: 'var(--gray-500)', marginBottom: '0.5rem' }}>
                        You are automatically added as the creator.
                    </p>
                    <div className="user-select-list">
                        {users.map(u => (
                            <label key={u.id} className={`user-select-item ${selectedIds.includes(u.id) ? 'selected' : ''}`}>
                                <input
                                    type="checkbox"
                                    checked={selectedIds.includes(u.id)}
                                    onChange={() => toggleUser(u.id)}
                                />
                                <div className="user-select-avatar">{u.name.charAt(0).toUpperCase()}</div>
                                <div className="user-select-info">
                                    <div className="user-select-name">{u.name}</div>
                                    <div className="user-select-email">{u.email}</div>
                                </div>
                                <div className={`user-select-check ${selectedIds.includes(u.id) ? 'visible' : ''}`}>✓</div>
                            </label>
                        ))}
                        {users.length === 0 && (
                            <p style={{ color: 'var(--gray-400)', fontSize: '0.875rem', textAlign: 'center', padding: '1rem' }}>
                                No other users found
                            </p>
                        )}
                    </div>
                </div>
            </form>
        </Modal>
    );
};

export default Groups;
