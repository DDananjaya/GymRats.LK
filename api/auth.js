const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const { db } = require('./db');
const { asyncHandler } = require('./middleware');

const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret-in-production';

const registerValidators = [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('username').trim().isLength({ min: 3 }).withMessage('Username must be at least 3 characters'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('age').optional({ values: 'falsy' }).isInt({ min: 10, max: 100 }).withMessage('Age must be between 10 and 100'),
    body('gender').optional({ values: 'falsy' }).isIn(['male', 'female']).withMessage('Gender must be male or female'),
    body('gym_id').optional({ values: 'falsy' }).trim(),
];

const loginValidators = [
    body('username').trim().notEmpty().withMessage('Username is required'),
    body('password').notEmpty().withMessage('Password is required'),
];

const forgotPasswordValidators = [
    body('username').trim().notEmpty().withMessage('Username is required'),
    body('gym_id').trim().notEmpty().withMessage('Gym ID is required'),
    body('new_password').isLength({ min: 6 }).withMessage('New password must be at least 6 characters'),
];

function failIfInvalid(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.status(400).json({ error: errors.array()[0].msg });
        return true;
    }
    return false;
}

async function register(req, res) {
    if (failIfInvalid(req, res)) return;

    const { name, username, password, age, gender, gym_id } = req.body;
    const passwordHash = await bcrypt.hash(password, 10);

    await db.execute({
        sql: `
      INSERT INTO users (name, username, password_hash, age, gender, gym_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `,
        args: [name.trim(), username.trim(), passwordHash, age || null, gender || null, gym_id?.trim() || null],
    });

    res.status(201).json({ message: 'Registered successfully' });
}

async function login(req, res) {
    if (failIfInvalid(req, res)) return;

    const { username, password } = req.body;
    const result = await db.execute({
        sql: 'SELECT id, name, username, gender, password_hash FROM users WHERE username = ?',
        args: [username.trim()],
    });

    if (result.rows.length === 0) {
        return res.status(401).json({ error: 'Invalid username or password' });
    }

    const user = result.rows[0];
    const passwordHash = user.password_hash || user.passwordHash;
    const isValid = await bcrypt.compare(password, passwordHash);

    if (!isValid) {
        return res.status(401).json({ error: 'Invalid username or password' });
    }

    const token = jwt.sign({ sub: Number(user.id) }, JWT_SECRET, { expiresIn: '12h' });

    res.json({
        token,
        user: {
            id: Number(user.id),
            name: user.name,
            username: user.username,
            gender: user.gender || null,
        },
    });
}

async function forgotPassword(req, res) {
    if (failIfInvalid(req, res)) return;

    const { username, gym_id, new_password } = req.body;

    const result = await db.execute({
        sql: 'SELECT id FROM users WHERE username = ? AND gym_id = ?',
        args: [username.trim(), gym_id.trim()],
    });

    if (result.rows.length === 0) {
        return res.status(404).json({ error: 'User not found for that username and Gym ID' });
    }

    const passwordHash = await bcrypt.hash(new_password, 10);

    await db.execute({
        sql: 'UPDATE users SET password_hash = ? WHERE id = ?',
        args: [passwordHash, Number(result.rows[0].id)],
    });

    res.json({ message: 'Password updated successfully' });
}

function authGuard(req, res, next) {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';

    if (!token) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        const payload = jwt.verify(token, JWT_SECRET);
        req.userId = Number(payload.sub);
        next();
    } catch (error) {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
}

module.exports = {
    registerRoute: [...registerValidators, asyncHandler(register)],
    loginRoute: [...loginValidators, asyncHandler(login)],
    forgotPasswordRoute: [...forgotPasswordValidators, asyncHandler(forgotPassword)],
    authGuard,
};
