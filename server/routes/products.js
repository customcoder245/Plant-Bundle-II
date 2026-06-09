const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { logActivity } = require('../services/activityService');
const { shopify } = require('../index');

function predictPotSize(optionValue) {
    const shop = (optionValue || '').toLowerCase().trim();
    if (shop.includes('2"') || shop.includes('3"') || shop.includes('4"') || shop.includes('2 inch') || shop.includes('4 inch') || shop.includes('small') || shop.includes('2') || shop.includes('4')) {
        return 'Small';
    }
    if (shop.includes('6"') || shop.includes('6 inch') || shop.includes('medium') || shop.includes('standard') || shop.includes('6')) {
        return 'Medium';
    }
    if (shop.includes('8"') || shop.includes('10"') || shop.includes('8 inch') || shop.includes('10 inch') || shop.includes('large') || shop.includes('8') || shop.includes('10') || shop.includes('gal')) {
        return 'Large';
    }
    if (shop.includes('12"') || shop.includes('14"') || shop.includes('12 inch') || shop.includes('xl') || shop.includes('extra-large') || shop.includes('extra large') || shop.includes('12') || shop.includes('14')) {
        return 'Extra Large';
    }
    return 'Medium';
}

// POST /api/products/create - Create a new plant product in Shopify and configure it
router.post('/create', async (req, res) => {
    const shop = process.env.SHOPIFY_STORE_DOMAIN;
    let accessToken = process.env.ADMIN_API || process.env.SHOPIFY_ACCESS_TOKEN;

    // FALLBACK: If no permanent token is in .env, try to find an active session (for local dev)
    if (!accessToken) {
        try {
            const sessions = await shopify.config.sessionStorage.findSessionsByShop(shop);
            if (sessions && sessions.length > 0) {
                accessToken = sessions[0].accessToken;
                console.log("Using fallover OAuth session token for local development.");
            }
        } catch (e) {
            console.error("Session lookup failed:", e.message);
        }
    }

    if (!accessToken) {
        return res.status(500).json({ error: 'No access token found. Add SHOPIFY_ACCESS_TOKEN to .env or log in through /api/auth.' });
    }

    const { title, description, variants, status, product_type, vendor, tags, no_pot_discount } = req.body;

    try {
        console.log(`Attempting to create product "${title}" on ${shop}...`);

        const productPayload = {
            title,
            body_html: description,
            status: status || 'active',
            product_type: product_type || '',
            vendor: vendor || '',
            tags: Array.isArray(tags) ? tags.join(', ') : tags || ''
        };

        // If multi-option product is sent from front-end
        if (req.body.options && req.body.options.length > 0) {
            productPayload.options = req.body.options;
            productPayload.variants = req.body.variants.map(v => ({
                option1: v.option1,
                option2: v.option2,
                option3: v.option3,
                price: v.price,
                compare_at_price: v.compare_at_price || null,
                inventory_management: v.inventory_management || 'shopify',
                inventory_quantity: parseInt(v.inventory_quantity) || 0,
                sku: v.sku || undefined,
                barcode: v.barcode || undefined,
                weight: v.weight ? parseFloat(v.weight) : undefined,
                weight_unit: v.weight_unit || 'lb'
            }));
        } else {
            // Legacy single-option product support
            productPayload.variants = variants.map(v => ({
                option1: v.title,
                price: v.price
            }));
        }

        const shopifyRes = await fetch(`https://${shop}/admin/api/2023-10/products.json`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Shopify-Access-Token': accessToken,
            },
            body: JSON.stringify({
                product: productPayload,
            }),
        });

        if (!shopifyRes.ok) {
            const errText = await shopifyRes.text();
            console.error('Shopify API Error Response:', errText);
            return res.status(shopifyRes.status).json({ error: `Shopify rejected creation: ${errText}` });
        }

        const shopifyData = await shopifyRes.json();
        const shopifyProduct = shopifyData.product;
        const shopifyProductId = shopifyProduct.id;

        // NEW: Add to Collection
        const collectionId = process.env.SHOPIFY_COLLECTION_ID || 320337641590;
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
                        product_id: shopifyProductId
                    }
                })
            });
            console.log(`Product ${shopifyProductId} added to collection ${collectionId}.`);
        } catch (err) {
            console.error('Failed to add to collection:', err.message);
            // Non-fatal error for the product creation itself
        }

        // Save configuration to Database
        const clientDb = await pool.connect();
        try {
            await clientDb.query('BEGIN');
            const configResult = await clientDb.query(
                `INSERT INTO product_pot_config (shopify_product_id, product_title, no_pot_discount) VALUES ($1, $2, $3) RETURNING *`,
                [shopifyProductId, title, parseFloat(no_pot_discount) || 10.00]
            );
            const configId = configResult.rows[0].id;

            // Iterate over the created Shopify variants to save mappings
            for (let i = 0; i < shopifyProduct.variants.length; i++) {
                const shopifyVariant = shopifyProduct.variants[i];
                // Find matching input variant or fallback
                const inputVariant = (req.body.variants && req.body.variants[i]) || {};
                const potSize = inputVariant.pot_size || predictPotSize(shopifyVariant.option1 || shopifyVariant.title);

                await clientDb.query(
                    `INSERT INTO size_mappings (product_config_id, shopify_variant_id, variant_title, pot_size) VALUES ($1, $2, $3, $4)`,
                    [configId, shopifyVariant.id, shopifyVariant.title, potSize]
                );
            }
            await clientDb.query('COMMIT');
            console.log("Product successfully configured in Database.");
            await logActivity('PRODUCT_CREATED', `Created and configured product: ${title}`, { shopify_product_id: shopifyProductId });
        } catch (e) {
            await clientDb.query('ROLLBACK');
            console.error("Database Save Error:", e.message);
            throw e;
        } finally {
            clientDb.release();
        }

        res.json({ success: true, product: shopifyProduct });
    } catch (error) {
        console.error('SERVER FATAL ERROR:', error);
        res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
});

