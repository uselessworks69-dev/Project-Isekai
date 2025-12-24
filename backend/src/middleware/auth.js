import jwt from 'jsonwebtoken';
import User from '../models/User.js';

/**
 * Authentication middleware for verifying JWT tokens
 */
export const authMiddleware = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: {
          type: 'NO_TOKEN',
          message: 'No authentication token provided',
          code: 'AUTH_NO_TOKEN'
        }
      });
    }

    const token = authHeader.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({
        error: {
          type: 'INVALID_TOKEN',
          message: 'Invalid token format',
          code: 'AUTH_INVALID_FORMAT'
        }
      });
    }

    // Verify token
    let decoded;
    try {
      decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || 'isekai-development-secret-change-in-production'
      );
    } catch (jwtError) {
      if (jwtError.name === 'TokenExpiredError') {
        return res.status(401).json({
          error: {
            type: 'TOKEN_EXPIRED',
            message: 'Authentication token has expired',
            code: 'AUTH_TOKEN_EXPIRED',
            expiredAt: jwtError.expiredAt
          }
        });
      } else if (jwtError.name === 'JsonWebTokenError') {
        return res.status(401).json({
          error: {
            type: 'INVALID_TOKEN',
            message: 'Invalid authentication token',
            code: 'AUTH_INVALID_TOKEN'
          }
        });
      } else {
        throw jwtError;
      }
    }

    // Check if token has required structure
    if (!decoded.id || !decoded.username || !decoded.email) {
      return res.status(401).json({
        error: {
          type: 'MALFORMED_TOKEN',
          message: 'Token missing required fields',
          code: 'AUTH_MALFORMED_TOKEN'
        }
      });
    }

    // Find user in database
    const user = await User.findByPk(decoded.id);
    
    if (!user) {
      return res.status(401).json({
        error: {
          type: 'USER_NOT_FOUND',
          message: 'User no longer exists',
          code: 'AUTH_USER_NOT_FOUND'
        }
      });
    }

    // Check if user is banned/suspended
    if (user.character_data?.is_banned) {
      return res.status(403).json({
        error: {
          type: 'ACCOUNT_BANNED',
          message: 'Account has been suspended',
          code: 'AUTH_ACCOUNT_BANNED',
          ban_reason: user.character_data.ban_reason,
          ban_until: user.character_data.ban_until
        }
      });
    }

    // Check if user is in maintenance mode (admins only)
    if (process.env.MAINTENANCE_MODE === 'true' && !user.character_data?.is_admin) {
      return res.status(503).json({
        error: {
          type: 'MAINTENANCE_MODE',
          message: 'System is under maintenance. Please try again later.',
          code: 'SYSTEM_MAINTENANCE'
        }
      });
    }

    // Attach user to request object
    req.user = user;
    req.token = token;
    req.tokenExpires = new Date(decoded.exp * 1000);

    // Log authentication (for audit trail)
    logAuthentication(req, user);

    next();
  } catch (error) {
    console.error('[Auth Middleware Error]:', error);
    
    // Don't expose internal errors to client
    return res.status(500).json({
      error: {
        type: 'AUTH_SERVER_ERROR',
        message: 'Authentication server error',
        code: 'AUTH_SERVER_ERROR',
        timestamp: new Date().toISOString()
      }
    });
  }
};

/**
 * Optional authentication middleware (doesn't fail if no token)
 */
export const optionalAuthMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      
      if (token) {
        try {
          const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET || 'isekai-development-secret-change-in-production'
          );
          
          const user = await User.findByPk(decoded.id);
          if (user && !user.character_data?.is_banned) {
            req.user = user;
            req.token = token;
            req.isAuthenticated = true;
          }
        } catch (error) {
          // Token is invalid but that's okay for optional auth
          req.isAuthenticated = false;
        }
      }
    }
    
    next();
  } catch (error) {
    console.error('[Optional Auth Error]:', error);
    next();
  }
};

/**
 * Role-based authorization middleware
 */
export const requireRole = (roles) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          error: {
            type: 'UNAUTHORIZED',
            message: 'Authentication required',
            code: 'AUTH_REQUIRED'
          }
        });
      }

      const userRole = req.user.character_data?.role || 'user';
      const userRoles = Array.isArray(roles) ? roles : [roles];
      
      if (!userRoles.includes(userRole) && userRole !== 'admin') {
        return res.status(403).json({
          error: {
            type: 'INSUFFICIENT_PERMISSIONS',
            message: `Insufficient permissions. Required: ${userRoles.join(', ')}`,
            code: 'AUTH_INSUFFICIENT_PERMISSIONS',
            user_role: userRole,
            required_roles: userRoles
          }
        });
      }

      next();
    } catch (error) {
      console.error('[Role Middleware Error]:', error);
      res.status(500).json({
        error: {
          type: 'SERVER_ERROR',
          message: 'Authorization check failed',
          code: 'AUTH_ROLE_CHECK_FAILED'
        }
      });
    }
  };
};

