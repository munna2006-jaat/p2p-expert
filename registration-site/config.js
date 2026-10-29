// Configuration for p2p-expert Registration Portal
window.APP_CONFIG = {
  appName: 'p2p-expert registration',
  // API URL: auto-detects localhost or uses relative /api/auth
  apiUrl: (function() {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return 'http://localhost:3000/api/auth';
    }
    return '/api/auth';
  })(),
  // Main login website URL
  mainSiteUrl: (function() {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return window.location.port === '3001' ? 'http://localhost:3000' : window.location.origin;
    }
    // If on custom subdomain (e.g. register.yourdomain.com)
    const hostParts = window.location.hostname.split('.');
    if (hostParts.length > 2 && (hostParts[0] === 'register' || hostParts[0] === 'reg')) {
      return `${window.location.protocol}//${hostParts.slice(1).join('.')}`;
    }
    return window.location.origin;
  })()
};
