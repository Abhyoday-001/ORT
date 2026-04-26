import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import ProtectedRoute from './components/ProtectedRoute';
import AdminRoute from './components/AdminRoute';
import AdminPage from './pages/AdminPage';

function RoleHomeRedirect() {
  const isAuthenticated = sessionStorage.getItem('isAuthenticated') === 'true';

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  try {
    const raw = sessionStorage.getItem('matrix_user');
    const role = raw ? JSON.parse(raw)?.role : 'user';
    if (role === 'admin') {
      return <Navigate to="/admin" replace />;
    }
  } catch {
    // Fallback to dashboard below.
  }

  return <Navigate to="/dashboard" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<RoleHomeRedirect />} />
      <Route path="/login" element={<Login />} />
      <Route
        path="/dashboard"
        element={(
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        )}
      />
      <Route
        path="/admin"
        element={(
          <AdminRoute>
            <AdminPage />
          </AdminRoute>
        )}
      />
      <Route path="*" element={<RoleHomeRedirect />} />
    </Routes>
  );
}
