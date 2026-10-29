(function() {
  'use strict';

  // Config reference
  const CONFIG = window.APP_CONFIG || {
    apiUrl: 'http://localhost:3000/api/auth',
    mainSiteUrl: 'http://localhost:3000'
  };

  // State
  let currentEmail = '';
  let resendTimerInterval = null;
  let remainingSeconds = 60;

  // DOM Elements
  const stepRegister = document.getElementById('step-register');
  const stepOtp = document.getElementById('step-otp');
  const stepSuccess = document.getElementById('step-success');

  const regForm = document.getElementById('register-form');
  const regEmailInput = document.getElementById('reg-email');
  const regPasswordInput = document.getElementById('reg-password');
  const regConfirmPasswordInput = document.getElementById('reg-confirm-password');
  const submitRegisterBtn = document.getElementById('submit-register-btn');
  const regMessage = document.getElementById('reg-message');

  const otpForm = document.getElementById('otp-form');
  const otpDigits = document.querySelectorAll('.otp-digit');
  const verifyOtpBtn = document.getElementById('verify-otp-btn');
  const otpMessage = document.getElementById('otp-message');
  const displayUserEmail = document.getElementById('display-user-email');
  const resendOtpBtn = document.getElementById('resend-otp-btn');
  const resendCountdown = document.getElementById('resend-countdown');
  const backToRegisterBtn = document.getElementById('back-to-register-btn');


  const successVerifiedEmail = document.getElementById('success-verified-email');
  const mainSiteDisplayUrl = document.getElementById('main-site-display-url');
  const copyLinkBtn = document.getElementById('copy-link-btn');
  const nextToMainBtn = document.getElementById('next-to-main-btn');
  const toast = document.getElementById('toast');

  // Set initial links
  const initialMainUrl = (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1')
    ? (CONFIG.mainSiteUrl || window.location.origin)
    : (CONFIG.mainSiteUrl || 'http://localhost:3000');
  if (nextToMainBtn) nextToMainBtn.href = initialMainUrl;
  if (mainSiteDisplayUrl) mainSiteDisplayUrl.textContent = initialMainUrl;

  // ---------------- UI HELPERS ----------------
  function showStep(stepElement) {
    [stepRegister, stepOtp, stepSuccess].forEach(el => {
      if (el) {
        el.classList.remove('active');
        el.style.display = 'none';
      }
    });
    if (stepElement) {
      stepElement.classList.add('active');
      stepElement.style.display = 'block';
    }
  }

  function showMessage(el, text, type = 'error') {
    el.className = `message-banner ${type}`;
    el.innerHTML = text;
    el.style.display = 'flex';
  }

  function hideMessage(el) {
    el.style.display = 'none';
  }

  function showToast(text = 'Copied to clipboard! 📋') {
    toast.textContent = text;
    toast.classList.add('show');
    setTimeout(() => {
      toast.classList.remove('show');
    }, 2800);
  }

  function setButtonLoading(btn, isLoading, defaultText) {
    if (isLoading) {
      btn.disabled = true;
      btn.innerHTML = `<span class="spinner"></span> <span>Please wait...</span>`;
    } else {
      btn.disabled = false;
      btn.innerHTML = `<span>${defaultText}</span>`;
    }
  }

  // ---------------- PASSWORD VISIBILITY TOGGLE ----------------
  document.querySelectorAll('.toggle-password').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-target');
      const input = document.getElementById(targetId);
      if (!input) return;

      const eyeOff = btn.querySelector('.eye-off-icon');
      const eyeOn = btn.querySelector('.eye-on-icon');

      if (input.type === 'password') {
        input.type = 'text';
        if (eyeOff) eyeOff.style.display = 'none';
        if (eyeOn) eyeOn.style.display = 'block';
      } else {
        input.type = 'password';
        if (eyeOff) eyeOff.style.display = 'block';
        if (eyeOn) eyeOn.style.display = 'none';
      }
    });
  });

  // ---------------- STEP 1: REGISTER & SEND OTP ----------------
  regForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideMessage(regMessage);

    const email = regEmailInput.value.trim();
    const password = regPasswordInput.value;
    const confirmPassword = regConfirmPasswordInput.value;

    if (!email || !email.includes('@')) {
      showMessage(regMessage, '⚠️ Please enter a valid Gmail address.');
      regEmailInput.focus();
      return;
    }

    if (!password || password.length < 6) {
      showMessage(regMessage, '⚠️ Password must be at least 6 characters long.');
      regPasswordInput.focus();
      return;
    }

    if (password !== confirmPassword) {
      showMessage(regMessage, '⚠️ Passwords do not match. Please recheck.');
      regConfirmPasswordInput.focus();
      return;
    }

    setButtonLoading(submitRegisterBtn, true, 'Send OTP Code');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(`${CONFIG.apiUrl}/register-send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to send OTP.');
      }

      // Success! Proceed to Step 2
      currentEmail = email;
      displayUserEmail.textContent = email;

      showStep(stepOtp);
      startResendCountdown();
      hideMessage(otpMessage);

      // Clear and focus first OTP input
      otpDigits.forEach(input => (input.value = ''));
      setTimeout(() => otpDigits[0].focus(), 150);

    } catch (err) {
      clearTimeout(timeoutId);
      const msg = err.name === 'AbortError' ? 'Request timed out. Please check your network and try again.' : err.message;
      showMessage(regMessage, `⚠️ ${msg}`);
    } finally {
      setButtonLoading(submitRegisterBtn, false, 'Send OTP Code');
    }
  });

  submitRegisterBtn.addEventListener('click', (e) => {
    e.preventDefault();
    regForm.dispatchEvent(new Event('submit', { cancelable: true }));
  });

  // ---------------- STEP 2: OTP INPUT HANDLING ----------------
  otpDigits.forEach((input, index) => {
    input.addEventListener('input', (e) => {
      const val = e.target.value.replace(/\D/g, '');
      e.target.value = val ? val[0] : '';

      if (e.target.value && index < otpDigits.length - 1) {
        otpDigits[index + 1].focus();
      }

      // Check if all 6 filled -> trigger submit
      const allFilled = Array.from(otpDigits).every(inp => inp.value.length === 1);
      if (allFilled) {
        otpForm.dispatchEvent(new Event('submit'));
      }
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !e.target.value && index > 0) {
        otpDigits[index - 1].focus();
      } else if (e.key === 'ArrowLeft' && index > 0) {
        otpDigits[index - 1].focus();
      } else if (e.key === 'ArrowRight' && index < otpDigits.length - 1) {
        otpDigits[index + 1].focus();
      }
    });

    // Support pasting full 6 digits
    input.addEventListener('paste', (e) => {
      e.preventDefault();
      const pasteData = (e.clipboardData || window.clipboardData).getData('text').trim();
      const digitsOnly = pasteData.replace(/\D/g, '').slice(0, 6);

      if (digitsOnly.length > 0) {
        digitsOnly.split('').forEach((char, i) => {
          if (otpDigits[i]) otpDigits[i].value = char;
        });
        const nextIndex = Math.min(digitsOnly.length, otpDigits.length - 1);
        otpDigits[nextIndex].focus();

        if (digitsOnly.length === 6) {
          otpForm.dispatchEvent(new Event('submit'));
        }
      }
    });
  });

  // Resend Countdown Timer
  function startResendCountdown() {
    remainingSeconds = 60;
    resendOtpBtn.disabled = true;
    resendCountdown.textContent = `${remainingSeconds}s`;

    if (resendTimerInterval) clearInterval(resendTimerInterval);

    resendTimerInterval = setInterval(() => {
      remainingSeconds--;
      if (remainingSeconds <= 0) {
        clearInterval(resendTimerInterval);
        resendOtpBtn.disabled = false;
        resendOtpBtn.innerHTML = `Resend Code`;
      } else {
        resendCountdown.textContent = `${remainingSeconds}s`;
      }
    }, 1000);
  }

  // Resend OTP Click
  resendOtpBtn.addEventListener('click', async () => {
    if (resendOtpBtn.disabled) return;
    hideMessage(otpMessage);

    resendOtpBtn.disabled = true;
    resendOtpBtn.textContent = 'Sending...';

    try {
      const response = await fetch(`${CONFIG.apiUrl}/resend-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: currentEmail })
      });

      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message);

      showMessage(otpMessage, '✅ Fresh verification code sent to your email.', 'success');
      startResendCountdown();
    } catch (err) {
      showMessage(otpMessage, `⚠️ ${err.message}`, 'error');
      resendOtpBtn.disabled = false;
      resendOtpBtn.textContent = 'Resend Code';
    }
  });

  // Change email button
  backToRegisterBtn.addEventListener('click', () => {
    hideMessage(otpMessage);
    showStep(stepRegister);
    regEmailInput.focus();
  });

  // Verify OTP Submit
  otpForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideMessage(otpMessage);

    const enteredOtp = Array.from(otpDigits).map(inp => inp.value).join('');

    if (enteredOtp.length !== 6) {
      showMessage(otpMessage, '⚠️ Please enter the complete 6-digit code.');
      return;
    }

    setButtonLoading(verifyOtpBtn, true, 'Verify & Complete');

    try {
      const response = await fetch(`${CONFIG.apiUrl}/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: currentEmail, otp: enteredOtp })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'OTP verification failed.');
      }

      // Success! Step 3
      let mainUrl = data.mainSiteUrl;
      if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        if (!mainUrl || mainUrl.includes('localhost') || mainUrl.includes('127.0.0.1')) {
          mainUrl = CONFIG.mainSiteUrl || window.location.origin;
        }
      }
      if (!mainUrl) mainUrl = window.location.origin;

      const cleanBase = mainUrl.endsWith('/') ? mainUrl : `${mainUrl}/`;
      const targetUrlWithEmail = `${cleanBase}?email=${encodeURIComponent(currentEmail)}`;

      successVerifiedEmail.textContent = currentEmail;
      mainSiteDisplayUrl.textContent = mainUrl;
      nextToMainBtn.href = targetUrlWithEmail;

      showStep(stepSuccess);

    } catch (err) {
      showMessage(otpMessage, `⚠️ ${err.message}`, 'error');
      // Shake inputs
      otpDigits.forEach(inp => {
        inp.style.borderColor = '#ef4444';
        setTimeout(() => inp.style.borderColor = '', 1000);
      });
    } finally {
      setButtonLoading(verifyOtpBtn, false, 'Verify & Complete');
    }
  });

  // ---------------- STEP 3: COPY LINK & REDIRECT ----------------
  copyLinkBtn.addEventListener('click', async () => {
    const urlToCopy = nextToMainBtn.href || CONFIG.mainSiteUrl;

    try {
      await navigator.clipboard.writeText(urlToCopy);
      showToast('Main portal link copied! 📋');
    } catch (err) {
      // Fallback
      const textarea = document.createElement('textarea');
      textarea.value = urlToCopy;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      showToast('Main portal link copied! 📋');
    }
  });

})();