// GET /api/products/:id - Get a single product from Shopify and its DB config
router.get('/:id', async (req, res) => {
    const shop = process.env.SHOPIFY_STORE_DOMAIN;
    let accessToken = process.env.ADMIN_API || process.env.SHOPIFY_ACCESS_TOKEN;
    const { id } = req.params;

    // Session fallback for local dev
    if (!accessToken) {
        try {
            const sessions = await shopify.config.sessionStorage.findSessionsByShop(shop);
            if (sessions && sessions.length > 0) {
                accessToken = sessions[0].accessToken;
                console.log("Using fallover OAuth session token for local development (single product fetch).");
            }
        } catch (e) {
            console.error("Session lookup failed:", e.message);
        }
    }

    if (!accessToken) {
        return res.status(500).json({ error: 'No access token found. Add SHOPIFY_ACCESS_TOKEN to .env' });
    }

    try {
        console.log(`Fetching product ${id} from Shopify...`);
        const shopifyRes = await fetch(`https://${shop}/admin/api/2023-10/products/${id}.json`, {
            headers: {
                'X-Shopify-Access-Token': accessToken,
            }
        });

        if (!shopifyRes.ok) {
            const errText = await shopifyRes.text();
            console.error(`Shopify product fetch rejected: ${errText}`);
            return res.status(shopifyRes.status).json({ error: `Shopify error: ${errText}` });
        }

        const shopifyData = await shopifyRes.json();
        const product = shopifyData.product;

        // Fetch local db config
        const dbRes = await pool.query(
            `SELECT ppc.*,
             json_agg(json_build_object('id', sm.id, 'shopify_variant_id', sm.shopify_variant_id, 'variant_title', sm.variant_title, 'pot_size', sm.pot_size)) FILTER (WHERE sm.id IS NOT NULL) as size_mappings
             FROM product_pot_config ppc
             LEFT JOIN size_mappings sm ON ppc.id = sm.product_config_id
             WHERE ppc.shopify_product_id = $1
             GROUP BY ppc.id`,
            [id]
        );

        const config = dbRes.rows[0] || null;

        res.json({ product, config });
    } catch (error) {
        console.error('SERVER FATAL ERROR IN GET /:id:', error);
        res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
});

// PUT /api/products/:id - Update product in Shopify and its DB config & size mappings
router.put('/:id', async (req, res) => {
    const shop = process.env.SHOPIFY_STORE_DOMAIN;
    let accessToken = process.env.ADMIN_API || process.env.SHOPIFY_ACCESS_TOKEN;
    const { id } = req.params;

    if (!accessToken) {
        try {
            const sessions = await shopify.config.sessionStorage.findSessionsByShop(shop);
            if (sessions && sessions.length > 0) {
                accessToken = sessions[0].accessToken;
                console.log("Using fallover OAuth session token for local development (product update).");
            }
        } catch (e) {
            console.error("Session lookup failed:", e.message);
        }
    }

    if (!accessToken) {
        return res.status(500).json({ error: 'No access token found. Add SHOPIFY_ACCESS_TOKEN to .env' });
    }

    const { title, description, status, product_type, vendor, tags, options, variants, no_pot_discount } = req.body;

    try {
        console.log(`Attempting to update product "${title}" (ID: ${id}) on ${shop}...`);

        const productPayload = {
            id,
            title,
            body_html: description,
            status: status || 'active',
            product_type: product_type || '',
            vendor: vendor || '',
            tags: Array.isArray(tags) ? tags.join(', ') : tags || ''
        };

        if (options && options.length > 0) {
            productPayload.options = options;
            productPayload.variants = variants.map(v => ({
                id: v.id ? Number(v.id) : undefined, // Include existing Shopify variant ID
                option1: v.option1,
                option2: v.option2,
                option3: v.option3,
                price: v.price,
                compare_at_price: v.compare_at_price || null,
                inventory_management: v.inventory_management || 'shopify',
                inventory_quantity: parseInt(v.inventory_quantity) || 0,
                sku: v.sku || undefined,
                barcode: v.barcode || undefined,
                weight: v.weight ? parseFloat(v.weight) : undefined,
                weight_unit: v.weight_unit || 'lb'
            }));
        }

        const shopifyRes = await fetch(`https://${shop}/admin/api/2023-10/products/${id}.json`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'X-Shopify-Access-Token': accessToken,
            },
            body: JSON.stringify({
                product: productPayload,
            }),
        });

        if (!shopifyRes.ok) {
            const errText = await shopifyRes.text();
            console.error('Shopify API Error Response:', errText);
            return res.status(shopifyRes.status).json({ error: `Shopify rejected update: ${errText}` });
        }

        const shopifyData = await shopifyRes.json();
        const shopifyProduct = shopifyData.product;

        // Sync to Collection (in case not already in collection)
        const collectionId = process.env.SHOPIFY_COLLECTION_ID || 320337641590;
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
                        product_id: id
                    }
                })
            });
        } catch (err) {
            console.error('Failed to add to collection during update:', err.message);
        }

        // Save configuration to Database
        const clientDb = await pool.connect();
        try {
            await clientDb.query('BEGIN');
            const configResult = await clientDb.query(
                `INSERT INTO product_pot_config (shopify_product_id, product_title, no_pot_discount) 
                 VALUES ($1, $2, $3) 
                 ON CONFLICT (shopify_product_id) 
                 DO UPDATE SET product_title = EXCLUDED.product_title, no_pot_discount = EXCLUDED.no_pot_discount, updated_at = CURRENT_TIMESTAMP 
                 RETURNING *`,
                [id, title, parseFloat(no_pot_discount) || 10.00]
            );
            const configId = configResult.rows[0].id;

            // Clear old size mappings
            await clientDb.query('DELETE FROM size_mappings WHERE product_config_id = $1', [configId]);

            // Re-insert mappings matching updated Shopify variants
            if (shopifyProduct.variants && shopifyProduct.variants.length > 0) {
                for (const shopifyVariant of shopifyProduct.variants) {
                    // Find corresponding variant from payload to extract chosen pot size
                    const match = variants.find(v => 
                        (v.option1 || '').toLowerCase().trim() === (shopifyVariant.option1 || '').toLowerCase().trim() &&
                        (v.option2 || '').toLowerCase().trim() === (shopifyVariant.option2 || '').toLowerCase().trim() &&
                        (v.option3 || '').toLowerCase().trim() === (shopifyVariant.option3 || '').toLowerCase().trim()
                    );
                    const potSize = match ? match.pot_size : predictPotSize(shopifyVariant.option1 || shopifyVariant.title);

                    await clientDb.query(
                        `INSERT INTO size_mappings (product_config_id, shopify_variant_id, variant_title, pot_size) 
                         VALUES ($1, $2, $3, $4)`,
                        [configId, shopifyVariant.id, shopifyVariant.title, potSize]
                    );
                }
            }

            await clientDb.query('COMMIT');
            console.log("Product successfully updated & configured in Database.");
            await logActivity('PRODUCT_UPDATED', `Updated and configured product: ${title}`, { shopify_product_id: id });
        } catch (e) {
            await clientDb.query('ROLLBACK');
            console.error("Database Update Error:", e.message);
            throw e;
        } finally {
            clientDb.release();
        }

        res.json({ success: true, product: shopifyProduct });
    } catch (error) {
        console.error('SERVER FATAL ERROR IN PUT /:id:', error);
        res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
});

