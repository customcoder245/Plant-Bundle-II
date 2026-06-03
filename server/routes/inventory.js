const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { logActivity } = require('../services/activityService');
const inventoryService = require('../services/inventoryService');

// POST /api/inventory/sync-pots - Manually sync pot inventories from Shopify
router.post('/sync-pots', async (req, res) => {
    try {
        const result = await inventoryService.syncPotsFromShopify();
        await logActivity('SHOPIFY_POTS_SYNC', `Synced pots from Shopify. Updated ${result.updatedCount} items.`, { count: result.updatedCount });
        res.json(result);
    } catch (error) {
        console.error('Failed to sync pots from Shopify:', error);
        res.status(500).json({ error: error.message });
    }
});

router.get('/', async (req, res) => {
    try {
        const result = await pool.query(`
      SELECT pi.id, pi.size, pi.quantity, pi.low_stock_threshold,
        pc.id as color_id, pc.name as color_name, pc.hex_code,
        CASE WHEN pi.quantity <= pi.low_stock_threshold THEN true ELSE false END as is_low_stock
      FROM pot_inventory pi
      JOIN pot_colors pc ON pi.pot_color_id = pc.id
      WHERE pc.is_active = true
      ORDER BY pc.display_order, pi.size
    `);
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/color/:colorId', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM pot_inventory WHERE pot_color_id = $1 ORDER BY size', [req.params.colorId]);
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const { quantity, low_stock_threshold } = req.body;
    try {
        const result = await pool.query(
            `UPDATE pot_inventory SET quantity = COALESCE($1, quantity), low_stock_threshold = COALESCE($2, low_stock_threshold), updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING *`,
            [quantity, low_stock_threshold, id]
        );
        if (result.rows.length > 0) {
            const updated = result.rows[0];
            // Sync to Shopify in background
            inventoryService.syncPotInventoryToShopify(updated.pot_color_id, updated.size, updated.quantity).catch(err =>
                console.error(`Failed to sync pot ${updated.id} to Shopify after update:`, err)
            );
        }
        await logActivity('INVENTORY_UPDATED', `Updated inventory ID ${id} to quantity: ${quantity}`, { inventory_id: id, quantity });
        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/bulk-update', async (req, res) => {
    const { updates } = req.body;
    try {
        for (const update of updates) {
            const result = await pool.query(
                'UPDATE pot_inventory SET quantity = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
                [update.quantity, update.id]
            );
            if (result.rows.length > 0) {
                const updated = result.rows[0];
                // Sync to Shopify in background
                inventoryService.syncPotInventoryToShopify(updated.pot_color_id, updated.size, updated.quantity).catch(err =>
                    console.error(`Failed to sync pot ${updated.id} to Shopify after bulk update:`, err)
                );
            }
        }
        await logActivity('INVENTORY_BULK_UPDATE', `Bulk updated ${updates.length} inventory items`, { count: updates.length });
        res.json({ success: true, updated: updates.length });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/deduct', async (req, res) => {
    const { pot_color_id, size, quantity = 1 } = req.body;
    try {
        const result = await pool.query(
            `UPDATE pot_inventory SET quantity = GREATEST(0, quantity - $1), updated_at = CURRENT_TIMESTAMP WHERE pot_color_id = $2 AND size = $3 RETURNING *`,
            [quantity, pot_color_id, size]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Inventory record not found' });
        
        // Sync to Shopify in background
        inventoryService.syncPotInventoryToShopify(pot_color_id, size, result.rows[0].quantity).catch(err =>
            console.error('Failed to sync Shopify after deduct:', err)
        );

        await logActivity('INVENTORY_DEDUCTED', `Deducted ${quantity} from color ${pot_color_id}, size ${size}`, { pot_color_id, size, quantity });
        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/restore', async (req, res) => {
    const { pot_color_id, size, quantity = 1 } = req.body;
    try {
        const result = await pool.query(
            `UPDATE pot_inventory SET quantity = quantity + $1, updated_at = CURRENT_TIMESTAMP WHERE pot_color_id = $2 AND size = $3 RETURNING *`,
            [quantity, pot_color_id, size]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Inventory record not found' });

        // Sync to Shopify in background
        inventoryService.syncPotInventoryToShopify(pot_color_id, size, result.rows[0].quantity).catch(err =>
            console.error('Failed to sync Shopify after restore:', err)
        );

        await logActivity('INVENTORY_RESTORED', `Restored ${quantity} to color ${pot_color_id}, size ${size}`, { pot_color_id, size, quantity });
        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
