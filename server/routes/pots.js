const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { logActivity } = require('../services/activityService');

router.get('/colors', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM pot_colors WHERE is_active = true ORDER BY display_order');
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/colors', async (req, res) => {
    const { name, type, hex_code, display_order, image_url } = req.body;
    try {
        const result = await pool.query(
            `INSERT INTO pot_colors (name, type, hex_code, display_order, image_url) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [name, type, hex_code || '#000', display_order || 0, image_url]
        );

        await logActivity('POT_COLOR_CREATED', `Created pot color: ${name}`, { color_id: result.rows[0].id });
        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.put('/colors/:id', async (req, res) => {
    const { id } = req.params;
    const { name, type, hex_code, display_order, is_active, image_url } = req.body;
    try {
        const result = await pool.query(
            `UPDATE pot_colors SET 
                name = COALESCE($1, name), 
                type = COALESCE($2, type), 
                hex_code = COALESCE($3, hex_code), 
                display_order = COALESCE($4, display_order), 
                is_active = COALESCE($5, is_active), 
                image_url = COALESCE($6, image_url), 
                updated_at = CURRENT_TIMESTAMP 
             WHERE id = $7 RETURNING *`,
            [name || null, type || null, hex_code || null, display_order || null, is_active !== undefined ? is_active : null, image_url || null, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Pot color not found' });
        }

        await logActivity('POT_COLOR_UPDATED', `Updated pot color: ${result.rows[0].name}`, { color_id: id });
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Pot Update Error:', error);
        res.status(500).json({ error: error.message });
    }
});

router.delete('/colors/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM pot_colors WHERE id = $1', [id]);
        await logActivity('POT_COLOR_DELETED', `Deleted pot color ID: ${id}`, { color_id: id });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
