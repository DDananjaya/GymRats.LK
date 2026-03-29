function asyncHandler(fn) {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}

function errorHandler(err, req, res, next) {
    console.error(err);

    const message = err?.message || 'Internal Server Error';

    if (message.includes('UNIQUE constraint failed') || err?.code === 'SQLITE_CONSTRAINT') {
        return res.status(409).json({ error: 'Username or Gym ID already exists' });
    }

    if (err?.status) {
        return res.status(err.status).json({ error: message });
    }

    return res.status(500).json({ error: message });
}

module.exports = {
    asyncHandler,
    errorHandler,
};
