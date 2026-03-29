const db = require("./db");
const { asyncHandler } = require("./middleware");

async function saveSchedule(req, res) {
    const { days } = req.body;
    const userId = req.userId; // Provided by your authGuard middleware

    if (!days) return res.status(400).json({ error: "No workout data provided" });

    try {
        // 1. Remove any existing schedule for this user to prevent 409 Conflict
        await db.execute({
            sql: "DELETE FROM schedules WHERE user_id = ?",
            args: [userId]
        });

        // 2. Insert the new schedule as a JSON string into the 'data' column
        await db.execute({
            sql: "INSERT INTO schedules (user_id, data) VALUES (?, ?)",
            args: [userId, JSON.stringify({ days })]
        });

        res.json({ message: "Schedule saved successfully! ✅" });
    } catch (err) {
        console.error("Database Error:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
}

async function getSchedule(req, res) {
    try {
        const result = await db.execute({
            sql: "SELECT data FROM schedules WHERE user_id = ? LIMIT 1",
            args: [req.userId]
        });

        if (result.rows.length === 0) {
            return res.json({ days: [] });
        }

        // Parse the JSON string back into an object for the frontend
        const scheduleData = JSON.parse(result.rows[0].data);
        res.json(scheduleData);
    } catch (err) {
        res.status(500).json({ error: "Failed to load schedule" });
    }
}

module.exports = {
    saveScheduleRoute: asyncHandler(saveSchedule),
    getScheduleRoute: asyncHandler(getSchedule)
};