import React, { useState } from 'react';
import { scrumAPI } from '../../api/api';
import './ScrumCall.css';

const ScrumCallModal = ({ isOpen, onClose }) => {
    const [title, setTitle] = useState('Daily Morning Sync');
    const [meetLink, setMeetLink] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            await scrumAPI.start({ title, meet_link: meetLink });
            setSuccess(true);
            setTimeout(() => {
                setSuccess(false);
                onClose();
                setMeetLink('');
            }, 2000);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to start scrum call');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="scrum-modal-overlay">
            <div className="scrum-modal">
                <div className="scrum-modal-header">
                    <h2>🚀 Start Scrum Call</h2>
                    <button className="close-btn" onClick={onClose}>✕</button>
                </div>

                {success ? (
                    <div className="scrum-success">
                        <div className="success-icon">✅</div>
                        <p>Scrum notification sent to your team!</p>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label>Meeting Title</label>
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="e.g. Daily Standup"
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label>Google Meet / Zoom Link</label>
                            <input
                                type="url"
                                value={meetLink}
                                onChange={(e) => setMeetLink(e.target.value)}
                                placeholder="https://meet.google.com/..."
                                required
                            />
                        </div>

                        {error && <div className="scrum-error">{error}</div>}

                        <div className="scrum-modal-footer">
                            <button type="button" className="btn-cancel" onClick={onClose}>Cancel</button>
                            <button type="submit" className="btn-start" disabled={loading}>
                                {loading ? 'Starting...' : 'Go Live & Notify Team'}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
};

export default ScrumCallModal;
