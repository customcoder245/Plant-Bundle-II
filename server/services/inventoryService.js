const pool = require('../db/pool');
const { logActivity } = require('./activityService');

/**
 * processOrder - Handles inventory deduction/restoration based on Shopify order webhooks
 * @param {Object} order - The Shopify order object
 * @param {String} action - 'deduct' or 'restore'
 */
async function processOrder(order, action = 'deduct') {
    const client = await pool.connect();
    const syncJobs = [];

    try {
        await client.query('BEGIN');
        console.log(`Processing Order ${order.name} (${order.id}) - Action: ${action}`);

        for (const lineItem of order.line_items) {
            // 1. Check if this product is managed as a bundle in our app
            const configResult = await client.query(
                'SELECT * FROM product_pot_config WHERE shopify_product_id = $1 AND is_enabled = true',
                [lineItem.product_id]
            );

            if (configResult.rows.length === 0) {
                console.log(`Skipping non-bundle product: ${lineItem.title}`);
                continue;
            }

            // 2. Extract the Pot selection
            // A. Check Line Item Properties (Bundle Builder logic)
            let potValue = '';
            const potColorProperty = lineItem.properties?.find(p => {
                const name = p.name.toLowerCase();
                return name.includes('pot') || name.includes('color');
            });

            if (potColorProperty) {
                potValue = potColorProperty.value;
            } else {
                // B. Fallback: Check Variant Title (Insta-Build variants structure: "Size / Color")
                // Parsing "4\" Pot / White" -> "White"
                const variantTitle = lineItem.variant_title || '';
                if (variantTitle.includes(' / ')) {
                    const parts = variantTitle.split(' / ');
                    potValue = parts[parts.length - 1].trim(); // Take the last part (Color)
                    console.log(`Extracted color "${potValue}" from variant title: ${variantTitle}`);
                }
            }

            if (!potValue) {
                console.log(`No pot selection detected for ${lineItem.title} (ID: ${lineItem.variant_id}). Skipping.`);
                continue;
            }

            // 3. Handle "NO POT" or "Bare Root"
            if (['NO POT', 'BARE ROOT', 'NONE'].includes(potValue.toUpperCase())) {
                console.log(`User selected "${potValue}" for ${lineItem.title}. No inventory deduction needed.`);
                continue;
            }

            // 4. Resolve Pot Color ID from Name
            let colorResult = await client.query(
                'SELECT id FROM pot_colors WHERE LOWER(name) = LOWER($1)',
                [potValue]
            );

            // Special case: sometimes name vs type mismatch. Check type too.
            if (colorResult.rows.length === 0) {
                colorResult = await client.query(
                    'SELECT id FROM pot_colors WHERE LOWER(type) = LOWER($1)',
                    [potValue]
                );
            }

            if (colorResult.rows.length === 0) {
                console.warn(`Could not find color in DB matching: "${potValue}"`);
                continue;
            }

            const potColorId = colorResult.rows[0].id;

            // 5. Resolve Pot Size from Variant Mapping
            const sizeResult = await client.query(
                'SELECT pot_size FROM size_mappings WHERE shopify_variant_id = $1',
                [lineItem.variant_id]
            );

            const potSize = sizeResult.rows[0]?.pot_size || 'Medium'; // Default to medium if unknown
            const quantity = lineItem.quantity;

            // 6. Update Pot Inventory
            let updatedQty = 0;
            if (action === 'deduct') {
                console.log(`Deducting ${quantity} x ${potValue} (${potSize}) for order ${order.name}...`);
                const resDb = await client.query(
                    `UPDATE pot_inventory SET quantity = GREATEST(0, quantity - $1), updated_at = CURRENT_TIMESTAMP WHERE pot_color_id = $2 AND size = $3 RETURNING quantity`,
                    [quantity, potColorId, potSize]
                );
                updatedQty = resDb.rows[0]?.quantity || 0;
            } else {
                console.log(`Restoring ${quantity} x ${potValue} (${potSize}) for order ${order.name}...`);
                const resDb = await client.query(
                    `UPDATE pot_inventory SET quantity = quantity + $1, updated_at = CURRENT_TIMESTAMP WHERE pot_color_id = $2 AND size = $3 RETURNING quantity`,
                    [quantity, potColorId, potSize]
                );
                updatedQty = resDb.rows[0]?.quantity || 0;
            }

            syncJobs.push({ potColorId, potSize, quantity: updatedQty });

            // 7. Log Activity
            await logActivity(
                action === 'deduct' ? 'INVENTORY_DEDUCTED' : 'INVENTORY_RESTORED',
                `${action === 'deduct' ? 'Deducted' : 'Restored'} ${quantity} unit(s) of "${potValue}" (${potSize}) for order ${order.name}`,
                {
                    order_id: order.id,
                    order_number: order.order_number,
                    item: lineItem.title,
                    color: potValue,
                    size: potSize,
                    quantity
                }
            );
        }

        await client.query('COMMIT');

        // Trigger Shopify variant sync in background after successful commit
        for (const job of syncJobs) {
            syncPotInventoryToShopify(job.potColorId, job.potSize, job.quantity).catch(err => 
                console.error(`Failed to background sync pot ${job.potColorId} ${job.potSize} to Shopify:`, err)
            );
        }
    } catch (error) {
        await client.query('ROLLBACK');
        console.error(`Inventory processing failed for order ${order.id}:`, error.message);
        throw error;
    } finally {
        client.release();
    }
}

