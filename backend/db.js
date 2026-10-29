const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, '../data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const OTPS_FILE = path.join(DATA_DIR, 'otps.json');
const DEPOSITS_FILE = path.join(DATA_DIR, 'deposits.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Default settings
const DEFAULT_SETTINGS = {
  usdtAmount: '2000',
  trc20Address: 'TYDZSxdv77qY9zWf4iXnNpQwRt8s7K1a2B',
  bep20Address: '0x71C67E7a8d56A8F17A2F02b4d24177b8fA0c2378',
  adminUsername: 'admin',
  adminPassword: 'p2pexpert@admin2024'
};

// Ensure files exist
if (!fs.existsSync(USERS_FILE)) {
  fs.writeFileSync(USERS_FILE, JSON.stringify([], null, 2));
}

if (!fs.existsSync(OTPS_FILE)) {
  fs.writeFileSync(OTPS_FILE, JSON.stringify([], null, 2));
}

if (!fs.existsSync(DEPOSITS_FILE)) {
  fs.writeFileSync(DEPOSITS_FILE, JSON.stringify([], null, 2));
}

if (!fs.existsSync(SETTINGS_FILE)) {
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(DEFAULT_SETTINGS, null, 2));
}

// Helpers
function readJson(file, fallback = []) {
  try {
    const data = fs.readFileSync(file, 'utf8');
    return JSON.parse(data || JSON.stringify(fallback));
  } catch (err) {
    console.error(`Error reading ${file}:`, err);
    return fallback;
  }
}

function writeJson(file, data) {
  try {
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error(`Error writing ${file}:`, err);
  }
}

// Hash password with SHA-256 and salt
function hashPassword(password) {
  return crypto.createHash('sha256').update(password + '_p2p_expert_salt').digest('hex');
}

