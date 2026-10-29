(function() {
  'use strict';

  // Config reference
  const CONFIG = window.APP_CONFIG || {
    apiUrl: 'http://localhost:3000/api/auth',
    registerSiteUrl: 'http://localhost:3001'
  };

  // DOM Elements
  const loginView = document.getElementById('login-view');
  const loginForm = document.getElementById('login-form');
  const loginEmail = document.getElementById('login-email');
  const loginPassword = document.getElementById('login-password');
  const btnSubmitLogin = document.getElementById('btn-submit-login');
  const loginAlert = document.getElementById('login-alert');
  const toggleLoginPassword = document.getElementById('toggle-login-password');
  const eyeOffSvg = document.getElementById('eye-off-svg');
  const eyeOnSvg = document.getElementById('eye-on-svg');

  const welcomeAnimation = document.getElementById('welcome-animation');
  const animUserEmailText = document.getElementById('anim-user-email-text');

  const traderDashboard = document.getElementById('trader-dashboard');
  const dashWelcomeName = document.getElementById('dash-welcome-name');
  const dashUserEmail = document.getElementById('dash-user-email');
  const dashUserId = document.getElementById('dash-user-id');
  const dashAvatarLetter = document.getElementById('dash-avatar-letter');
  const btnLogout = document.getElementById('btn-logout');
  const btnRelogin = document.getElementById('btn-relogin');

  const cantLoginBtn = document.getElementById('cant-login-btn');
  const modalCantLogin = document.getElementById('modal-cant-login');
  const modalCloseBtn = document.getElementById('modal-close-btn');


  // Check URL query parameters for prefill (e.g. ?email=user%40gmail.com)
  const urlParams = new URLSearchParams(window.location.search);
  const emailParam = urlParams.get('email');
  if (emailParam) {
    loginEmail.value = decodeURIComponent(emailParam);
    setTimeout(() => {
      loginPassword.focus();
    }, 200);
  }

  // UI Helpers
  function showAlert(message, type = 'error') {
    loginAlert.className = `login-message ${type}`;
    loginAlert.innerHTML = message;
    loginAlert.style.display = 'flex';
  }

  function hideAlert() {
    loginAlert.style.display = 'none';
  }

  function setButtonLoading(isLoading) {
    if (isLoading) {
      btnSubmitLogin.disabled = true;
      btnSubmitLogin.innerHTML = `<span class="spinner"></span> <span>Signing in...</span>`;
    } else {
      btnSubmitLogin.disabled = false;
      btnSubmitLogin.innerHTML = `<span>Sign in</span>`;
    }
  }

  // Password Visibility Toggle
  toggleLoginPassword.addEventListener('click', () => {
    if (loginPassword.type === 'password') {
      loginPassword.type = 'text';
      eyeOffSvg.style.display = 'none';
      eyeOnSvg.style.display = 'block';
    } else {
      loginPassword.type = 'password';
      eyeOffSvg.style.display = 'block';
      eyeOnSvg.style.display = 'none';
    }
  });

  // Modal handlers
  cantLoginBtn.addEventListener('click', () => {
    modalCantLogin.style.display = 'flex';
  });

  modalCloseBtn.addEventListener('click', () => {
    modalCantLogin.style.display = 'none';
  });

  modalCantLogin.addEventListener('click', (e) => {
    if (e.target === modalCantLogin) {
      modalCantLogin.style.display = 'none';
    }
  });

  // Login Submit Handling
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideAlert();

    const email = loginEmail.value.trim();
    const password = loginPassword.value;

    if (!email || !password) {
      showAlert('⚠️ Please enter both Email and Password.');
      return;
    }

    setButtonLoading(true);

    try {
      const response = await fetch(`${CONFIG.apiUrl}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Login failed. Please verify credentials.');
      }

      // Success! Play the exact 2-second welcome animation
      playWelcomeAnimation(data.user);

    } catch (err) {
      showAlert(`⚠️ ${err.message}`);
    } finally {
      setButtonLoading(false);
    }
  });

  // 2-SECOND WELCOME ANIMATION FUNCTION
  function playWelcomeAnimation(user) {
    // Hide login view
    loginView.style.display = 'none';

    // Set email text
    animUserEmailText.textContent = user.email;

    // Show animation overlay
    welcomeAnimation.classList.add('active');

    // Exactly 2000ms (2 seconds) as requested
    setTimeout(() => {
      // Transition out of animation
      welcomeAnimation.classList.remove('active');

      // Populate Trader Dashboard
      const name = user.email.split('@')[0];
      dashWelcomeName.textContent = `Welcome, ${name.charAt(0).toUpperCase() + name.slice(1)}!`;
      dashUserEmail.textContent = user.email;
      dashUserId.textContent = user.id ? `#${user.id.slice(-6).toUpperCase()}` : '#TRD-8841';
      dashAvatarLetter.textContent = (user.email.charAt(0) || 'T').toUpperCase();

      // Show Dashboard
      traderDashboard.classList.add('active');

      // Save session
      sessionStorage.setItem('p2p_active_trader', JSON.stringify(user));
    }, 2000);
  }

  // Sign out handling
  function handleSignOut() {
    sessionStorage.removeItem('p2p_active_trader');
    traderDashboard.classList.remove('active');
    loginView.style.display = 'flex';
    loginPassword.value = '';
    hideAlert();
  }

  btnLogout.addEventListener('click', handleSignOut);
  btnRelogin.addEventListener('click', handleSignOut);

  // Auto restore session if refreshed while in dashboard
  const savedSession = sessionStorage.getItem('p2p_active_trader');
  if (savedSession) {
    try {
      const user = JSON.parse(savedSession);
      const name = user.email.split('@')[0];
      loginView.style.display = 'none';
      dashWelcomeName.textContent = `Welcome, ${name.charAt(0).toUpperCase() + name.slice(1)}!`;
      dashUserEmail.textContent = user.email;
      dashUserId.textContent = user.id ? `#${user.id.slice(-6).toUpperCase()}` : '#TRD-8841';
      dashAvatarLetter.textContent = (user.email.charAt(0) || 'T').toUpperCase();
      traderDashboard.classList.add('active');
    } catch (e) {
      sessionStorage.removeItem('p2p_active_trader');
    }
  }

})();
