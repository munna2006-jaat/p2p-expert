// Configuration for p2p-expert Main Login Portal
window.APP_CONFIG = {
  appName: 'p2p-expert',
  apiUrl: (function() {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return 'http://localhost:3000/api/auth';
    }
    return '/api/auth';
  })(),
  registerSiteUrl: (function() {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return 'http://localhost:3001';
    }
    // Subdomain support
    return `${window.location.protocol}//register.${window.location.hostname}`;
  })()
};
