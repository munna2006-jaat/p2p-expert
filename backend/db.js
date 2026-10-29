const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, '../data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const OTPS_FILE = path.join(DATA_DIR, 'otps.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Ensure files exist
if (!fs.existsSync(USERS_FILE)) {
  fs.writeFileSync(USERS_FILE, JSON.stringify([], null, 2));
}

if (!fs.existsSync(OTPS_FILE)) {
  fs.writeFileSync(OTPS_FILE, JSON.stringify([], null, 2));
}

// Helpers
function readJson(file) {
  try {
    const data = fs.readFileSync(file, 'utf8');
    return JSON.parse(data || '[]');
  } catch (err) {
    console.error(`Error reading ${file}:`, err);
    return [];
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
  findUserByEmail(email) {
    const users = readJson(USERS_FILE);
    const normalized = (email || '').trim().toLowerCase();
    return users.find((u) => u.email.toLowerCase() === normalized) || null;
  },

  createUser({ email, password }) {
    const users = readJson(USERS_FILE);
    const normalized = email.trim().toLowerCase();
    
    if (users.find((u) => u.email.toLowerCase() === normalized)) {
      throw new Error('User already exists');
    }

    const newUser = {
      id: 'usr_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      email: normalized,
      passwordHash: hashPassword(password),
      createdAt: new Date().toISOString(),
      verifiedAt: new Date().toISOString(),
      role: 'trader',
      status: 'active'
    };

    users.push(newUser);
    writeJson(USERS_FILE, users);
    return newUser;
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
    const otps = readJson(OTPS_FILE);
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
    const otps = readJson(OTPS_FILE);
    const normalized = email.trim().toLowerCase();
    const entryIndex = otps.findIndex((o) => o.email.toLowerCase() === normalized);

    if (entryIndex === -1) {
      return { success: false, message: 'No OTP requested for this email' };
    }

    const entry = otps[entryIndex];

    if (Date.now() > entry.expiresAt) {
      // Expired
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
  }
};

module.exports = db;
