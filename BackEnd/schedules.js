const db = require("./db");
const { asyncHandler } = require("./middleware");

async function getSchedule(req, res) {
  const userId = req.userId;

  const daysResult = await db.execute({
    sql: `SELECT id, day_name FROM schedules WHERE user_id = ? ORDER BY id`,
    args: [userId],
  });

  const result = [];

  for (const day of daysResult.rows) {
    const exercisesResult = await db.execute({
      sql: `SELECT id, name, sets, reps, type FROM exercises WHERE schedule_id = ? ORDER BY position, id`,
      args: [day.id],
    });

    result.push({
      id: day.id,
      day_name: day.day_name,
      exercises: exercisesResult.rows,
    });
  }

  res.json({ days: result });
}

async function saveSchedule(req, res) {
  const userId = req.userId;
  const { days } = req.body;

  if (!Array.isArray(days)) {
    return res.status(400).json({ error: "days must be an array" });
  }

  await db.execute({
    sql: `DELETE FROM exercises WHERE schedule_id IN (SELECT id FROM schedules WHERE user_id = ?)`,
    args: [userId],
  });

  await db.execute({
    sql: `DELETE FROM schedules WHERE user_id = ?`,
    args: [userId],
  });

  for (const day of days) {
    const dayName = (day.day_name || "").trim();
    if (!dayName) continue;

    const insertedDay = await db.execute({
      sql: `INSERT INTO schedules (user_id, day_name) VALUES (?, ?)`,
      args: [userId, dayName],
    });

    const scheduleId = insertedDay.lastInsertRowid;

    const exercises = Array.isArray(day.exercises) ? day.exercises : [];
    for (let i = 0; i < exercises.length; i++) {
      const ex = exercises[i];
      await db.execute({
        sql: `INSERT INTO exercises (schedule_id, name, sets, reps, type, position)
              VALUES (?, ?, ?, ?, ?, ?)`,
        args: [
          scheduleId,
          (ex.name || "").trim(),
          ex.sets || "",
          ex.reps || "",
          ex.type || "",
          i,
        ],
      });
    }
  }

  res.json({ message: "Schedule saved successfully" });
}

module.exports = {
  getScheduleRoute: asyncHandler(getSchedule),
  saveScheduleRoute: asyncHandler(saveSchedule),
};