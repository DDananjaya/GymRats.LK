const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const { body, validationResult } = require("express-validator");
const db = require("./db");
const { asyncHandler } = require("./middleware");

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";

const registerValidators = [
  body("name").notEmpty().withMessage("Name is required"),
  body("username").notEmpty().withMessage("Username is required"),
  body("password").isLength({ min: 6 }).withMessage("Password must be at least 6 characters"),
  body("gym_id").notEmpty().withMessage("Gym ID is required"),
];

const loginValidators = [
  body("username").notEmpty().withMessage("Username is required"),
  body("password").notEmpty().withMessage("Password is required"),
];

function validate(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg });
  }
  return null;
}

async function register(req, res) {
  const invalid = validate(req, res);
  if (invalid) return;

  const { name, username, password, age, gender, gym_id } = req.body;
  const hash = await bcrypt.hash(password, 10);

  await db.execute({
    sql: `INSERT INTO users (name, username, password_hash, age, gender, gym_id)
          VALUES (?, ?, ?, ?, ?, ?)`,
    args: [name, username, hash, age || null, gender || null, gym_id],
  });

  res.status(201).json({ message: "Registered successfully" });
}

async function login(req, res) {
  const invalid = validate(req, res);
  if (invalid) return;

  const { username, password } = req.body;

  const result = await db.execute({
    sql: `SELECT * FROM users WHERE username = ?`,
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
  res.json({ token });
}

async function forgotPassword(req, res) {
  const { username, gym_id, new_password } = req.body;

  if (!username || !gym_id || !new_password) {
    return res.status(400).json({ error: "Username, Gym ID, and new password are required" });
  }

  const result = await db.execute({
    sql: `SELECT * FROM users WHERE username = ? AND gym_id = ?`,
    args: [username, gym_id],
  });

  if (result.rows.length === 0) {
    return res.status(404).json({ error: "User not found with provided Gym ID" });
  }

  const user = result.rows[0];
  const hash = await bcrypt.hash(new_password, 10);

  await db.execute({
    sql: `UPDATE users SET password_hash = ? WHERE id = ?`,
    args: [hash, user.id],
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
  } catch {
    return res.status(401).json({ error: "Unauthorized" });
  }
}

module.exports = {
  registerRoute: [asyncHandler(register)],
  loginRoute: [asyncHandler(login)],
  forgotPasswordRoute: [asyncHandler(forgotPassword)],
  authGuard,
};