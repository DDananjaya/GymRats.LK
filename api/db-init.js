require('dotenv').config();
const { ensureSchema } = require('./db');

async function init() {
    try {
        await ensureSchema();
        console.log('Database initialized successfully');
        process.exit(0);
    } catch (error) {
        console.error('Database init failed:', error);
        process.exit(1);
    }
}

init();
