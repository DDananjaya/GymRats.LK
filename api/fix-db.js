require('dotenv').config();
const { ensureSchema } = require('./db');

ensureSchema()
    .then(() => {
        console.log('Database checked and fixed successfully');
        process.exit(0);
    })
    .catch((error) => {
        console.error('Database fix failed:', error);
        process.exit(1);
    });