let cachedLocationId = null;

async function getShopifyLocationId(shop, token) {
    if (cachedLocationId) return cachedLocationId;
    try {
        const res = await fetch(`https://${shop}/admin/api/2023-10/locations.json`, {
            headers: { 'X-Shopify-Access-Token': token }
        });
        if (res.ok) {
            const data = await res.json();
            if (data.locations && data.locations.length > 0) {
                const primary = data.locations.find(loc => loc.active);
                if (primary) {
                    cachedLocationId = primary.id;
                    return cachedLocationId;
                }
                cachedLocationId = data.locations[0].id;
                return cachedLocationId;
            }
        } else {
            console.error('Error fetching locations from Shopify:', await res.text());
        }
    } catch (e) {
        console.error('Failed to fetch Shopify locations:', e);
    }
    return null;
}

function matchColor(colorName, text) {
    const c = colorName.toLowerCase().trim();
    const t = text.toLowerCase().trim();
    return c === t || t.includes(c) || c.includes(t);
}

function matchSize(dbSize, shopifyOptionValue) {
    const db = dbSize.toLowerCase().trim();
    const shop = shopifyOptionValue.toLowerCase().trim();

    if (db === shop) return true;

    if (db === 'extra large' && (shop === 'xl' || shop === 'extra-large' || shop === 'extra large')) return true;

    if (db === 'small' && (shop.includes('2"') || shop.includes('3"') || shop.includes('4"') || shop.includes('2 inch') || shop.includes('4 inch') || shop.includes('small'))) return true;
    if (db === 'medium' && (shop.includes('6"') || shop.includes('6 inch') || shop.includes('medium') || shop.includes('standard'))) return true;
    if (db === 'large' && (shop.includes('8"') || shop.includes('10"') || shop.includes('8 inch') || shop.includes('10 inch') || shop.includes('large'))) return true;
    if (db === 'extra large' && (shop.includes('12"') || shop.includes('14"') || shop.includes('12 inch') || shop.includes('xl') || shop.includes('extra large'))) return true;

    return false;
}

async function syncPotInventoryToShopify(potColorId, size, quantity) {
    const shop = process.env.SHOPIFY_STORE_DOMAIN;
    const token = process.env.ADMIN_API || process.env.SHOPIFY_ACCESS_TOKEN;

    if (!shop || !token) {
        console.warn('Shopify credentials not found. Skipping Shopify inventory sync.');
        return;
    }

    try {
        const colorRes = await pool.query('SELECT name FROM pot_colors WHERE id = $1', [potColorId]);
        if (colorRes.rows.length === 0) return;
        const colorName = colorRes.rows[0].name;

        const locationId = await getShopifyLocationId(shop, token);
        if (!locationId) return;

        const configsRes = await pool.query('SELECT id, shopify_product_id, product_title FROM product_pot_config WHERE is_enabled = true');
        const configs = configsRes.rows;

        for (const config of configs) {
            const mappingsRes = await pool.query(
                'SELECT shopify_variant_id, pot_size FROM size_mappings WHERE product_config_id = $1',
                [config.id]
            );
            const mappings = mappingsRes.rows;
            if (mappings.length === 0) continue;

            const shopifyRes = await fetch(`https://${shop}/admin/api/2023-10/products/${config.shopify_product_id}.json`, {
                headers: { 'X-Shopify-Access-Token': token }
            });

            if (!shopifyRes.ok) continue;

            const data = await shopifyRes.json();
            const shopifyProduct = data.product;
            if (!shopifyProduct || !shopifyProduct.variants) continue;

            for (const variant of shopifyProduct.variants) {
                const mapping = mappings.find(m => String(m.shopify_variant_id) === String(variant.id));
                if (!mapping) continue;

                const isSizeMatch = mapping.pot_size.toLowerCase().trim() === size.toLowerCase().trim() ||
                                   (variant.option1 && variant.option1.toLowerCase().trim() === size.toLowerCase().trim());

                const isColorMatch = (variant.option2 && matchColor(colorName, variant.option2)) ||
                                     (variant.title && matchColor(colorName, variant.title));

                if (isSizeMatch && isColorMatch) {
                    console.log(`Syncing Shopify variant ${shopifyProduct.title} - ${variant.title} (ID: ${variant.id}) to ${quantity}`);
                    await fetch(`https://${shop}/admin/api/2023-10/inventory_levels/set.json`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-Shopify-Access-Token': token
                        },
                        body: JSON.stringify({
                            location_id: locationId,
                            inventory_item_id: variant.inventory_item_id,
                            available: quantity
                        })
                    });
                }
            }
        }
    } catch (e) {
        console.error('Error syncing pot inventory to Shopify:', e);
    }
}

