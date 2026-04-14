const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { body, validationResult } = require("express-validator");
const { createClient } = require("@libsql/client");

const app = express();

const db = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
});

const JWT_SECRET = process.env.JWT_SECRET;

if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN || !JWT_SECRET) {
    throw new Error("Missing required environment variables");
}

app.use(cors({ origin: true }));
app.use(express.json());

function asyncHandler(fn) {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}

function validate(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.status(400).json({ error: errors.array()[0].msg });
        return true;
    }
    return false;
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

const registerValidators = [
    body("name").trim().notEmpty().withMessage("Name is required"),
    body("username").trim().notEmpty().withMessage("Username is required"),
    body("password").isLength({ min: 6 }).withMessage("Password must be at least 6 characters"),
    body("gym_id").trim().notEmpty().withMessage("Gym ID is required"),
];

app.get("/api/health", asyncHandler(async (req, res) => {
    await db.execute("SELECT 1");
    res.json({ status: "ok" });
}));

app.post("/api/auth/register", ...[
    ...registerValidators,
    asyncHandler(async (req, res) => {
        if (validate(req, res)) return;

        const { name, username, password, age, gender, gym_id } = req.body;
        const passwordHash = await bcrypt.hash(password, 10);

        await db.execute({
            sql: `
        INSERT INTO users (name, username, password_hash, age, gender, gym_id)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
            args: [
                String(name).trim(),
                String(username).trim(),
                passwordHash,
                age ? Number(age) : null,
                gender || null,
                String(gym_id).trim(),
            ],
        });

        res.status(201).json({ message: "Registered successfully" });
    }),
]);

app.post("/api/auth/login", asyncHandler(async (req, res) => {
    const username = String(req.body.username || "").trim();
    const password = String(req.body.password || "");

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
}));

app.post("/api/auth/forgot-password", asyncHandler(async (req, res) => {
    const username = String(req.body.username || "").trim();
    const gymId = String(req.body.gym_id || "").trim();
    const newPassword = String(req.body.new_password || "");

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
}));

app.get("/api/schedules", authGuard, asyncHandler(async (req, res) => {
    const scheduleRows = await db.execute({
        sql: "SELECT id, day_name FROM schedules WHERE user_id = ? ORDER BY id",
        args: [req.userId],
    });

    const days = [];

    for (const row of scheduleRows.rows) {
        const exerciseRows = await db.execute({
            sql: `
        SELECT name, sets, reps, type, position
        FROM exercises
        WHERE schedule_id = ?
        ORDER BY position, id
      `,
            args: [row.id],
        });

        days.push({
            day_name: row.day_name,
            exercises: exerciseRows.rows.map((ex) => ({
                name: ex.name,
                sets: ex.sets,
                reps: ex.reps,
                type: ex.type,
            })),
        });
    }

    res.json({ days });
}));

app.post("/api/schedules", authGuard, asyncHandler(async (req, res) => {
    const { days } = req.body;
    const userId = req.userId;

    if (!Array.isArray(days) || days.length === 0) {
        return res.status(400).json({ error: "No workout data provided" });
    }

    const oldSchedules = await db.execute({
        sql: "SELECT id FROM schedules WHERE user_id = ?",
        args: [userId],
    });

    for (const row of oldSchedules.rows) {
        await db.execute({
            sql: "DELETE FROM exercises WHERE schedule_id = ?",
            args: [row.id],
        });
    }

    await db.execute({
        sql: "DELETE FROM schedules WHERE user_id = ?",
        args: [userId],
    });

    for (let i = 0; i < days.length; i++) {
        const day = days[i];
        const dayName = String(day.day_name || "").trim();

        if (!dayName) continue;

        await db.execute({
            sql: "INSERT INTO schedules (user_id, day_name) VALUES (?, ?)",
            args: [userId, dayName],
        });

        const inserted = await db.execute({
            sql: "SELECT id FROM schedules WHERE user_id = ? AND day_name = ? ORDER BY id DESC LIMIT 1",
            args: [userId, dayName],
        });

        const scheduleId = inserted.rows[0].id;
        const exercises = Array.isArray(day.exercises) ? day.exercises : [];

        for (let j = 0; j < exercises.length; j++) {
            const ex = exercises[j];
            const name = String(ex.name || "").trim();

            if (!name) continue;

            await db.execute({
                sql: `
          INSERT INTO exercises (schedule_id, name, sets, reps, type, position)
          VALUES (?, ?, ?, ?, ?, ?)
        `,
                args: [
                    scheduleId,
                    name,
                    ex.sets ? Number(ex.sets) : null,
                    ex.reps ? String(ex.reps) : null,
                    ex.type || "Strength",
                    j + 1,
                ],
            });
        }
    }

    res.json({ message: "Schedule saved successfully! ✅" });
}));

app.get("/api/live-session", authGuard, asyncHandler(async (req, res) => {
    const userId = req.userId;

    const daysResult = await db.execute({
        sql: "SELECT id, day_name FROM schedules WHERE user_id = ? ORDER BY id",
        args: [userId],
    });

    const days = [];

    for (const day of daysResult.rows) {
        const exercisesResult = await db.execute({
            sql: `
        SELECT name, sets, reps, type
        FROM exercises
        WHERE schedule_id = ?
        ORDER BY position, id
      `,
            args: [day.id],
        });

        days.push({
            day_name: day.day_name,
            exercises: exercisesResult.rows,
        });
    }

    res.json({ days });
}));

app.use((err, req, res, next) => {
    console.error("Error:", err);

    const message = err?.message || "Internal Server Error";

    if (
        message.includes("UNIQUE constraint failed") ||
        message.includes("SQLITE_CONSTRAINT")
    ) {
        return res.status(409).json({
            error: "Username or Gym ID already exists",
        });
    }

    if (message.toLowerCase().includes("unauthorized")) {
        return res.status(401).json({ error: "Unauthorized" });
    }

    res.status(err.status || 500).json({ error: message });
});

module.exports = app;