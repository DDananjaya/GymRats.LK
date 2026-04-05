require("dotenv").config();
const express = require("express");
const cors = require("cors");

const {
    registerRoute,
    loginRoute,
    forgotPasswordRoute,
    authGuard,
} = require("./auth");

const {
    getScheduleRoute,
    saveScheduleRoute,
} = require("./schedules");

const { getLiveListRoute } = require("./live-session");
const { errorHandler } = require("./middleware");

const app = express();

app.use(cors({ origin: "*" }));
app.use(express.json());

// auth
app.post("/api/auth/register", ...registerRoute);
app.post("/api/auth/login", ...loginRoute);
app.post("/api/auth/forgot-password", ...forgotPasswordRoute);

// schedules
app.get("/api/schedules", authGuard, getScheduleRoute);
app.post("/api/schedules", authGuard, saveScheduleRoute);

// live session
app.get("/api/live-session", authGuard, getLiveListRoute);

// health
app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
});

app.use(errorHandler);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});