async function syncPotsFromShopify() {
    const shop = process.env.SHOPIFY_STORE_DOMAIN;
    const token = process.env.ADMIN_API || process.env.SHOPIFY_ACCESS_TOKEN;

    if (!shop || !token) {
        throw new Error('Shopify credentials not configured in environment.');
    }

    const response = await fetch(`https://${shop}/admin/api/2023-10/products.json?limit=250`, {
        headers: { 'X-Shopify-Access-Token': token }
    });
    if (!response.ok) {
        throw new Error(`Failed to fetch Shopify products: ${await response.text()}`);
    }
    const data = await response.json();
    const products = data.products || [];

    const potProducts = products.filter(p => {
        const title = (p.title || '').toLowerCase();
        const type = (p.product_type || '').toLowerCase();
        return title.includes('pot') || title.includes('planter') || title.includes('saucer') || type === 'pot' || type === 'planter';
    });

    console.log(`Found ${potProducts.length} pot-related products in Shopify.`);

    const colorsRes = await pool.query('SELECT * FROM pot_colors');
    const colors = colorsRes.rows;

    const sizes = ['Small', 'Medium', 'Large', 'Extra Large'];
    let syncCount = 0;
    const syncedItems = [];

    for (const product of potProducts) {
        const productTitle = product.title;

        let matchedColorId = null;
        let matchedColorName = '';
        for (const color of colors) {
            if (matchColor(color.name, productTitle)) {
                matchedColorId = color.id;
                matchedColorName = color.name;
                break;
            }
        }

        const colorOptionIdx = (product.options || []).findIndex(opt => opt.name.toLowerCase().includes('color'));
        const sizeOptionIdx = (product.options || []).findIndex(opt => opt.name.toLowerCase().includes('size') || opt.name.toLowerCase().includes('option'));

        for (const variant of product.variants) {
            let variantColorId = matchedColorId;
            let variantColorName = matchedColorName;

            if (colorOptionIdx !== -1) {
                const variantColorVal = variant[`option${colorOptionIdx + 1}`];
                if (variantColorVal) {
                    const dbColor = colors.find(c => matchColor(c.name, variantColorVal));
                    if (dbColor) {
                        variantColorId = dbColor.id;
                        variantColorName = dbColor.name;
                    }
                }
            }

            if (!variantColorId) {
                const dbColor = colors.find(c => matchColor(c.name, variant.title || ''));
                if (dbColor) {
                    variantColorId = dbColor.id;
                    variantColorName = dbColor.name;
                }
            }

            if (!variantColorId) continue;

            let matchedSize = null;
            if (sizeOptionIdx !== -1) {
                const sizeVal = variant[`option${sizeOptionIdx + 1}`];
                if (sizeVal) {
                    matchedSize = sizes.find(s => matchSize(s, sizeVal));
                }
            }

            if (!matchedSize) {
                matchedSize = sizes.find(s => matchSize(s, variant.title || ''));
            }

            if (!matchedSize) continue;

            const qty = variant.inventory_quantity || 0;

            const res = await pool.query(
                `UPDATE pot_inventory 
                 SET quantity = $1, updated_at = CURRENT_TIMESTAMP 
                 WHERE pot_color_id = $2 AND size = $3
                 RETURNING *`,
                [qty, variantColorId, matchedSize]
            );

            if (res.rows.length > 0) {
                console.log(`Synced DB pot inventory: Color "${variantColorName}", Size "${matchedSize}" -> ${qty}`);
                syncCount++;
                syncedItems.push({
                    color: variantColorName,
                    size: matchedSize,
                    quantity: qty,
                    product: productTitle
                });

                syncPotInventoryToShopify(variantColorId, matchedSize, qty).catch(err =>
                    console.error('Failed to sync plant bundle variant after pot sync:', err)
                );
            }
        }
    }

    return {
        success: true,
        updatedCount: syncCount,
        details: syncedItems
    };
}

module.exports = { processOrder, syncPotInventoryToShopify, syncPotsFromShopify };
