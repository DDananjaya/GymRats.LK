require('dotenv').config();
const { ensureSchema } = require('./db');

ensureSchema()
    .then(() => {
        console.log('Database updated successfully');
        process.exit(0);
    })
    .catch((error) => {
        console.error('Database update failed:', error);
        process.exit(1);
    });
