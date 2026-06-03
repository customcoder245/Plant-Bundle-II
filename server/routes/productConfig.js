const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { logActivity } = require('../services/activityService');

router.get('/', async (req, res) => {
    try {
        const result = await pool.query(`
      SELECT ppc.*,
        json_agg(json_build_object('id', sm.id, 'shopify_variant_id', sm.shopify_variant_id, 'variant_title', sm.variant_title, 'pot_size', sm.pot_size)) FILTER (WHERE sm.id IS NOT NULL) as size_mappings
      FROM product_pot_config ppc
      LEFT JOIN size_mappings sm ON ppc.id = sm.product_config_id
      GROUP BY ppc.id
      ORDER BY ppc.created_at DESC
    `);
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/:shopifyProductId', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM product_pot_config WHERE shopify_product_id = $1', [req.params.shopifyProductId]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Product config not found' });
        const mappings = await pool.query('SELECT * FROM size_mappings WHERE product_config_id = $1', [result.rows[0].id]);
        res.json({ ...result.rows[0], size_mappings: mappings.rows });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/', async (req, res) => {
    const { shopify_product_id, product_title, no_pot_discount, size_mappings } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const configResult = await client.query(
            `INSERT INTO product_pot_config (shopify_product_id, product_title, no_pot_discount) VALUES ($1, $2, $3) ON CONFLICT (shopify_product_id) DO UPDATE SET product_title = EXCLUDED.product_title, no_pot_discount = EXCLUDED.no_pot_discount, updated_at = CURRENT_TIMESTAMP RETURNING *`,
            [shopify_product_id, product_title, no_pot_discount || 10.00]
        );
        const configId = configResult.rows[0].id;
        await client.query('DELETE FROM size_mappings WHERE product_config_id = $1', [configId]);
        if (size_mappings && size_mappings.length > 0) {
            for (const mapping of size_mappings) {
                await client.query(
                    `INSERT INTO size_mappings (product_config_id, shopify_variant_id, variant_title, pot_size) VALUES ($1, $2, $3, $4)`,
                    [configId, mapping.shopify_variant_id, mapping.variant_title, mapping.pot_size]
                );
            }
        }
        await client.query('COMMIT');

        // NEW: Add to Collection
        const collectionId = process.env.SHOPIFY_COLLECTION_ID || 320337641590;
        const shop = process.env.SHOPIFY_STORE_DOMAIN;
        const accessToken = process.env.ADMIN_API || process.env.SHOPIFY_ACCESS_TOKEN;
        if (accessToken) {
            try {
                await fetch(`https://${shop}/admin/api/2023-10/collects.json`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Shopify-Access-Token': accessToken,
                    },
                    body: JSON.stringify({
                        collect: {
                            collection_id: collectionId,
                            product_id: shopify_product_id
                        }
                    })
                });
            } catch (err) {
                console.error('Failed to add existing product to collection:', err.message);
            }
        }

        await logActivity('PRODUCT_CONFIGURED', `Configured product: ${product_title}`, { shopify_product_id });
        res.json(configResult.rows[0]);
    } catch (error) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: error.message });
    } finally {
        client.release();
    }
});

router.put('/:id/toggle', async (req, res) => {
    const { id } = req.params;
    const shop = process.env.SHOPIFY_STORE_DOMAIN;
    const accessToken = process.env.ADMIN_API || process.env.SHOPIFY_ACCESS_TOKEN;

    try {
        // 1. Toggle DB state first
        const result = await pool.query(
            `UPDATE product_pot_config SET is_enabled = NOT is_enabled, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *`,
            [id]
        );

        const config = result.rows[0];
        const isEnabled = config.is_enabled;
        const shopifyProductId = config.shopify_product_id;

        // 2. Sync status to Shopify
        if (accessToken) {
            console.log(`Syncing status for ${shopifyProductId} to ${isEnabled ? 'ACTIVE' : 'DRAFT'}...`);

            await fetch(`https://${shop}/admin/api/2023-10/products/${shopifyProductId}.json`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Shopify-Access-Token': accessToken
                },
                body: JSON.stringify({
                    product: {
                        id: shopifyProductId,
                        status: isEnabled ? 'active' : 'draft'
                    }
                })
            });
        }

        await logActivity('PRODUCT_TOGGLED', `Toggled product ID ${id}. New Shopify status: ${isEnabled ? 'active' : 'draft'}`, { config_id: id, is_enabled: isEnabled });
        res.json(config);
    } catch (error) {
        console.error('Toggle Sync failed:', error);
        res.status(500).json({ error: error.message });
    }
});

router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    const shop = process.env.SHOPIFY_STORE_DOMAIN;
    const accessToken = process.env.ADMIN_API || process.env.SHOPIFY_ACCESS_TOKEN;

    try {
        // 1. Find the Shopify ID from our DB first
        const config = await pool.query('SELECT shopify_product_id FROM product_pot_config WHERE id = $1', [id]);

        if (config.rows.length > 0 && accessToken) {
            const shopifyProductId = config.rows[0].shopify_product_id;
            console.log(`Deep-Deleting product ${shopifyProductId} from Shopify...`);

            // 2. Delete from Shopify API
            await fetch(`https://${shop}/admin/api/2023-10/products/${shopifyProductId}.json`, {
                method: 'DELETE',
                headers: { 'X-Shopify-Access-Token': accessToken }
            });
        }

        // 3. Delete from our DB
        await pool.query('DELETE FROM product_pot_config WHERE id = $1', [id]);
        await logActivity('PRODUCT_CONFIG_DELETED', `Deleted product config and Shopify product for ID: ${id}`, { config_id: id });

        res.json({ success: true });
    } catch (error) {
        console.error('Delete sync failed:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
