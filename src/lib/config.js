const isLocalhost = (hostname) => hostname === 'localhost' || hostname === '127.0.0.1';

const getBackendUrl = () => {
  // Check env first
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  
  // Fallback for localhost
  if (typeof window !== 'undefined' && isLocalhost(window.location.hostname)) {
    return `http://${window.location.hostname}:3008`;
  }
  
  // Hardcoded production fallback
  return 'https://backend-production-8d26.up.railway.app';
};

export const BACKEND_URL = getBackendUrl();
export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || BACKEND_URL;
