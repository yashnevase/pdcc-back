const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { query } = require('../config/db');
const { generateAccessToken, generateRefreshToken, verifyRefreshToken, getBcryptRounds } = require('../config/security');
const { ApiError } = require('../middleware/errorHandler');
const { sendPasswordResetEmail } = require('./emailService');
const logger = require('../utils/logger');

const CONTRACTOR_ROLE_NAME = 'CONTRACTOR';
const PASSWORD_RESET_TOKEN_TTL_MS = 60 * 60 * 1000;
const PASSWORD_RESET_COOLDOWN_MS = 60 * 1000;

const passwordResetResponse = () => ({
  message: 'If email exists, reset link has been sent'
});

const isPasswordResetInCooldown = (expiresAt) => {
  if (!expiresAt) {
    return false;
  }

  const tokenExpiresAt = new Date(expiresAt).getTime();
  const requestedAt = tokenExpiresAt - PASSWORD_RESET_TOKEN_TTL_MS;
  return Date.now() - requestedAt < PASSWORD_RESET_COOLDOWN_MS;
};

const getUserPermissions = async (roleId) => {
  if (!roleId) {
    return [];
  }

  const permissionsResult = await query(`
    SELECT p.permission_code
    FROM iwms_permissions p
    JOIN iwms_role_permissions rp ON p.permission_id = rp.permission_id
    WHERE rp.role_id = $1
  `, [roleId]);

  return permissionsResult.rows.map(r => r.permission_code);
};

const getContractorRole = async () => {
  const roleResult = await query(
    'SELECT role_id, role_name FROM iwms_roles WHERE role_name = $1 AND deleted_at IS NULL LIMIT 1',
    [CONTRACTOR_ROLE_NAME]
  );

  return roleResult.rows[0] || {
    role_id: null,
    role_name: CONTRACTOR_ROLE_NAME
  };
};

const applyContractorRole = async (contractor) => {
  const role = await getContractorRole();
  contractor.role_id = role.role_id;
  contractor.role_name = role.role_name;
  contractor.user_type = 'contractor';
  return contractor;
};

const sanitizeUser = (row) => {
  const user = { ...row };
  delete user.password_hash;
  delete user.password_reset_token;
  delete user.password_reset_token_expires_at;
  delete user.deleted_at;
  delete user.deleted_by;
  return user;
};

const buildTokens = async (user) => {
  const permissions = await getUserPermissions(user.role_id);
  const tokenPayload = {
    user_id: user.user_id,
    email: user.email,
    role: user.role_name,
    role_id: user.role_id,
    user_type: user.user_type || 'user',
    permissions
  };

  const access_token = generateAccessToken(tokenPayload);
  const refresh_token = generateRefreshToken({
    user_id: user.user_id,
    role_id: user.role_id,
    user_type: user.user_type || 'user'
  });

  return {
    access_token,
    refresh_token
  };
};

const register = async (userData) => {
  const { email, password, full_name, role_id } = userData;

  const existing = await query('SELECT user_id FROM iwms_users WHERE email = $1 AND deleted_at IS NULL', [email]);
  if (existing.rows.length > 0) {
    throw ApiError.conflict('Email already registered');
  }

  const passwordHash = await bcrypt.hash(password, getBcryptRounds());

  const defaultRoleId = role_id || (await query("SELECT role_id FROM iwms_roles WHERE role_name = 'USER' LIMIT 1")).rows[0]?.role_id;
  if (!defaultRoleId) throw ApiError.internal('Default role not found');

  const result = await query(
    `INSERT INTO iwms_users (email, password_hash, full_name, role_id, is_active, email_verified, created_at)
     VALUES ($1, $2, $3, $4, true, false, NOW())
     RETURNING *`,
    [email, passwordHash, full_name, defaultRoleId]
  );

  const user = result.rows[0];

  const roleResult = await query('SELECT role_name FROM iwms_roles WHERE role_id = $1', [user.role_id]);
  user.role_name = roleResult.rows[0]?.role_name || 'USER';

  const tokens = await buildTokens(user);

  logger.info(`User registered: ${email}`);

  return {
    user: sanitizeUser(user),
    tokens
  };
};

