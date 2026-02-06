import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './AuthContext';
import Login from './Login';
import Timetable from './Timetable';
import Register from './Register';
import AdminDashboard from './AdminDashboard';
import AdminLogin from './AdminLogin';

import { NotificationProvider } from './NotificationContext';

function PrivateRoute({ children }) {
  const { user } = useAuth();
  return user ? children : <Navigate to="/" replace />;
}

function AppContent() {
  return (
    <Routes>
      <Route path="/" element={<Login />} />
      <Route path="/admin-login" element={<AdminLogin />} />
      <Route path="/register" element={<Register />} />
      <Route path="/admin" element={<AdminDashboard />} />
      <Route
        path="/timetable"
        element={
          <PrivateRoute>
            <Timetable />
          </PrivateRoute>
        }
      />
    </Routes>
  );
}

export default function App() {
  return (
    <NotificationProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </NotificationProvider>
  );
}
