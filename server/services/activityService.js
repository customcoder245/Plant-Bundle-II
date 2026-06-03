const pool = require('../db/pool');

async function logActivity(eventType, description, metadata = {}) {
    try {
        await pool.query(
            'INSERT INTO activity_log (event_type, description, metadata) VALUES ($1, $2, $3)',
            [eventType, description, JSON.stringify(metadata)]
        );
    } catch (error) {
        console.error('Failed to log activity:', error);
    }
}

module.exports = { logActivity };
