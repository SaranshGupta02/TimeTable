import React, { createContext, useContext, useState, useCallback } from 'react';

const NotificationContext = createContext();

export function useNotification() {
    return useContext(NotificationContext);
}

export function NotificationProvider({ children }) {
    const [toasts, setToasts] = useState([]);

    const showNotification = useCallback((message, type = 'info') => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 3000);
    }, []);

    const removeToast = (id) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    };

    return (
        <NotificationContext.Provider value={{ showNotification }}>
            {children}
            <div style={styles.toastContainer}>
                {toasts.map(t => (
                    <div key={t.id} style={{ ...styles.toast, ...styles[t.type] }}>
                        <span>{t.message}</span>
                        <button onClick={() => removeToast(t.id)} style={styles.closeBtn}>×</button>
                    </div>
                ))}
            </div>
        </NotificationContext.Provider>
    );
}

const styles = {
    toastContainer: {
        position: 'fixed',
        top: '20px',
        right: '20px',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
    },
    toast: {
        minWidth: '250px',
        padding: '16px',
        borderRadius: '8px',
        color: 'white',
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        animation: 'slideIn 0.3s ease-out',
        fontSize: '0.9rem',
        fontWeight: '500',
    },
    info: { background: '#3b82f6', borderLeft: '4px solid #1d4ed8' },
    success: { background: '#10b981', borderLeft: '4px solid #047857' },
    error: { background: '#ef4444', borderLeft: '4px solid #b91c1c' },
    warning: { background: '#f59e0b', borderLeft: '4px solid #b45309' },
    closeBtn: {
        background: 'none',
        border: 'none',
        color: 'white',
        fontSize: '1.2rem',
        cursor: 'pointer',
        marginLeft: '10px',
        opacity: 0.8,
    }
};