/**
 * Rate limiting middleware for authentication endpoints
 */
export const authRateLimit = (options = {}) => {
  const {
    windowMs = 15 * 60 * 1000, // 15 minutes
    maxAttempts = 5,
    message = 'Too many authentication attempts. Please try again later.'
  } = options;

  const attempts = new Map();

  return async (req, res, next) => {
    try {
      const identifier = req.ip || req.connection.remoteAddress;
      const now = Date.now();
      
      if (!attempts.has(identifier)) {
        attempts.set(identifier, []);
      }
      
      const userAttempts = attempts.get(identifier);
      
      // Remove attempts outside the time window
      const validAttempts = userAttempts.filter(time => now - time < windowMs);
      attempts.set(identifier, validAttempts);
      
      if (validAttempts.length >= maxAttempts) {
        return res.status(429).json({
          error: {
            type: 'RATE_LIMITED',
            message: message,
            code: 'AUTH_RATE_LIMITED',
            retry_after: Math.ceil(windowMs / 1000),
            attempts: validAttempts.length,
            max_attempts: maxAttempts
          }
        });
      }
      
      // Add current attempt
      validAttempts.push(now);
      attempts.set(identifier, validAttempts);
      
      next();
    } catch (error) {
      console.error('[Rate Limit Middleware Error]:', error);
      next();
    }
  };
};

/**
 * CSRF protection middleware
 */
export const csrfProtection = (req, res, next) => {
  // Skip CSRF for API requests that use token authentication
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    return next();
  }
  
  // For session-based auth, implement CSRF checks here
  // This is a placeholder for future session-based authentication
  
  next();
};

/**
 * Security headers middleware
 */
export const securityHeaders = (req, res, next) => {
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');
  
  // Enable XSS protection
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // Referrer policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Content Security Policy (adjust for your needs)
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self'"
  );
  
  // HSTS (should only be used in production with HTTPS)
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  
  next();
};

/**
 * Token refresh validation
 */
export const validateRefreshToken = async (req, res, next) => {
  try {
    const { refresh_token } = req.body;
    
    if (!refresh_token) {
      return res.status(400).json({
        error: {
          type: 'NO_REFRESH_TOKEN',
          message: 'No refresh token provided',
          code: 'AUTH_NO_REFRESH_TOKEN'
        }
      });
    }
    
    let decoded;
    try {
      decoded = jwt.verify(
        refresh_token,
        process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET || 'isekai-refresh-secret'
      );
    } catch (jwtError) {
      if (jwtError.name === 'TokenExpiredError') {
        return res.status(401).json({
          error: {
            type: 'REFRESH_TOKEN_EXPIRED',
            message: 'Refresh token has expired. Please log in again.',
            code: 'AUTH_REFRESH_EXPIRED'
          }
        });
      }
      throw jwtError;
    }
    
    if (decoded.type !== 'refresh') {
      return res.status(401).json({
        error: {
          type: 'INVALID_TOKEN_TYPE',
          message: 'Invalid token type for refresh',
          code: 'AUTH_INVALID_REFRESH_TYPE'
        }
      });
    }
    
    const user = await User.findByPk(decoded.id);
    if (!user) {
      return res.status(401).json({
        error: {
          type: 'USER_NOT_FOUND',
          message: 'User no longer exists',
          code: 'AUTH_USER_NOT_FOUND'
        }
      });
    }
    
    req.user = user;
    req.refreshToken = refresh_token;
    next();
  } catch (error) {
    console.error('[Refresh Token Validation Error]:', error);
    res.status(500).json({
      error: {
        type: 'REFRESH_SERVER_ERROR',
        message: 'Refresh token validation failed',
        code: 'AUTH_REFRESH_FAILED'
      }
    });
  }
};

/**
 * Logout/invalidate token middleware
 */
export const logoutMiddleware = async (req, res, next) => {
  try {
    // In a production system, you would:
    // 1. Add token to a blacklist (Redis)
    // 2. Set token expiry to immediate
    // 3. Clear any session data
    
    // For now, we'll just clear the token on client side
    // In the future, implement token blacklisting
    
    next();
  } catch (error) {
    console.error('[Logout Middleware Error]:', error);
    next();
  }
};

/**
 * Two-factor authentication middleware (placeholder for future implementation)
 */
