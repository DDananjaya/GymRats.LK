function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

function errorHandler(err, req, res, next) {
  console.error("Error:", err);

  const message = err?.message || "Internal Server Error";

  if (
    message.includes("UNIQUE constraint failed") ||
    message.includes("SQLITE_CONSTRAINT") ||
    err.code === "SQLITE_CONSTRAINT"
  ) {
    return res.status(409).json({
      error: "Username or Gym ID already exists",
    });
  }

  if (message.toLowerCase().includes("unauthorized")) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  res.status(err.status || 500).json({ error: message });
}

module.exports = { asyncHandler, errorHandler };
