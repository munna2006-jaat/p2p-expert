// Configuration for p2p-expert Registration Portal
window.APP_CONFIG = {
  appName: 'p2p-expert registration',
  // API URL: auto-detects localhost or uses custom domain
  apiUrl: (function() {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return 'http://localhost:3000/api/auth';
    }
    // In production, point to backend or relative /api/auth
    return '/api/auth';
  })(),
  // Main login website URL (where user will be redirected after registration)
  mainSiteUrl: (function() {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return 'http://localhost:3000';
    }
    // In production:
    // If on Render domain (e.g. p2p-expert.onrender.com)
    if (window.location.hostname.endsWith('.onrender.com')) {
      return `${window.location.protocol}//${window.location.hostname}`;
    }
    // If on custom subdomain (e.g. register.p2p-expert.com)
    const hostParts = window.location.hostname.split('.');
    if (hostParts.length > 2 && (hostParts[0] === 'register' || hostParts[0] === 'reg')) {
      return `${window.location.protocol}//${hostParts.slice(1).join('.')}`;
    }
    return window.location.origin;
  })()
};
