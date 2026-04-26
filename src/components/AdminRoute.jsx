import React from 'react';
import { Navigate } from 'react-router-dom';

export default function AdminRoute({ children }) {
  const isAuthenticated = sessionStorage.getItem('isAuthenticated') === 'true';
  const raw = sessionStorage.getItem('matrix_user');
  let role = 'user';

  try {
    role = raw ? JSON.parse(raw)?.role || 'user' : 'user';
  } catch {
    role = 'user';
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (role !== 'admin') return <Navigate to="/dashboard" replace />;

  return children;
}