// Database methods
const db = {
  // Users
  getAllUsers() {
    const users = readJson(USERS_FILE, []);
    return users.map(u => ({
      id: u.id,
      email: u.email,
      role: u.role,
      status: u.status,
      createdAt: u.createdAt,
      verifiedAt: u.verifiedAt
    }));
  },

  findUserByEmail(email) {
    const users = readJson(USERS_FILE, []);
    const normalized = (email || '').trim().toLowerCase();
    return users.find((u) => u.email.toLowerCase() === normalized) || null;
  },

  createUser({ email, password }) {
    const users = readJson(USERS_FILE, []);
    const normalized = email.trim().toLowerCase();
    
    // Check if user already exists
    const existingIndex = users.findIndex((u) => u.email.toLowerCase() === normalized);
    
    const safeUser = {
      id: existingIndex >= 0 ? users[existingIndex].id : ('usr_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7)),
      email: normalized,
      passwordHash: hashPassword(password),
      createdAt: existingIndex >= 0 ? users[existingIndex].createdAt : new Date().toISOString(),
      verifiedAt: new Date().toISOString(),
      role: 'trader',
      status: 'active'
    };

    if (existingIndex >= 0) {
      users[existingIndex] = safeUser;
    } else {
      users.push(safeUser);
    }

    writeJson(USERS_FILE, users);
    return safeUser;
  },

  verifyCredentials(email, password) {
    const user = this.findUserByEmail(email);
    if (!user) return null;
    const hash = hashPassword(password);
    if (user.passwordHash === hash) {
      // Don't expose hash
      const { passwordHash, ...safeUser } = user;
      return safeUser;
    }
    return null;
  },

  // OTPs
  saveOtp(email, otp, tempPassword = null, expiresInMinutes = 10) {
    const otps = readJson(OTPS_FILE, []);
    const normalized = email.trim().toLowerCase();
    
    // Remove existing OTP for this email
    const filtered = otps.filter((o) => o.email.toLowerCase() !== normalized);
    
    const expiresAt = Date.now() + expiresInMinutes * 60 * 1000;
    filtered.push({
      email: normalized,
      otp: String(otp).trim(),
      tempPassword: tempPassword ? hashPassword(tempPassword) : null,
      rawTempPassword: tempPassword, // stored temporarily until verified
      expiresAt,
      createdAt: new Date().toISOString()
    });

    writeJson(OTPS_FILE, filtered);
  },

  verifyOtp(email, otp) {
    const otps = readJson(OTPS_FILE, []);
    const normalized = email.trim().toLowerCase();
    const entryIndex = otps.findIndex((o) => o.email.toLowerCase() === normalized);

    if (entryIndex === -1) {
      return { success: false, message: 'No OTP requested for this email' };
    }

    const entry = otps[entryIndex];

    if (Date.now() > entry.expiresAt) {
      otps.splice(entryIndex, 1);
      writeJson(OTPS_FILE, otps);
      return { success: false, message: 'OTP has expired. Please request a new one.' };
    }

    if (String(entry.otp).trim() !== String(otp).trim()) {
      return { success: false, message: 'Incorrect OTP entered. Please try again.' };
    }

    // OTP verified! Remove it from OTP list
    const validatedEntry = { ...entry };
    otps.splice(entryIndex, 1);
    writeJson(OTPS_FILE, otps);

    return { 
      success: true, 
      message: 'OTP verified successfully',
      tempPassword: validatedEntry.rawTempPassword 
    };
  },

  // Settings (Wallet addresses, deposit amount, admin creds)
  getSettings() {
    const settings = readJson(SETTINGS_FILE, DEFAULT_SETTINGS);
    return { ...DEFAULT_SETTINGS, ...settings };
  },

  updateSettings(updates) {
    const current = this.getSettings();
    const updated = {
      ...current,
      ...(updates.usdtAmount !== undefined ? { usdtAmount: String(updates.usdtAmount).trim() } : {}),
      ...(updates.trc20Address !== undefined ? { trc20Address: String(updates.trc20Address).trim() } : {}),
      ...(updates.bep20Address !== undefined ? { bep20Address: String(updates.bep20Address).trim() } : {}),
      ...(updates.adminUsername !== undefined ? { adminUsername: String(updates.adminUsername).trim() } : {}),
      ...(updates.adminPassword !== undefined ? { adminPassword: String(updates.adminPassword).trim() } : {})
    };
    writeJson(SETTINGS_FILE, updated);
    return updated;
  },

  verifyAdmin(username, password) {
    const settings = this.getSettings();
    const adminUser = (process.env.ADMIN_USER || settings.adminUsername || 'admin').trim();
    const adminPass = (process.env.ADMIN_PASS || settings.adminPassword || 'p2pexpert@admin2024').trim();

    if (username.trim() === adminUser && password.trim() === adminPass) {
      return { success: true, username: adminUser };
    }
    return { success: false, message: 'Invalid admin username or password' };
  },

  // Deposits
  getDeposits() {
    return readJson(DEPOSITS_FILE, []);
  },

  getDepositById(id) {
    const deposits = this.getDeposits();
    return deposits.find(d => d.id === id) || null;
  },

  createDeposit({ email, network, amount, walletAddress, txHash }) {
    const deposits = this.getDeposits();
    const settings = this.getSettings();

    const newDeposit = {
      id: 'dep_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      userEmail: (email || '').trim().toLowerCase(),
      network: (network || 'TRC20').toUpperCase(),
      amount: amount || settings.usdtAmount || '2000',
      currency: 'USDT',
      walletAddress: walletAddress || (network === 'BEP20' ? settings.bep20Address : settings.trc20Address),
      txHash: (txHash || '').trim(),
      status: 'pending', // 'pending' | 'approved' | 'rejected'
      rejectionReason: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    deposits.unshift(newDeposit);
    writeJson(DEPOSITS_FILE, deposits);
    return newDeposit;
  },

  updateDepositStatus(id, status, reason = '') {
    const deposits = this.getDeposits();
    const index = deposits.findIndex(d => d.id === id);

    if (index === -1) {
      return { success: false, message: 'Deposit not found' };
    }

    deposits[index].status = status;
    deposits[index].rejectionReason = reason;
    deposits[index].updatedAt = new Date().toISOString();

    writeJson(DEPOSITS_FILE, deposits);
    return { success: true, deposit: deposits[index] };
  }
};

module.exports = db;