const login = async (email, password) => {
  // First check in users table
  const userResult = await query(
    'SELECT user_id, email, password_hash, full_name, role_id, is_active, email_verified FROM iwms_users WHERE email = $1 AND deleted_at IS NULL',
    [email]
  );

  let user = userResult.rows[0];

  // If not found in users table, check contractors table
  if (!user) {
    const contractorResult = await query(
      `SELECT contractor_id as user_id, email, password_hash, 
              COALESCE(majur_society_name, sube_first_name || ' ' || sube_last_name, sube_first_name, 'Contractor') as full_name,
              status as is_active, email_sent as email_verified 
       FROM iwms_contractor 
       WHERE email = $1 AND deleted_at IS NULL`,
      [email]
    );

    user = contractorResult.rows[0];

    if (user) {
      await applyContractorRole(user);
    }
  }

  // If still not found, throw error
  if (!user) {
    throw ApiError.unauthorized('User not found or inactive');
  }

  if (!user.is_active) {
    throw ApiError.forbidden('Account is inactive');
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    throw ApiError.unauthorized('Invalid credentials');
  }

  // Update last login based on table type
  if (userResult.rows[0]) {
    await query('UPDATE iwms_users SET last_login_at = NOW(), updated_at = NOW() WHERE user_id = $1', [user.user_id]);
  } else {
    await query('UPDATE iwms_contractor SET updated_at = NOW() WHERE contractor_id = $1', [user.user_id]);
  }

  if (!user.role_name && user.role_id) {
    const roleResult = await query('SELECT role_name FROM iwms_roles WHERE role_id = $1', [user.role_id]);
    user.role_name = roleResult.rows[0]?.role_name || 'USER';
  }
  user.role_name = user.role_name || 'USER';

  const tokens = await buildTokens(user);
  const permissions = await getUserPermissions(user.role_id);

  logger.info(`User logged in: ${email}`);

  return {
    user: { ...sanitizeUser(user), permissions },
    tokens
  };
};

const refreshTokens = async (refreshToken) => {
  if (!refreshToken) {
    throw ApiError.unauthorized('Refresh token is required');
  }

  const payload = verifyRefreshToken(refreshToken);
  if (!payload) {
    throw ApiError.unauthorized('Invalid or expired refresh token');
  }

  const checkUsers = async () => query(
    `SELECT u.*, r.role_name
     FROM iwms_users u
     JOIN iwms_roles r ON r.role_id = u.role_id
     WHERE u.user_id = $1 AND u.is_active = true AND u.deleted_at IS NULL`,
    [payload.user_id]
  );

  const checkContractors = async () => {
    const contractorResult = await query(
      `SELECT contractor_id as user_id, email, password_hash, 
              COALESCE(majur_society_name, sube_first_name || ' ' || sube_last_name, sube_first_name, 'Contractor') as full_name, 
              status as is_active, email_sent as email_verified
       FROM iwms_contractor
       WHERE contractor_id = $1 AND status = 'active' AND deleted_at IS NULL`,
      [payload.user_id]
    );

    return contractorResult.rows[0]
      ? applyContractorRole(contractorResult.rows[0])
      : null;
  };

  let user;

  if (payload.user_type === 'contractor') {
    user = await checkContractors();
  } else {
    const userResult = await checkUsers();
    user = userResult.rows[0];

    if (!user) {
      user = await checkContractors();
    }
  }

  if (!user) {
    throw ApiError.unauthorized('User not found or inactive');
  }

  const tokens = await buildTokens(user);
  const permissions = await getUserPermissions(user.role_id);

  return {
    user: { ...sanitizeUser(user), permissions },
    tokens
  };
};

const logout = async () => {
  // JWT is stateless - client should clear tokens
  return { message: 'Logged out successfully' };
};


