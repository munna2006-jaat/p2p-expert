(function() {
  'use strict';

  const API_BASE = '/api';

  // State
  let adminToken = localStorage.getItem('p2p_admin_token') || null;
  let adminUsername = localStorage.getItem('p2p_admin_user') || 'admin';
  let depositsPollTimer = null;
  let otpsPollTimer = null;

  let currentTrc20Qr = '';
  let currentBep20Qr = '';

  // DOM Elements - Login
  const loginScreen = document.getElementById('admin-login-screen');
  const loginForm = document.getElementById('admin-login-form');
  const adminUserInput = document.getElementById('admin-user');
  const adminPassInput = document.getElementById('admin-pass');
  const loginAlert = document.getElementById('login-alert');
  const btnAdminLogin = document.getElementById('btn-admin-login');

  // DOM Elements - Dashboard
  const dashboardScreen = document.getElementById('admin-dashboard-screen');
  const adminDisplayName = document.getElementById('admin-display-name');
  const btnAdminLogout = document.getElementById('btn-admin-logout');
  const pendingBadgeCount = document.getElementById('pending-badge-count');
  const activeOtpsBadge = document.getElementById('active-otps-badge');

  // Tabs
  const navTabs = document.querySelectorAll('.nav-tab');
  const tabPanes = document.querySelectorAll('.tab-pane');

  // Deposits Tab
  const depositsListContainer = document.getElementById('deposits-list-container');
  const btnRefreshDeposits = document.getElementById('btn-refresh-deposits');

  // OTPs Tab
  const otpsTableBody = document.getElementById('otps-table-body');
  const btnRefreshOtps = document.getElementById('btn-refresh-otps');

  // Settings Tab
  const settingsForm = document.getElementById('settings-form');
  const settingAmount = document.getElementById('setting-amount');
  const settingTrc20 = document.getElementById('setting-trc20');
  const settingBep20 = document.getElementById('setting-bep20');
  const settingSmtpUser = document.getElementById('setting-smtp-user');
  const settingSmtpPass = document.getElementById('setting-smtp-pass');
  const settingAdminPass = document.getElementById('setting-admin-pass');
  const testEmailInput = document.getElementById('test-email-input');
  const btnSendTestEmail = document.getElementById('btn-send-test-email');
  const settingsAlert = document.getElementById('settings-alert');
  const btnSaveSettings = document.getElementById('btn-save-settings');

  // QR Upload Elements
  const fileTrc20Qr = document.getElementById('file-trc20-qr');
  const imgPreviewTrc20 = document.getElementById('img-preview-trc20');
  const textNoTrc20Qr = document.getElementById('text-no-trc20-qr');
  const btnRemoveTrc20Qr = document.getElementById('btn-remove-trc20-qr');

  const fileBep20Qr = document.getElementById('file-bep20-qr');
  const imgPreviewBep20 = document.getElementById('img-preview-bep20');
  const textNoBep20Qr = document.getElementById('text-no-bep20-qr');
  const btnRemoveBep20Qr = document.getElementById('btn-remove-bep20-qr');

  // Users Tab
  const usersTableBody = document.getElementById('users-table-body');
  const btnRefreshUsers = document.getElementById('btn-refresh-users');
  const adminToast = document.getElementById('admin-toast');

  // Toast Helper
  function showToast(msg) {
    if (!adminToast) return;
    adminToast.textContent = msg;
    adminToast.classList.add('show');
    setTimeout(() => adminToast.classList.remove('show'), 3000);
  }

  // ---------------- 1. AUTHENTICATION ----------------
  function checkAuthState() {
    if (adminToken) {
      loginScreen.style.display = 'none';
      dashboardScreen.style.display = 'flex';
      adminDisplayName.textContent = adminUsername;
      initDashboard();
    } else {
      loginScreen.style.display = 'flex';
      dashboardScreen.style.display = 'none';
      clearInterval(depositsPollTimer);
      clearInterval(otpsPollTimer);
    }
  }

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginAlert.style.display = 'none';

    const username = adminUserInput.value.trim();
    const password = adminPassInput.value.trim();

    if (!username || !password) return;

    btnAdminLogin.disabled = true;
    btnAdminLogin.innerHTML = '<span>Verifying...</span>';

    try {
      const res = await fetch(`${API_BASE}/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Invalid username or password');
      }

      adminToken = data.token;
      adminUsername = data.username;
      localStorage.setItem('p2p_admin_token', adminToken);
      localStorage.setItem('p2p_admin_user', adminUsername);

      checkAuthState();

    } catch (err) {
      loginAlert.className = 'alert-box error';
      loginAlert.textContent = `⚠️ ${err.message}`;
      loginAlert.style.display = 'block';
    } finally {
      btnAdminLogin.disabled = false;
      btnAdminLogin.innerHTML = '<span>Sign In to Admin Portal</span>';
    }
  });

  btnAdminLogout.addEventListener('click', () => {
    localStorage.removeItem('p2p_admin_token');
    localStorage.removeItem('p2p_admin_user');
    adminToken = null;
    checkAuthState();
  });

  // ---------------- 2. DASHBOARD & TABS ----------------
  function initDashboard() {
    loadDeposits();
    loadLiveOtps();
    loadSettings();
    loadUsers();

    // Auto poll deposits every 3 seconds
    clearInterval(depositsPollTimer);
    depositsPollTimer = setInterval(loadDeposits, 3000);

    // Auto poll active OTPs every 3 seconds
    clearInterval(otpsPollTimer);
    otpsPollTimer = setInterval(loadLiveOtps, 3000);
  }

  navTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetId = tab.dataset.tab;
      navTabs.forEach(t => t.classList.remove('active'));
      tabPanes.forEach(p => {
        p.classList.remove('active');
        p.style.display = 'none';
      });

      tab.classList.add('active');
      const activePane = document.getElementById(targetId);
      if (activePane) {
        activePane.classList.add('active');
        activePane.style.display = 'block';
      }
    });
  });

  // ---------------- 3. DEPOSITS & VERIFICATION MANAGEMENT ----------------
  async function loadDeposits() {
    try {
      const res = await fetch(`${API_BASE}/admin/deposits`);
      const data = await res.json();

      if (!data.success) return;

      renderDeposits(data.deposits || []);
    } catch (e) {
      console.warn('Error loading deposits:', e);
    }
  }

  function renderDeposits(deposits) {
    let pendingCount = 0;

    if (!deposits || deposits.length === 0) {
      depositsListContainer.innerHTML = '<div class="empty-state">No deposits submitted yet.</div>';
      pendingBadgeCount.textContent = '0';
      return;
    }

    depositsListContainer.innerHTML = '';

    deposits.forEach(dep => {
      if (dep.status === 'pending') pendingCount++;

      const card = document.createElement('div');
      card.className = `deposit-card ${dep.status}`;

      let statusBadgeHtml = '';
      if (dep.status === 'pending') {
        statusBadgeHtml = '<span class="status-badge pending">⏳ Pending Verification</span>';
      } else if (dep.status === 'approved') {
        statusBadgeHtml = '<span class="status-badge approved">✅ Approved</span>';
      } else {
        statusBadgeHtml = `<span class="status-badge rejected">❌ Rejected (${dep.rejectionReason || 'Flash USDT'})</span>`;
      }

      const formattedDate = new Date(dep.createdAt).toLocaleString();

      card.innerHTML = `
        <div class="deposit-card-header">
          <div class="trader-email-badge">👤 ${escapeHtml(dep.userEmail)}</div>
          <div>${statusBadgeHtml}</div>
        </div>

        <div class="deposit-card-body">
          <div class="meta-item">
            <span>Deposit Amount</span>
            <strong>${escapeHtml(dep.amount)} USDT</strong>
          </div>
          <div class="meta-item">
            <span>Network</span>
            <strong style="color: #38bdf8;">${escapeHtml(dep.network)}</strong>
          </div>
          <div class="meta-item">
            <span>Deposit ID</span>
            <span class="monospace" style="color: #cbd5e1;">${escapeHtml(dep.id)}</span>
          </div>
          <div class="meta-item">
            <span>Submitted Time</span>
            <span>${formattedDate}</span>
          </div>
          <div class="meta-item" style="grid-column: 1 / -1;">
            <span>Target Wallet Address</span>
            <span class="monospace" style="color: #94a3b8; font-size: 12px; word-break: break-all;">${escapeHtml(dep.walletAddress || 'N/A')}</span>
          </div>
          ${dep.txHash ? `
          <div class="meta-item" style="grid-column: 1 / -1;">
            <span>Trader TxID / Hash</span>
            <span class="monospace" style="color: #34d399; font-size: 12px; word-break: break-all;">${escapeHtml(dep.txHash)}</span>
          </div>` : ''}
        </div>

        <div class="deposit-actions-bar">
          <button type="button" class="btn-approve" data-id="${dep.id}">
            ✅ Approve Deposit
          </button>
          <button type="button" class="btn-reject-flash" data-id="${dep.id}">
            ❌ Cancel (Mark as Flash USDT)
          </button>
          ${dep.status === 'rejected' ? `<span style="font-size: 12px; color: #f87171; font-weight: 700;">User sees: "Your USDT is Flash"</span>` : ''}
        </div>
      `;

      // Event listeners for action buttons
      const btnApprove = card.querySelector('.btn-approve');
      const btnReject = card.querySelector('.btn-reject-flash');

      btnApprove.addEventListener('click', () => handleDepositAction(dep.id, 'approve'));
      btnReject.addEventListener('click', () => handleDepositAction(dep.id, 'reject', 'Your USDT is Flash'));

      depositsListContainer.appendChild(card);
    });

    pendingBadgeCount.textContent = String(pendingCount);
  }

  async function handleDepositAction(depositId, action, reason = '') {
    try {
      const res = await fetch(`${API_BASE}/admin/deposit/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ depositId, action, reason })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Action failed');
      }

      if (action === 'reject') {
        showToast('❌ Deposit rejected as "Your USDT is Flash"!');
      } else {
        showToast('✅ Deposit approved successfully!');
      }

      loadDeposits();

    } catch (err) {
      alert(`⚠️ ${err.message}`);
    }
  }

  btnRefreshDeposits.addEventListener('click', loadDeposits);

  // ---------------- 4. LIVE OTPS TAB ----------------
  async function loadLiveOtps() {
    try {
      const res = await fetch(`${API_BASE}/admin/otps`);
      const data = await res.json();

      if (!data.success) return;

      renderLiveOtps(data.otps || []);
    } catch (e) {
      console.warn('Error loading live OTPs:', e);
    }
  }

  function renderLiveOtps(otps) {
    activeOtpsBadge.textContent = String(otps.length);

    if (!otps || otps.length === 0) {
      otpsTableBody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #94a3b8; padding: 30px;">No active OTP requests right now.</td></tr>';
      return;
    }

    otpsTableBody.innerHTML = otps.map(o => {
      const mins = Math.floor(o.secondsRemaining / 60);
      const secs = o.secondsRemaining % 60;
      const timeLeft = `${mins}m ${secs}s`;
      const created = new Date(o.createdAt).toLocaleTimeString();

      return `
        <tr>
          <td><strong>${escapeHtml(o.email)}</strong></td>
          <td><span class="otp-code-pill">${escapeHtml(o.otp)}</span></td>
          <td><span style="color: #fbbf24; font-weight: 700;">⏱️ ${timeLeft}</span></td>
          <td style="color: #94a3b8;">${created}</td>
          <td>
            <button type="button" class="otp-copy-btn" onclick="navigator.clipboard.writeText('${o.otp}'); alert('OTP ${o.otp} copied to clipboard!');">
              📋 Copy OTP
            </button>
          </td>
        </tr>
      `;
    }).join('');
  }

  btnRefreshOtps.addEventListener('click', loadLiveOtps);

  // ---------------- 5. QR CODE UPLOAD FILE READERS ----------------
  function setupQrFileReader(inputEl, previewImg, noTextEl, removeBtn, setCallback) {
    inputEl.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      if (!file.type.startsWith('image/')) {
        alert('Please select an image file (PNG, JPG, WEBP)');
        return;
      }

      const reader = new FileReader();
      reader.onload = function(evt) {
        const base64Data = evt.target.result;
        previewImg.src = base64Data;
        previewImg.style.display = 'block';
        noTextEl.style.display = 'none';
        removeBtn.style.display = 'inline-block';
        setCallback(base64Data);
        showToast('QR Image loaded! Click Save to apply.');
      };
      reader.readAsDataURL(file);
    });

    removeBtn.addEventListener('click', () => {
      inputEl.value = '';
      previewImg.src = '';
      previewImg.style.display = 'none';
      noTextEl.style.display = 'block';
      removeBtn.style.display = 'none';
      setCallback('');
      showToast('Custom QR removed. Auto-generated QR will be used.');
    });
  }

  setupQrFileReader(
    fileTrc20Qr,
    imgPreviewTrc20,
    textNoTrc20Qr,
    btnRemoveTrc20Qr,
    (val) => { currentTrc20Qr = val; }
  );

  setupQrFileReader(
    fileBep20Qr,
    imgPreviewBep20,
    textNoBep20Qr,
    btnRemoveBep20Qr,
    (val) => { currentBep20Qr = val; }
  );

  // ---------------- 6. SETTINGS MANAGEMENT ----------------
  async function loadSettings() {
    try {
      const res = await fetch(`${API_BASE}/admin/settings`);
      const data = await res.json();

      if (data.success && data.settings) {
        const s = data.settings;
        settingAmount.value = s.usdtAmount || '2000';
        settingTrc20.value = s.trc20Address || '';
        settingBep20.value = s.bep20Address || '';
        settingSmtpUser.value = s.smtpUser || 'p2pexpertregistration@gmail.com';
        settingSmtpPass.value = s.smtpPass || 'bdne kakd pctf csju';

        // TRC20 QR Preview
        if (s.trc20QrImage && s.trc20QrImage.trim()) {
          currentTrc20Qr = s.trc20QrImage;
          imgPreviewTrc20.src = s.trc20QrImage;
          imgPreviewTrc20.style.display = 'block';
          textNoTrc20Qr.style.display = 'none';
          btnRemoveTrc20Qr.style.display = 'inline-block';
        } else {
          currentTrc20Qr = '';
          imgPreviewTrc20.style.display = 'none';
          textNoTrc20Qr.style.display = 'block';
          btnRemoveTrc20Qr.style.display = 'none';
        }

        // BEP20 QR Preview
        if (s.bep20QrImage && s.bep20QrImage.trim()) {
          currentBep20Qr = s.bep20QrImage;
          imgPreviewBep20.src = s.bep20QrImage;
          imgPreviewBep20.style.display = 'block';
          textNoBep20Qr.style.display = 'none';
          btnRemoveBep20Qr.style.display = 'inline-block';
        } else {
          currentBep20Qr = '';
          imgPreviewBep20.style.display = 'none';
          textNoBep20Qr.style.display = 'block';
          btnRemoveBep20Qr.style.display = 'none';
        }
      }
    } catch (e) {
      console.warn('Error loading settings:', e);
    }
  }

  settingsForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    settingsAlert.style.display = 'none';

    const usdtAmount = settingAmount.value.trim();
    const trc20Address = settingTrc20.value.trim();
    const bep20Address = settingBep20.value.trim();
    const smtpUser = settingSmtpUser.value.trim();
    const smtpPass = settingSmtpPass.value.trim();
    const newPass = settingAdminPass.value.trim();

    btnSaveSettings.disabled = true;
    btnSaveSettings.innerHTML = '<span>Saving...</span>';

    try {
      const payload = {
        usdtAmount,
        trc20Address,
        bep20Address,
        trc20QrImage: currentTrc20Qr,
        bep20QrImage: currentBep20Qr,
        smtpUser,
        smtpPass
      };
      if (newPass) payload.adminPassword = newPass;

      const res = await fetch(`${API_BASE}/admin/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Error saving settings');
      }

      showToast('Settings, Wallets & Custom QR Codes saved! 💾');
      settingsAlert.className = 'alert-box success';
      settingsAlert.textContent = '✅ All settings and uploaded QR images updated successfully!';
      settingsAlert.style.display = 'block';

      if (newPass) settingAdminPass.value = '';

    } catch (err) {
      settingsAlert.className = 'alert-box error';
      settingsAlert.textContent = `⚠️ ${err.message}`;
      settingsAlert.style.display = 'block';
    } finally {
      btnSaveSettings.disabled = false;
      btnSaveSettings.innerHTML = '<span>💾 Save All Settings</span>';
    }
  });

  // Test Email
  btnSendTestEmail.addEventListener('click', async () => {
    const targetEmail = testEmailInput.value.trim();
    if (!targetEmail) {
      alert('Please enter a test email address.');
      return;
    }

    btnSendTestEmail.disabled = true;
    btnSendTestEmail.textContent = 'Sending...';

    try {
      const res = await fetch(`${API_BASE}/admin/test-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetEmail })
      });
      const data = await res.json();
      if (data.success) {
        alert(`✅ Test email sent successfully to ${targetEmail}!`);
      } else {
        alert(`❌ Email delivery failed: ${data.result?.error || 'Unknown error'}`);
      }
    } catch (e) {
      alert(`⚠️ Request failed: ${e.message}`);
    } finally {
      btnSendTestEmail.disabled = false;
      btnSendTestEmail.textContent = 'Send Test Email ✉️';
    }
  });

  // ---------------- 7. REGISTERED TRADERS ----------------
  async function loadUsers() {
    try {
      const res = await fetch(`${API_BASE}/admin/users`);
      const data = await res.json();

      if (!data.success) return;

      renderUsers(data.users || []);
    } catch (e) {
      console.warn('Error loading users:', e);
    }
  }

  function renderUsers(users) {
    if (!users || users.length === 0) {
      usersTableBody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #94a3b8;">No registered users yet.</td></tr>';
      return;
    }

    usersTableBody.innerHTML = users.map(u => `
      <tr>
        <td class="monospace">${escapeHtml(u.id)}</td>
        <td><strong>${escapeHtml(u.email)}</strong></td>
        <td><span style="background: #334155; padding: 2px 8px; border-radius: 4px; font-size: 11px;">${escapeHtml(u.role)}</span></td>
        <td>${new Date(u.createdAt).toLocaleString()}</td>
        <td><span style="color: #34d399; font-weight: 700;">Active 🟢</span></td>
      </tr>
    `).join('');
  }

  btnRefreshUsers.addEventListener('click', loadUsers);

  // Helper
  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Initial check
  checkAuthState();

})();
