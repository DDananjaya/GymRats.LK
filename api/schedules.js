const db = require("./db");
const { asyncHandler } = require("./middleware");

async function saveSchedule(req, res) {
    const { days } = req.body;
    const userId = req.userId;

    if (!Array.isArray(days) || days.length === 0) {
        return res.status(400).json({ error: "No workout data provided" });
    }

    try {
        const oldSchedules = await db.execute({
            sql: "SELECT id FROM schedules WHERE user_id = ?",
            args: [userId]
        });

        for (const row of oldSchedules.rows) {
            await db.execute({
                sql: "DELETE FROM exercises WHERE schedule_id = ?",
                args: [row.id]
            });
        }

        await db.execute({
            sql: "DELETE FROM schedules WHERE user_id = ?",
            args: [userId]
        });

        for (let i = 0; i < days.length; i++) {
            const day = days[i];
            const dayName = String(day.day_name || "").trim();

            if (!dayName) continue;

            await db.execute({
                sql: "INSERT INTO schedules (user_id, day_name) VALUES (?, ?)",
                args: [userId, dayName]
            });

            const inserted = await db.execute({
                sql: "SELECT id FROM schedules WHERE user_id = ? AND day_name = ? ORDER BY id DESC LIMIT 1",
                args: [userId, dayName]
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
                        ex.reps || null,
                        ex.type || "Strength",
                        j + 1
                    ]
                });
            }
        }

        res.json({ message: "Schedule saved successfully! ✅" });
    } catch (err) {
        console.error("Database Error:", err);
        res.status(500).json({ error: err.message || "Failed to save schedule" });
    }
}

async function getSchedule(req, res) {
    try {
        const scheduleRows = await db.execute({
            sql: "SELECT id, day_name FROM schedules WHERE user_id = ? ORDER BY id",
            args: [req.userId]
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
                args: [row.id]
            });

            days.push({
                day_name: row.day_name,
                exercises: exerciseRows.rows.map(ex => ({
                    name: ex.name,
                    sets: ex.sets,
                    reps: ex.reps,
                    type: ex.type
                }))
            });
        }

        res.json({ days });
    } catch (err) {
        console.error("Load Schedule Error:", err);
        res.status(500).json({ error: err.message || "Failed to load schedule" });
    }
}

module.exports = {
    saveScheduleRoute: asyncHandler(saveSchedule),
    getScheduleRoute: asyncHandler(getSchedule)
};