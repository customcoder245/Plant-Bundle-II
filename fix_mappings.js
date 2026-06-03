require('dotenv').config();
const { Client } = require('pg');

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

async function fixMappings() {
    const shop = process.env.SHOPIFY_STORE_DOMAIN;
    const token = process.env.ADMIN_API || process.env.SHOPIFY_ACCESS_TOKEN;
    const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

    try {
        await client.connect();

        // Get all products in our config
        const configsRes = await client.query('SELECT * FROM product_pot_config');
        const configs = configsRes.rows;

        if (configs.length === 0) return;
        
        const ids = configs.map(c => c.shopify_product_id);
        const prodRes = await fetch(`https://${shop}/admin/api/2023-10/products.json?ids=${ids.join(',')}&limit=250`, {
            headers: { 'X-Shopify-Access-Token': token }
        });
        
        const data = await prodRes.json();
        const products = data.products || [];

        for (const p of products) {
            const config = configs.find(c => c.shopify_product_id.toString() === p.id.toString());
            if (!config) continue;

            console.log(`Fixing mappings for: ${p.title}`);
            await client.query('DELETE FROM size_mappings WHERE product_config_id = $1', [config.id]);

            for (const v of p.variants) {
                // Predict the standardized size for correct inventory tracking
                const sizeName = predictPotSize(v.option1 || v.title);
                await client.query(
                    `INSERT INTO size_mappings (product_config_id, shopify_variant_id, variant_title, pot_size) 
                     VALUES ($1, $2, $3, $4)`,
                    [config.id, v.id, v.title, sizeName]
                );
            }
        }
        
        console.log('Successfully fixed size_mappings!');
    } catch (e) {
        console.error('Error:', e);
    } finally {
        await client.end();
    }
}

fixMappings();
