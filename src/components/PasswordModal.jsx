import React, { useState, useEffect, useRef } from 'react';

const PasswordModal = ({ isOpen, onClose, onSubmit, title, description, error }) => {
  const [password, setPassword] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setPassword('');
      setIsVerifying(false);
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (password.trim() && !isVerifying) {
      setIsVerifying(true);
      setTimeout(() => {
        onSubmit(password);
        setIsVerifying(false);
      }, 1500);
    }
  };

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0"
        style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(12px)' }}
        onClick={!isVerifying ? onClose : undefined}
      />

      {/* Modal */}
      <div
        className="w-full max-w-md p-8 ort-fade-in relative overflow-hidden"
        style={{
          background: 'rgba(10,14,26,0.98)',
          border: '1px solid var(--ort-green)',
          boxShadow: '0 0 40px rgba(0,255,136,0.1), 0 0 80px rgba(0,0,0,0.8)',
          zIndex: 101,
        }}
      >
        {/* Loading overlay */}
        {isVerifying && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center ort-fade-in" style={{ background: 'rgba(10,14,26,0.9)', backdropFilter: 'blur(4px)' }}>
            <div className="relative w-16 h-16 mb-4">
              <div style={{ position: 'absolute', inset: 0, border: '2px solid var(--ort-green)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
              <div style={{ position: 'absolute', inset: '6px', border: '2px solid var(--ort-cyan)', borderBottomColor: 'transparent', borderRadius: '50%', animation: 'spin 1.5s linear infinite reverse' }} />
              <div className="absolute inset-0 flex items-center justify-center" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.5rem', fontWeight: 700, color: 'var(--ort-green)' }}>
                SYNC
              </div>
            </div>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.55rem', color: 'var(--ort-green)', letterSpacing: '0.2em' }}>
              DECRYPTING<span className="ort-cursor" />
            </p>
          </div>
        )}

        {/* Corner marks */}
        {[
          { top: 0, left: 0, borderTop: '2px solid var(--ort-green)', borderLeft: '2px solid var(--ort-green)' },
          { top: 0, right: 0, borderTop: '2px solid var(--ort-green)', borderRight: '2px solid var(--ort-green)' },
          { bottom: 0, left: 0, borderBottom: '2px solid var(--ort-green)', borderLeft: '2px solid var(--ort-green)' },
          { bottom: 0, right: 0, borderBottom: '2px solid var(--ort-green)', borderRight: '2px solid var(--ort-green)' },
        ].map((style, i) => (
          <div key={i} className="absolute w-4 h-4" style={style} />
        ))}

        {/* Header */}
        <div className="text-center mb-8">
          <h3
            className="text-lg font-bold uppercase tracking-tight mb-2 ort-glow-green"
            style={{ fontFamily: 'var(--font-heading)', color: 'var(--ort-green)' }}
          >
            {title || 'AUTHENTICATION REQUIRED'}
          </h3>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.55rem', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.25em', textTransform: 'uppercase' }}>
            {description || 'PROTOCOL: LEVEL_2 ACCESS'}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="relative">
            <div className="flex items-center gap-2 mb-1" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'rgba(0,255,136,0.4)' }}>
              <span>&gt;</span>
              <span>ENTER_ACCESS_KEY:</span>
            </div>
            <input
              ref={inputRef}
              type="password"
              value={password}
              disabled={isVerifying}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="________"
              className="ort-input"
              style={{ textAlign: 'center', fontSize: '1.1rem', fontWeight: 700, letterSpacing: '0.5em' }}
            />
          </div>

          {error && (
            <div className="p-2 ort-fade-in" style={{
              background: 'var(--ort-red-dim)',
              border: '1px solid var(--ort-red)',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.6rem',
              color: 'var(--ort-red)',
              letterSpacing: '0.1em',
              textAlign: 'center',
            }}>
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              disabled={isVerifying}
              onClick={onClose}
              className="ort-btn ort-btn-red"
              style={{ padding: '0.6rem 1.2rem', opacity: isVerifying ? 0 : 1 }}
            >
              ABORT
            </button>
            <button
              type="submit"
              disabled={isVerifying}
              className="ort-btn flex-1"
              style={{ padding: '0.6rem' }}
            >
              &gt; VERIFY IDENTITY
            </button>
          </div>
        </form>

        {/* Footer */}
        <div className="mt-6 pt-3 flex justify-between items-center" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.45rem', color: 'rgba(255,255,255,0.15)', letterSpacing: '0.2em', textTransform: 'uppercase' }}>STATUS: ENCRYPTED</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.45rem', color: 'rgba(255,255,255,0.15)', letterSpacing: '0.2em', textTransform: 'uppercase' }}>CHINNASWAMY_OPS</span>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default PasswordModal;
