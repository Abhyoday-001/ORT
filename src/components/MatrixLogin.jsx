import React, { useState, useEffect } from 'react';
import { loginTeam } from '../lib/apiClient';

export default function MatrixLogin({ onLogin }) {
  const [teamName, setTeamName] = useState('');
  const [authKey, setAuthKey] = useState('');
  const [status] = useState('Awaiting Investigator Credentials');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!teamName.trim() || !authKey.trim()) {
      setError('Please enter codename and key.');
      return;
    }

    setError('');
    setIsLoading(true);

    try {
      const response = await loginTeam(teamName.trim(), authKey);
      const user = response.user;

      sessionStorage.setItem('matrix_user', JSON.stringify(user));
      sessionStorage.setItem('matrix_token', response.token);
      setIsLoading(false);
      onLogin(user);
    } catch (error) {
      setIsLoading(false);
      setError(error.message || 'Login failed. Check team ID and password.');
    }
  };

  return (
    <div className="fixed inset-0 z-[900] flex items-center justify-center p-6">
      <div 
        className="premium-glass-card w-full max-w-xl rounded-3xl px-6 py-7 sm:px-8 sm:py-8"
        style={{ opacity: mounted ? 1 : 0 }}
      >
        {/* Logo Section with Glow */}
        <div className="mb-8 flex justify-center relative">
          <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/10 via-transparent to-red-600/10 rounded-full blur-3xl -m-12" />
          <div className="relative z-10 w-full text-center">
            <h1 className="text-3xl font-black uppercase tracking-[0.3rem]" style={{
              background: 'linear-gradient(to right, #da1818, #f0c16b)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              filter: 'drop-shadow(0 0 10px rgba(218,24,24,0.4))'
            }}>
              Operation Red Trophy
            </h1>
          </div>
        </div>

        {/* Form Section */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Team Codename Input */}
          <div className="space-y-2">
            <label className="premium-label block">
              Investigator Team Codename
            </label>
            <input
              className="premium-input w-full rounded-lg px-4 py-3 text-sm outline-none"
              value={teamName}
              onChange={(event) => setTeamName(event.target.value)}
              placeholder="Enter Codename"
              disabled={isLoading}
              autoComplete="off"
            />
          </div>

          {/* Vault Access Key Input */}
          <div className="space-y-2">
            <label className="premium-label block">
              Vault Access Key
            </label>
            <input
              className="premium-input w-full rounded-lg px-4 py-3 text-sm outline-none"
              value={authKey}
              onChange={(event) => setAuthKey(event.target.value)}
              placeholder="Enter Key"
              type="password"
              disabled={isLoading}
              autoComplete="off"
            />
          </div>


          {/* Error Message */}
          {error && (
            <p className="premium-error">✕ {error}</p>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="premium-button w-full rounded-lg py-3 text-xs font-bold transition-all duration-300"
          >
            {isLoading ? 'Authenticating...' : 'Enter Operation Red Trophy'}
          </button>
        </form>

        {/* Status Footer */}
        <p className="premium-status mt-6 text-center">
          {status}
        </p>
      </div>

      {/* Floating accent particles */}
      <style>{`
        @keyframes float-particle-1 {
          0% { transform: translate(0, 0) rotate(0deg); opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { transform: translate(80px, -120px) rotate(180deg); opacity: 0; }
        }
        @keyframes float-particle-2 {
          0% { transform: translate(0, 0) rotate(0deg); opacity: 0; }
          10% { opacity: 0.8; }
          90% { opacity: 0.8; }
          100% { transform: translate(-100px, -150px) rotate(-180deg); opacity: 0; }
        }
        .floating-accent-1 {
          position: fixed;
          width: 6px;
          height: 6px;
          background: #f0c16b;
          border-radius: 50%;
          bottom: 20%;
          left: 10%;
          pointer-events: none;
          animation: float-particle-1 4s ease-out infinite;
          opacity: 0.6;
          box-shadow: 0 0 8px rgba(240, 193, 107, 0.8);
        }
        .floating-accent-2 {
          position: fixed;
          width: 4px;
          height: 4px;
          background: #da1818;
          border-radius: 50%;
          bottom: 30%;
          right: 15%;
          pointer-events: none;
          animation: float-particle-2 5s ease-out infinite;
          opacity: 0.5;
          box-shadow: 0 0 8px rgba(218, 24, 24, 0.8);
        }
      `}</style>
      
      <div className="floating-accent-1" />
      <div className="floating-accent-2" />
    </div>
  );
}
