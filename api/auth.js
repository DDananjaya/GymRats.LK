const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { body, validationResult } = require("express-validator");
const db = require("./db");
const { asyncHandler } = require("./middleware");

const JWT_SECRET = process.env.JWT_SECRET || "gymrats_secret_2026";

const registerValidators = [
    body("name").trim().notEmpty().withMessage("Name is required"),
    body("username").trim().notEmpty().withMessage("Username is required"),
    body("password").isLength({ min: 6 }).withMessage("Password must be at least 6 characters"),
    body("gym_id").trim().notEmpty().withMessage("Gym ID is required"),
];

function validate(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.status(400).json({ error: errors.array()[0].msg });
        return true;
    }
    return false;
}

async function register(req, res) {
    if (validate(req, res)) return;

    const { name, username, password, age, gender, gym_id } = req.body;
    const passwordHash = await bcrypt.hash(password, 10);

    await db.execute({
        sql: `
      INSERT INTO users (name, username, password_hash, age, gender, gym_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `,
        args: [
            name.trim(),
            username.trim(),
            passwordHash,
            age ? Number(age) : null,
            gender || null,
            gym_id.trim(),
        ],
    });

    res.status(201).json({ message: "Registered successfully" });
}

async function login(req, res) {
    const username = (req.body.username || "").trim();
    const password = req.body.password || "";

    const result = await db.execute({
        sql: `SELECT * FROM users WHERE username = ? LIMIT 1`,
        args: [username],
    });

    if (result.rows.length === 0) {
        return res.status(401).json({ error: "Invalid username or password" });
    }

    const user = result.rows[0];
    const ok = await bcrypt.compare(password, user.password_hash);

    if (!ok) {
        return res.status(401).json({ error: "Invalid username or password" });
    }

    const token = jwt.sign({ sub: user.id }, JWT_SECRET, { expiresIn: "12h" });

    res.json({
        token,
        user: {
            id: user.id,
            name: user.name,
            username: user.username,
            gender: user.gender,
            gym_id: user.gym_id,
        },
    });
}

async function forgotPassword(req, res) {
    const username = (req.body.username || "").trim();
    const gymId = (req.body.gym_id || "").trim();
    const newPassword = req.body.new_password || "";

    if (!username || !gymId || newPassword.length < 6) {
        return res.status(400).json({ error: "Invalid reset data" });
    }

    const result = await db.execute({
        sql: `SELECT id FROM users WHERE username = ? AND gym_id = ? LIMIT 1`,
        args: [username, gymId],
    });

    if (result.rows.length === 0) {
        return res.status(404).json({ error: "User not found" });
    }

    const hash = await bcrypt.hash(newPassword, 10);

    await db.execute({
        sql: `UPDATE users SET password_hash = ? WHERE id = ?`,
        args: [hash, result.rows[0].id],
    });

    res.json({ message: "Password updated successfully" });
}

function authGuard(req, res, next) {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;

    if (!token) {
        return res.status(401).json({ error: "Unauthorized" });
    }

    try {
        const payload = jwt.verify(token, JWT_SECRET);
        req.userId = payload.sub;
        next();
    } catch (err) {
        return res.status(401).json({ error: "Unauthorized" });
    }
}

module.exports = {
    registerRoute: [...registerValidators, asyncHandler(register)],
    loginRoute: [asyncHandler(login)],
    forgotPasswordRoute: [asyncHandler(forgotPassword)],
    authGuard,
};