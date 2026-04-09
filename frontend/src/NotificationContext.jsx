import React, { createContext, useContext, useState, useCallback, useRef } from 'react';

const NotificationContext = createContext();

export function useNotification() {
  return useContext(NotificationContext);
}

export function NotificationProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const persistentRef = useRef({});

  const showNotification = useCallback((message, type = 'info', options = {}) => {
    const id = Date.now() + Math.random();
    const persistent = options.persistent || false;
    const duration = options.duration || 4000;

    setToasts(prev => [...prev, { id, message, type, persistent, loading: type === 'loading' }]);

    if (!persistent) {
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, duration);
    } else {
      persistentRef.current[message] = id;
    }

    return id;
  }, []);

  const dismissNotification = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const dismissByMessage = useCallback((message) => {
    const id = persistentRef.current[message];
    if (id) {
      setToasts(prev => prev.filter(t => t.id !== id));
      delete persistentRef.current[message];
    }
  }, []);

  const removeToast = (id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  return (
    <NotificationContext.Provider value={{ showNotification, dismissNotification, dismissByMessage }}>
      {children}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast toast-${t.type}`}>
            <div className="toast-body">
              {t.loading && <span className="toast-spinner" />}
              <span>{t.message}</span>
            </div>
            <button onClick={() => removeToast(t.id)} className="toast-close">×</button>
          </div>
        ))}
      </div>
    </NotificationContext.Provider>
  );
}
