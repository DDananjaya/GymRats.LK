function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

function errorHandler(err, req, res, next) {
  console.error("Error:", err);

  if (err.code === "SQLITE_CONSTRAINT") {
    return res.status(409).json({
      error: "Username or Gym ID already exists",
    });
  }

  if (err.message && err.message.includes("not found")) {
    return res.status(404).json({ error: err.message });
  }

  res.status(err.status || 500).json({
    error: err.message || "Internal Server Error",
  });
}

module.exports = { asyncHandler, errorHandler };