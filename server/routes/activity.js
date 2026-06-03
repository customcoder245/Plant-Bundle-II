const express = require('express');
const router = express.Router();
const pool = require('../db/pool');

router.get('/', async (req, res) => {
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    const eventType = req.query.event_type;
    try {
        let query = 'SELECT * FROM activity_log';
        const params = [];
        if (eventType) {
            query += ' WHERE event_type = $1';
            params.push(eventType);
        }
        query += ' ORDER BY created_at DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
        params.push(limit, offset);
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/stats', async (req, res) => {
    try {
        const result = await pool.query(`
      SELECT event_type, COUNT(*) as count, MAX(created_at) as last_occurrence
      FROM activity_log WHERE created_at > NOW() - INTERVAL '7 days'
      GROUP BY event_type ORDER BY count DESC
    `);
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
