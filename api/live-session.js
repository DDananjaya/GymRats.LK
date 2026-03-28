const db = require("./db");
const { asyncHandler } = require("./middleware");

async function getLiveList(req, res) {
  const userId = req.userId;

  const daysResult = await db.execute({
    sql: `SELECT id, day_name FROM schedules WHERE user_id = ? ORDER BY id`,
    args: [userId],
  });

  const live = [];

  for (const day of daysResult.rows) {
    const exercisesResult = await db.execute({
      sql: `SELECT name, sets, reps, type FROM exercises WHERE schedule_id = ? ORDER BY position, id`,
      args: [day.id],
    });

    exercisesResult.rows.forEach((ex) => {
      live.push({
        day: day.day_name,
        ...ex,
      });
    });
  }

  res.json({ exercises: live });
}

module.exports = {
  getLiveListRoute: asyncHandler(getLiveList),
};