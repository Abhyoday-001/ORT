import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminDashboard from '../components/AdminDashboard';
import { fetchSession, logout } from '../lib/apiClient';

export default function AdminPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;

    const validateSession = async () => {
      try {
        const response = await fetchSession();
        if (!mounted) return;
        const sessionUser = response?.user;
        if (!sessionUser) throw new Error('No session');

        // If not admin, kick to dashboard
        if (sessionUser.role !== 'admin') {
          navigate('/dashboard', { replace: true });
          return;
        }

        // Update sessionStorage with correct data
        sessionStorage.setItem('matrix_user', JSON.stringify(sessionUser));
        setUser(sessionUser);
        setReady(true);
      } catch {
        if (!mounted) return;
        sessionStorage.removeItem('isAuthenticated');
        sessionStorage.removeItem('matrix_user');
        sessionStorage.removeItem('matrix_token');
        navigate('/login', { replace: true });
      }
    };

    validateSession();
    return () => { mounted = false; };
  }, [navigate]);

  const handleLogout = () => {
    try {
      logout();
    } catch {
      // ignore
    }
    sessionStorage.removeItem('isAuthenticated');
    sessionStorage.removeItem('matrix_user');
    sessionStorage.removeItem('matrix_token');
    navigate('/login', { replace: true });
  };

  if (!ready) {
    return (
      <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/95 text-emerald-300 font-mono tracking-[0.2em] text-sm">
        VALIDATING ADMIN SESSION...
      </div>
    );
  }

  return <AdminDashboard user={user} onLogout={handleLogout} />;
}