// POST /api/products/sync-config - Sync product titles & config with Shopify collection
router.post('/sync-config', async (req, res) => {
    const shop = process.env.SHOPIFY_STORE_DOMAIN;
    const accessToken = process.env.ADMIN_API || process.env.SHOPIFY_ACCESS_TOKEN;
    const collectionId = process.env.SHOPIFY_COLLECTION_ID;

    if (!accessToken) {
        return res.status(500).json({ error: 'SHOPIFY_ACCESS_TOKEN missing' });
    }
    if (!collectionId) {
        return res.status(400).json({ error: 'SHOPIFY_COLLECTION_ID not set' });
    }

    try {
        const collRes = await fetch(
            `https://${shop}/admin/api/2023-10/collections/${collectionId}/products.json?fields=id&limit=250`,
            { headers: { 'X-Shopify-Access-Token': accessToken } }
        );
        if (!collRes.ok) throw new Error('Failed to fetch collection product IDs');
        const collData = await collRes.json();
        const productIds = (collData.products || []).map(p => p.id);

        let products = [];
        if (productIds.length > 0) {
            const prodRes = await fetch(
                `https://${shop}/admin/api/2023-10/products.json?ids=${productIds.join(',')}&limit=250`,
                { headers: { 'X-Shopify-Access-Token': accessToken } }
            );
            if (!prodRes.ok) throw new Error('Failed to fetch product details');
            const data = await prodRes.json();
            products = data.products || [];
        }

        const clientDb = await pool.connect();
        try {
            await clientDb.query('BEGIN');
            for (const p of products) {
                const configResult = await clientDb.query(
                    `INSERT INTO product_pot_config (shopify_product_id, product_title, no_pot_discount)
                     VALUES ($1, $2, 10.00)
                     ON CONFLICT (shopify_product_id) DO UPDATE SET product_title = EXCLUDED.product_title, updated_at = CURRENT_TIMESTAMP
                     RETURNING id`,
                    [p.id, p.title]
                );
                
                const configId = configResult.rows[0].id;

                // Sync exact variant names (sizes) from Shopify
                if (p.variants && p.variants.length > 0) {
                    // Fetch existing mappings to preserve user configuration
                    const existingRes = await clientDb.query(
                        'SELECT shopify_variant_id, pot_size FROM size_mappings WHERE product_config_id = $1',
                        [configId]
                    );
                    const existingMap = new Map();
                    for (const row of existingRes.rows) {
                        existingMap.set(String(row.shopify_variant_id), row.pot_size);
                    }

                    // Clear old mappings to perfectly reflect Shopify's current variants
                    await clientDb.query('DELETE FROM size_mappings WHERE product_config_id = $1', [configId]);
                    
                    for (const v of p.variants) {
                        const vIdStr = String(v.id);
                        let potSize = existingMap.get(vIdStr);
                        if (!potSize) {
                            potSize = predictPotSize(v.option1 || v.title);
                        }
                        
                        await clientDb.query(
                            `INSERT INTO size_mappings (product_config_id, shopify_variant_id, variant_title, pot_size) 
                             VALUES ($1, $2, $3, $4)`,
                            [configId, v.id, v.title, potSize]
                        );
                    }
                }
            }
            const dbIdsRes = await clientDb.query(`SELECT shopify_product_id FROM product_pot_config`);
            const dbIds = dbIdsRes.rows.map(r => r.shopify_product_id);
            const staleIds = dbIds.filter(id => !productIds.includes(id.toString()) && !productIds.includes(Number(id)));
            if (staleIds.length) {
                await clientDb.query('DELETE FROM product_pot_config WHERE shopify_product_id = ANY($1)', [staleIds]);
            }
            await clientDb.query('COMMIT');
        } catch (e) {
            await clientDb.query('ROLLBACK');
            throw e;
        } finally {
            clientDb.release();
        }

        res.json({ success: true, synced: products.length, products });
    } catch (error) {
        console.error('Sync config error:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/products - Get all products from Shopify for configuration
router.get('/', async (req, res) => {
    const shop = process.env.SHOPIFY_STORE_DOMAIN;
    const accessToken = process.env.ADMIN_API || process.env.SHOPIFY_ACCESS_TOKEN;

    if (!accessToken) {
        // Fallback for local dev session
        try {
            const sessions = await shopify.config.sessionStorage.findSessionsByShop(shop);
            if (sessions && sessions.length > 0) {
                const session = sessions[0];
                const client = new shopify.api.clients.Rest({ session });
                const response = await client.get({ path: 'products' });
                return res.json(response.body.products);
            }
        } catch (e) {
            console.error("Local session lookup failed:", e);
        }
        return res.status(500).json({ error: 'SHOPIFY_ACCESS_TOKEN not found for syncing.' });
    }

    try {
        const collectionId = process.env.SHOPIFY_COLLECTION_ID;
        let products = [];

        if (collectionId) {
            // STEP 1: Fetch solely the IDs of products within the target collection securely
            console.log(`Fetching product IDs from designated collection: ${collectionId}`);
            const collectionRes = await fetch(`https://${shop}/admin/api/2023-10/collections/${collectionId}/products.json?fields=id&limit=250`, {
                headers: { 'X-Shopify-Access-Token': accessToken }
            });

            if (!collectionRes.ok) {
                const errText = await collectionRes.text();
                throw new Error(`Collection Data Access Error: ${errText}`);
            }

            const collectionData = await collectionRes.json();
            const productIds = (collectionData.products || []).map(p => p.id);

            // STEP 2: Fetch FULL detailed product variants leveraging pure IDs 
            if (productIds.length > 0) {
                const url = `https://${shop}/admin/api/2023-10/products.json?ids=${productIds.join(',')}&limit=250`;
                const shopifyRes = await fetch(url, { headers: { 'X-Shopify-Access-Token': accessToken } });

                if (!shopifyRes.ok) throw new Error(await shopifyRes.text());
                const data = await shopifyRes.json();
                products = data.products || [];
            }
        } else {
            // Fallback gracefully just in case someone incorrectly clears collection ID from .env
            const url = `https://${shop}/admin/api/2023-10/products.json?limit=250`;
            const shopifyRes = await fetch(url, { headers: { 'X-Shopify-Access-Token': accessToken } });

            if (!shopifyRes.ok) throw new Error(await shopifyRes.text());
            const data = await shopifyRes.json();
            products = data.products || [];
        }

        console.log(`Successfully fetched ${products.length} full products securely filtered`);
        res.json(products);
    } catch (error) {
        console.error('Fetch Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST /api/products/:id/generate-variants
router.post('/:id/generate-variants', async (req, res) => {
    const shop = process.env.SHOPIFY_STORE_DOMAIN;
    let accessToken = process.env.ADMIN_API || process.env.SHOPIFY_ACCESS_TOKEN;
    const { id } = req.params;
    const { sizesConfig, colors } = req.body;

    if (!accessToken) return res.status(500).json({ error: 'No access token found' });

    try {
        const variants = [];
        sizesConfig.forEach(sizeObj => {
            colors.forEach(color => {
                variants.push({
                    option1: sizeObj.name,
                    option2: color.name, // e.g. "White"
                    price: sizeObj.price,
                    inventory_management: 'shopify',
                    inventory_quantity: parseInt(sizeObj.inventory) || 0
                });
            });
        });

        // 1. Update the product to have the right options
        const shopifyResOptions = await fetch(`https://${shop}/admin/api/2023-10/products/${id}.json`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': accessToken },
            body: JSON.stringify({
                product: {
                    id: id,
                    options: [
                        { name: "Size", values: sizesConfig.map(s => s.name) },
                        { name: "Color", values: colors.map(c => c.name) }
                    ],
                    variants: variants
                }
            })
        });

        if (!shopifyResOptions.ok) {
            const err = await shopifyResOptions.text();
            throw new Error(err);
        }

        const data = await shopifyResOptions.json();
        const shopifyProduct = data.product;

        // Auto-configure the product in our DB so it moves to "Configured Products"
        const clientDb = await pool.connect();
        try {
            await clientDb.query('BEGIN');
            const configResult = await clientDb.query(
                `INSERT INTO product_pot_config (shopify_product_id, product_title, no_pot_discount) VALUES ($1, $2, 10.00) ON CONFLICT (shopify_product_id) DO UPDATE SET product_title = EXCLUDED.product_title, updated_at = CURRENT_TIMESTAMP RETURNING *`,
                [shopifyProduct.id, shopifyProduct.title]
            );
            const configId = configResult.rows[0].id;

            // Clear old mappings just in case
            await clientDb.query('DELETE FROM size_mappings WHERE product_config_id = $1', [configId]);

            // Add new mappings safely
            if (shopifyProduct.variants && shopifyProduct.variants.length > 0) {
                for (const v of shopifyProduct.variants) {
                    const potSize = predictPotSize(v.option1 || v.title);
                    await clientDb.query(
                        `INSERT INTO size_mappings (product_config_id, shopify_variant_id, variant_title, pot_size) VALUES ($1, $2, $3, $4)`,
                        [configId, v.id, v.title, potSize]
                    );
                }
            }
            await clientDb.query('COMMIT');
            await logActivity('PRODUCT_CONFIGURED', `Insta-built and configured product: ${shopifyProduct.title}`, { shopify_product_id: shopifyProduct.id });
        } catch (e) {
            await clientDb.query('ROLLBACK');
            console.error("Database Save Error:", e.message);
        } finally {
            clientDb.release();
        }

        res.json({ success: true, product: shopifyProduct });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
