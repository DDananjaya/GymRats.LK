const db = require("./db");
const { asyncHandler } = require("./middleware");

async function getLiveList(req, res) {
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
            exercises: exercisesResult.rows
        });
    }

    res.json({ days });
}

module.exports = {
    getLiveListRoute: asyncHandler(getLiveList),
};