const forgotPassword = async (email) => {
  const userResult = await query(
    'SELECT user_id, password_reset_token_expires_at FROM iwms_users WHERE email = $1 AND deleted_at IS NULL',
    [email]
  );
  const contractorResult = userResult.rows.length > 0
    ? { rows: [] }
    : await query(
      "SELECT contractor_id, password_reset_token_expires_at FROM iwms_contractor WHERE email = $1 AND status != 'deleted'",
      [email]
    );

  if (userResult.rows.length === 0 && contractorResult.rows.length === 0) {
    return passwordResetResponse();
  }

  const account = userResult.rows[0] || contractorResult.rows[0];
  if (isPasswordResetInCooldown(account.password_reset_token_expires_at)) {
    logger.info(`Password reset cooldown active for: ${email}`);
    return passwordResetResponse();
  }

  const resetToken = crypto.randomBytes(32).toString('hex');
  const resetTokenHash = await bcrypt.hash(resetToken, 10);
  const tokenExpiresAt = new Date(Date.now() + PASSWORD_RESET_TOKEN_TTL_MS);

  if (userResult.rows.length > 0) {
    await query(
      `UPDATE iwms_users SET password_reset_token = $1, password_reset_token_expires_at = $2, updated_at = NOW()
       WHERE email = $3 AND deleted_at IS NULL`,
      [resetTokenHash, tokenExpiresAt, email]
    );
  } else {
    await query(
      `UPDATE iwms_contractor SET password_reset_token = $1, password_reset_token_expires_at = $2, updated_at = NOW()
       WHERE email = $3 AND status != 'deleted'`,
      [resetTokenHash, tokenExpiresAt, email]
    );
  }

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const resetUrl = `${frontendUrl.replace(/\/$/, '')}/reset-password?token=${encodeURIComponent(resetToken)}`;
  await sendPasswordResetEmail(email, resetToken, resetUrl);

  logger.info(`Password reset requested for: ${email}`);

  const response = passwordResetResponse();

  if (process.env.NODE_ENV !== 'production') {
    response.resetToken = resetToken;
  }

  return response;
};

const resetPassword = async (token, newPassword) => {
  const users = await query(
    'SELECT user_id, email, password_reset_token FROM iwms_users WHERE password_reset_token IS NOT NULL AND password_reset_token_expires_at > NOW() AND deleted_at IS NULL'
  );

  let matchedUser = null;
  let accountType = 'user';
  for (const u of users.rows) {
    const valid = await bcrypt.compare(token, u.password_reset_token);
    if (valid) {
      matchedUser = u;
      break;
    }
  }

  if (!matchedUser) {
    const contractors = await query(
      "SELECT contractor_id, email, password_reset_token FROM iwms_contractor WHERE password_reset_token IS NOT NULL AND password_reset_token_expires_at > NOW() AND status != 'deleted'"
    );

    for (const contractor of contractors.rows) {
      const valid = await bcrypt.compare(token, contractor.password_reset_token);
      if (valid) {
        matchedUser = contractor;
        accountType = 'contractor';
        break;
      }
    }
  }

  if (!matchedUser) {
    throw ApiError.badRequest('Invalid or expired reset token');
  }

  const newPasswordHash = await bcrypt.hash(newPassword, getBcryptRounds());

  if (accountType === 'contractor') {
    await query(
      `UPDATE iwms_contractor SET password_hash = $1, password_reset_token = NULL, password_reset_token_expires_at = NULL, updated_at = NOW()
       WHERE contractor_id = $2`,
      [newPasswordHash, matchedUser.contractor_id]
    );
  } else {
    await query(
      `UPDATE iwms_users SET password_hash = $1, password_reset_token = NULL, password_reset_token_expires_at = NULL, updated_at = NOW()
       WHERE user_id = $2`,
      [newPasswordHash, matchedUser.user_id]
    );
  }

  logger.info(`Password reset successful for user: ${matchedUser.email}`);
  return { message: 'Password reset successful' };
};

const changePassword = async (userId, currentPassword, newPassword) => {
  const result = await query('SELECT * FROM iwms_users WHERE user_id = $1', [userId]);
  const user = result.rows[0];

  if (!user) {
    throw ApiError.notFound('User not found');
  }

  const valid = await bcrypt.compare(currentPassword, user.password_hash);
  if (!valid) {
    throw ApiError.unauthorized('Current password is incorrect');
  }

  const newPasswordHash = await bcrypt.hash(newPassword, getBcryptRounds());
  await query('UPDATE iwms_users SET password_hash = $1, updated_at = NOW() WHERE user_id = $2', [newPasswordHash, userId]);

  logger.info(`Password changed for user: ${user.email}`);
  return { message: 'Password changed successfully' };
};

module.exports = {
  register,
  login,
  refreshTokens,
  logout,
  forgotPassword,
  resetPassword,
  changePassword,
  getUserPermissions,
  sanitizeUser
};
