import React from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import MatrixLogin from '../components/MatrixLogin';
import TrophyBackground from '../components/TrophyBackground';

export default function Login() {
  const navigate = useNavigate();
  const isAuthenticated = sessionStorage.getItem('isAuthenticated') === 'true';
  let isAdmin = false;

  try {
    const raw = sessionStorage.getItem('matrix_user');
    const role = raw ? JSON.parse(raw)?.role : 'user';
    isAdmin = role === 'admin';
  } catch {
    isAdmin = false;
  }

  if (isAuthenticated) {
    return <Navigate to={isAdmin ? '/admin' : '/dashboard'} replace />;
  }

  const handleLogin = (user) => {
    sessionStorage.setItem('isAuthenticated', 'true');
    sessionStorage.setItem('matrix_user', JSON.stringify(user));
    if (user?.role === 'admin') {
      navigate('/admin', { replace: true });
      return;
    }
    navigate('/dashboard', { replace: true });
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-black">
      <MatrixLogin onLogin={handleLogin} />
    </div>
  );
}