export const require2FA = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: {
          type: 'UNAUTHORIZED',
          message: 'Authentication required',
          code: 'AUTH_REQUIRED'
        }
      });
    }
    
    // Check if 2FA is enabled for this user
    const is2FAEnabled = req.user.character_data?.security?.two_factor_enabled || false;
    
    if (is2FAEnabled) {
      // Check if 2FA has been verified in this session
      const is2FAVerified = req.session?.twoFactorVerified || false;
      
      if (!is2FAVerified) {
        return res.status(403).json({
          error: {
            type: '2FA_REQUIRED',
            message: 'Two-factor authentication required',
            code: 'AUTH_2FA_REQUIRED',
            two_factor_methods: req.user.character_data.security?.two_factor_methods || []
          }
        });
      }
    }
    
    next();
  } catch (error) {
    console.error('[2FA Middleware Error]:', error);
    res.status(500).json({
      error: {
        type: '2FA_SERVER_ERROR',
        message: 'Two-factor authentication check failed',
        code: 'AUTH_2FA_CHECK_FAILED'
      }
    });
  }
};

/**
 * IP whitelisting middleware (for admin endpoints)
 */
export const ipWhitelist = (allowedIPs) => {
  return (req, res, next) => {
    const clientIP = req.ip || req.connection.remoteAddress;
    
    if (!allowedIPs.includes(clientIP) && !allowedIPs.includes('0.0.0.0')) {
      return res.status(403).json({
        error: {
          type: 'IP_NOT_ALLOWED',
          message: 'Your IP address is not authorized to access this endpoint',
          code: 'AUTH_IP_NOT_ALLOWED',
          client_ip: clientIP
        }
      });
    }
    
    next();
  };
};

/**
 * Device fingerprinting (for enhanced security)
 */
export const deviceFingerprint = async (req, res, next) => {
  try {
    if (!req.user) {
      return next();
    }
    
    // Extract device fingerprint from request
    const fingerprint = {
      userAgent: req.headers['user-agent'],
      accept: req.headers['accept'],
      encoding: req.headers['accept-encoding'],
      language: req.headers['accept-language'],
      ip: req.ip,
      timestamp: new Date().toISOString()
    };
    
    // Hash the fingerprint for storage
    const fingerprintHash = require('crypto')
      .createHash('sha256')
      .update(JSON.stringify(fingerprint))
      .digest('hex');
    
    req.deviceFingerprint = fingerprintHash;
    
    // Check if this is a new device (optional)
    const knownDevices = req.user.character_data?.security?.known_devices || [];
    const isNewDevice = !knownDevices.includes(fingerprintHash);
    
    if (isNewDevice && process.env.NODE_ENV === 'production') {
      // Could trigger email verification for new device
      req.isNewDevice = true;
    }
    
    next();
  } catch (error) {
    console.error('[Device Fingerprint Error]:', error);
    next();
  }
};

/**
 * Audit logging for authentication events
 */
const logAuthentication = (req, user) => {
  // In production, this would log to a database or external service
  const auditLog = {
    timestamp: new Date().toISOString(),
    userId: user.id,
    username: user.username,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    endpoint: req.originalUrl,
    method: req.method,
    event: 'AUTH_SUCCESS'
  };
  
  // Log to console in development
  if (process.env.NODE_ENV === 'development') {
    console.log('[AUTH AUDIT]:', auditLog);
  }
  
  // In production, you would:
  // 1. Write to audit log database
  // 2. Send to SIEM system
  // 3. Trigger alerts for suspicious patterns
};

/**
 * Session management middleware (for future session-based auth)
 */
export const sessionManagement = async (req, res, next) => {
  try {
    // This is a placeholder for session-based authentication
    // Currently using JWT tokens, but could be extended for sessions
    
    next();
  } catch (error) {
    console.error('[Session Management Error]:', error);
    next();
  }
};

/**
 * Token validation utility for WebSocket connections
 */
export const validateWebSocketToken = async (token) => {
  try {
    if (!token) {
      throw new Error('No token provided');
    }
    
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'isekai-development-secret-change-in-production'
    );
    
    const user = await User.findByPk(decoded.id);
    if (!user) {
      throw new Error('User not found');
    }
    
    if (user.character_data?.is_banned) {
      throw new Error('Account banned');
    }
    
    return {
      user,
      decoded,
      isValid: true
    };
  } catch (error) {
    return {
      error: error.message,
      isValid: false
    };
  }
};

// Export all middleware
export default {
  authMiddleware,
  optionalAuthMiddleware,
  requireRole,
  authRateLimit,
  csrfProtection,
  securityHeaders,
  validateRefreshToken,
  logoutMiddleware,
  require2FA,
  ipWhitelist,
  deviceFingerprint,
  sessionManagement,
  validateWebSocketToken
};
