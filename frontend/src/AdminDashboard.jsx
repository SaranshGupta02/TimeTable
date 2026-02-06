import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useNotification } from './NotificationContext';

import * as api from './api';

function AdminDashboard() {
    const navigate = useNavigate();
    const { showNotification } = useNotification();
    const [users, setUsers] = useState([]);
    const [classes, setClasses] = useState([]);
    const [showAddClass, setShowAddClass] = useState(false);
    const [newClassId, setNewClassId] = useState('');

    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user') || '{}');

    useEffect(() => {
        if (!token || user.role !== 'admin') {
            navigate('/admin-login');
            return;
        }
        fetchUsers();
        fetchClasses();
    }, []);

    const fetchUsers = async () => {
        try {
            const data = await api.getUsers();
            setUsers(data);
        } catch (err) { showNotification(err.message, 'error'); }
    };

    const fetchClasses = async () => {
        try {
            const data = await api.getClasses();
            setClasses(data);
        } catch (err) { showNotification(err.message, 'error'); }
    };

    const handleApproval = async (userId, approve) => {
        try {
            await api.approveUser(userId, approve);
            showNotification(approve ? 'Professor Approved' : 'Access Revoked', 'success');
            fetchUsers();
        } catch (err) { showNotification(err.message, 'error'); }
    };

    const handleCreateClass = async () => {
        if (!newClassId) {
            showNotification('Please enter a Class ID', 'warning');
            return;
        }
        try {
            await api.createClass(newClassId);
            showNotification(`Class ${newClassId} created successfully`, 'success');
            setNewClassId('');
            setShowAddClass(false);
            fetchClasses();
        } catch (err) {
            showNotification(err.message, 'error');
        }
    };

    return (
        <div className="dashboard-container">
            <header className="dashboard-header">
                <h1>Admin Dashboard</h1>
                <button onClick={() => {
                    localStorage.clear();
                    navigate('/admin-login');
                }} className="logout-btn">Logout</button>
            </header>

            <div style={{ marginBottom: '3rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h2>Manage Classes</h2>
                    <button className="btn-primary" onClick={() => setShowAddClass(true)}>+ Add Class</button>
                </div>

                <div className="users-list">
                    {classes.length === 0 ? <p style={{ padding: '1rem' }}>No classes yet.</p> : (
                        <table>
                            <thead><tr><th>Class ID</th><th>Actions</th></tr></thead>
                            <tbody>
                                {classes.map(c => (
                                    <tr key={c}>
                                        <td style={{ fontWeight: 'bold' }}>{c}</td>
                                        <td>
                                            <button className="approve-btn" onClick={() => navigate(`/timetable?classId=${c}&mode=structure`)}>
                                                Edit Structure
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            <div>
                <h2>Professor Approvals</h2>
                <div className="users-list">
                    {users.length === 0 ? (
                        <p style={{ padding: '1rem' }}>No professors found.</p>
                    ) : (
                        <table>
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Email</th>
                                    <th>Dept</th>
                                    <th>Status</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.map(u => (
                                    <tr key={u.id}>
                                        <td>{u.name}</td>
                                        <td>{u.email}</td>
                                        <td>{u.department}</td>
                                        <td>
                                            <span className={`status ${u.is_approved ? 'approved' : 'pending'}`}>
                                                {u.is_approved ? 'Approved' : 'Pending'}
                                            </span>
                                        </td>
                                        <td>
                                            {!u.is_approved ? (
                                                <button className="approve-btn" onClick={() => handleApproval(u.id, true)}>Approve</button>
                                            ) : (
                                                <button className="reject-btn" onClick={() => handleApproval(u.id, false)}>Revoke</button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {showAddClass && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <h3>Add New Class</h3>
                        <div className="form-group">
                            <label>Class ID (e.g., E301)</label>
                            <input
                                value={newClassId}
                                onChange={e => setNewClassId(e.target.value)}
                                autoFocus
                            />
                        </div>
                        <div className="modal-actions">
                            <button className="btn-primary" onClick={handleCreateClass}>Create</button>
                            <button className="logout-btn" onClick={() => setShowAddClass(false)}>Cancel</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default AdminDashboard;
