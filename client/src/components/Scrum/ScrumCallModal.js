import React, { useState } from 'react';
import { scrumAPI } from '../../api/api';
import ModernSuccessToast from '../Common/ModernSuccessToast';
import AnimatedButton from '../Common/AnimatedButton';
import Modal from '../Modal/Modal';
import './ScrumCall.css';

const ScrumCallModal = ({ isOpen, onClose }) => {
    const [title, setTitle] = useState('Daily Morning Sync');
    const [meetLink, setMeetLink] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [showSuccess, setShowSuccess] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            await scrumAPI.start({ title, meet_link: meetLink });
            setShowSuccess(true);
            setTimeout(() => {
                onClose();
                setMeetLink('');
            }, 1000);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to start scrum call');
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <ModernSuccessToast
                isVisible={showSuccess}
                message="Scrum notification sent to your team!"
                onClose={() => setShowSuccess(false)}
            />
            <Modal
                isOpen={isOpen}
                onClose={onClose}
                title="Start Scrum Call"
                footer={
                    <>
                        <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
                        <AnimatedButton onClick={handleSubmit} className="btn-start btn btn-primary" disabled={loading}>
                            {loading ? 'Starting...' : 'Go Live & Notify Team'}
                        </AnimatedButton>
                    </>
                }
            >
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label className="form-label">Meeting Title</label>
                        <input
                            type="text"
                            className="form-input"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="e.g. Daily Standup"
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Google Meet / Zoom Link</label>
                        <input
                            type="url"
                            className="form-input"
                            value={meetLink}
                            onChange={(e) => setMeetLink(e.target.value)}
                            placeholder="https://meet.google.com/..."
                            required
                        />
                    </div>
                    {error && <div className="scrum-error" style={{ color: 'var(--danger)', marginBottom: '1rem' }}>{error}</div>}
                </form>
            </Modal>
        </>
    );
};

export default ScrumCallModal;
