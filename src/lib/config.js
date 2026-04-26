const isLocalhost = (hostname) => hostname === 'localhost' || hostname === '127.0.0.1';

const getBackendUrl = () => {
  // Check env first
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  
  // Fallback to localhost:3008 if on localhost
  if (typeof window !== 'undefined' && isLocalhost(window.location.hostname)) {
    return `http://${window.location.hostname}:3008`;
  }
  
  // Otherwise use current origin
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  
  // Server-side fallback
  return 'http://localhost:3008';
};

export const BACKEND_URL = getBackendUrl();
export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || BACKEND_URL;
