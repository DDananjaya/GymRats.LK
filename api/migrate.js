require('dotenv').config();
const { ensureSchema } = require('./db');

async function migrate() {
    try {
        await ensureSchema();
        console.log('Migration complete');
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

migrate();
