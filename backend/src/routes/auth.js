import express from 'express';
import jwt from 'jsonwebtoken';
import { body, validationResult } from 'express-validator';
import User from '../models/User.js';

const router = express.Router();

// Validation middleware
const validateRegister = [
  body('username')
    .isLength({ min: 3, max: 50 })
    .withMessage('Username must be 3-50 characters')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username can only contain letters, numbers, and underscores'),
  body('email')
    .isEmail()
    .withMessage('Must be a valid email address')
    .normalizeEmail(),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain uppercase, lowercase, and numbers')
];

const validateLogin = [
  body('identifier')
    .notEmpty()
    .withMessage('Username or email is required'),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
];

// Generate JWT token
const generateToken = (user) => {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      email: user.email
    },
    process.env.JWT_SECRET || 'isekai-development-secret',
    { expiresIn: '7d' }
  );
};

// Register route
router.post('/register', validateRegister, async (req, res, next) => {
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: {
          type: 'VALIDATION_ERROR',
          messages: errors.array()
        }
      });
    }

    const { username, email, password } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({
      where: {
        [Sequelize.Op.or]: [
          { username },
          { email }
        ]
      }
    });

    if (existingUser) {
      return res.status(409).json({
        error: {
          type: 'USER_EXISTS',
          message: 'Username or email already registered'
        }
      });
    }

    // Create new user
    const user = await User.create({
      username,
      email,
      password_hash: password // Will be hashed by model hook
    });

    // Generate token
    const token = generateToken(user);

    // Return user data (without password hash)
    res.status(201).json({
      message: 'User registered successfully',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        character_data: user.character_data
      },
      token,
      expires_in: 604800 // 7 days in seconds
    });

  } catch (error) {
    next(error);
  }
});

// Login route
router.post('/login', validateLogin, async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: {
          type: 'VALIDATION_ERROR',
          messages: errors.array()
        }
      });
    }

    const { identifier, password } = req.body;

    // Find user by username or email
    const user = await User.findByUsernameOrEmail(identifier);
    
    if (!user) {
      return res.status(401).json({
        error: {
          type: 'INVALID_CREDENTIALS',
          message: 'Invalid username/email or password'
        }
      });
    }

    // Verify password
    const isValidPassword = await user.verifyPassword(password);
    if (!isValidPassword) {
      return res.status(401).json({
        error: {
          type: 'INVALID_CREDENTIALS',
          message: 'Invalid username/email or password'
        }
      });
    }

    // Update last login
    user.character_data.last_login = new Date().toISOString();
    await user.save();

    // Generate token
    const token = generateToken(user);

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        character_data: user.character_data
      },
      token,
      expires_in: 604800
    });

  } catch (error) {
    next(error);
  }
});

// Logout route (client-side token destruction)
router.post('/logout', (req, res) => {
  res.json({
    message: 'Logout successful. Destroy token on client.'
  });
});

// Token refresh route
router.post('/refresh', async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: {
          type: 'NO_TOKEN',
          message: 'No token provided'
        }
      });
    }

    const token = authHeader.split(' ')[1];
    
    // Verify token
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'isekai-development-secret',
      { ignoreExpiration: true } // Allow expired tokens for refresh
    );

    // Find user
    const user = await User.findByPk(decoded.id);
    if (!user) {
      return res.status(401).json({
        error: {
          type: 'USER_NOT_FOUND',
          message: 'User no longer exists'
        }
      });
    }

    // Generate new token
    const newToken = generateToken(user);

    res.json({
      message: 'Token refreshed',
      token: newToken,
      expires_in: 604800
    });

  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        error: {
          type: 'INVALID_TOKEN',
          message: 'Invalid token'
        }
      });
    }
    next(error);
  }
});

// Password reset request
router.post('/password-reset-request', async (req, res, next) => {
  try {
    const { email } = req.body;
    
    const user = await User.findOne({ where: { email } });
    if (!user) {
      // Don't reveal if email exists for security
      return res.json({
        message: 'If an account exists with this email, a reset link has been sent'
      });
    }

    // Generate reset token (valid for 1 hour)
    const resetToken = jwt.sign(
      { id: user.id, type: 'password_reset' },
      process.env.JWT_SECRET || 'isekai-development-secret',
      { expiresIn: '1h' }
    );

    // In production: Send email with reset link
    // For now, return token (in production, this would be emailed)
    res.json({
      message: 'Password reset token generated',
      reset_token: resetToken, // Only for development!
      expires_in: 3600
    });

  } catch (error) {
    next(error);
  }
});

// Password reset confirmation
router.post('/password-reset-confirm', async (req, res, next) => {
  try {
    const { token, new_password } = req.body;

    // Verify reset token
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'isekai-development-secret'
    );

    if (decoded.type !== 'password_reset') {
      return res.status(401).json({
        error: {
          type: 'INVALID_TOKEN_TYPE',
          message: 'Invalid token type'
        }
      });
    }

    // Find user and update password
    const user = await User.findByPk(decoded.id);
    if (!user) {
      return res.status(404).json({
        error: {
          type: 'USER_NOT_FOUND',
          message: 'User not found'
        }
      });
    }

    user.password_hash = new_password; // Will be hashed by hook
    await user.save();

    res.json({
      message: 'Password updated successfully'
    });

  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: {
          type: 'INVALID_TOKEN',
          message: 'Invalid or expired reset token'
        }
      });
    }
    next(error);
  }
});

export default router;
