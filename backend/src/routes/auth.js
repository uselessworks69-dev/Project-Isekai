import express from 'express';
import jwt from 'jsonwebtoken';
import { body, validationResult } from 'express-validator';
import { Sequelize } from 'sequelize';
import User from '../models/User.js';

const router = express.Router();

/* ---------------- BASE ROUTE (SANITY CHECK) ---------------- */
router.get('/', (req, res) => {
  res.json({
    status: 'Auth routes online',
    routes: [
      'POST /login',
      'POST /register',
      'POST /logout',
      'POST /refresh',
      'POST /password-reset-request',
      'POST /password-reset-confirm'
    ]
  });
});

/* ---------------- VALIDATION ---------------- */

const validateRegister = [
  body('username')
    .isLength({ min: 3, max: 50 })
    .matches(/^[a-zA-Z0-9_]+$/),
  body('email').isEmail().normalizeEmail(),
  body('password')
    .isLength({ min: 8 })
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
];

const validateLogin = [
  body('identifier').notEmpty(),
  body('password').notEmpty()
];

/* ---------------- JWT ---------------- */

const generateToken = (user) =>
  jwt.sign(
    { id: user.id, username: user.username, email: user.email },
    process.env.JWT_SECRET || 'isekai-development-secret',
    { expiresIn: '7d' }
  );

/* ---------------- REGISTER ---------------- */

router.post('/register', validateRegister, async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array() });
    }

    const { username, email, password } = req.body;

    const existingUser = await User.findOne({
      where: {
        [Sequelize.Op.or]: [{ username }, { email }]
      }
    });

    if (existingUser) {
      return res.status(409).json({
        error: { message: 'Username or email already registered' }
      });
    }

    const user = await User.create({
      username,
      email,
      password_hash: password
    });

    const token = generateToken(user);

    res.status(201).json({
      message: 'User registered successfully',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        character_data: user.character_data
      },
      token,
      expires_in: 604800
    });
  } catch (err) {
    next(err);
  }
});

/* ---------------- LOGIN ---------------- */

router.post('/login', validateLogin, async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array() });
    }

    const { identifier, password } = req.body;

    const user = await User.findByUsernameOrEmail(identifier);
    if (!user || !(await user.verifyPassword(password))) {
      return res.status(401).json({
        error: { message: 'Invalid credentials' }
      });
    }

    user.character_data.last_login = new Date().toISOString();
    await user.save();

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
  } catch (err) {
    next(err);
  }
});

/* ---------------- LOGOUT ---------------- */

router.post('/logout', (req, res) => {
  res.json({ message: 'Logout successful' });
});

export default router;
