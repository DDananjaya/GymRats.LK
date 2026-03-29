const { db } = require('./db');
const { asyncHandler } = require('./middleware');

async function getLiveList(req, res) {
    const result = await db.execute({
        sql: 'SELECT data FROM schedules WHERE user_id = ? LIMIT 1',
        args: [req.userId],
    });

    if (result.rows.length === 0) {
        return res.json({ days: [], exercises: [] });
    }

    const parsed = JSON.parse(result.rows[0].data);
    const days = Array.isArray(parsed.days) ? parsed.days : [];

    const exercises = days.flatMap((day) =>
        (Array.isArray(day.exercises) ? day.exercises : []).map((exercise) => ({
            day: day.day_name,
            name: exercise.name,
            sets: Number.parseInt(exercise.sets, 10) || 0,
            reps: exercise.reps,
            type: exercise.type || 'Strength',
        }))
    );

    res.json({ days, exercises });
}

module.exports = {
    getLiveListRoute: asyncHandler(getLiveList),
};
