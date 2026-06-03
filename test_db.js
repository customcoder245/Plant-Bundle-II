require('dotenv').config();
const { Client } = require('pg');
const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function run() {
    await client.connect();
    const res = await client.query(`
        SELECT pm.shopify_product_id, pm.product_title, sm.variant_title, sm.pot_size
        FROM product_pot_config pm
        JOIN size_mappings sm ON pm.id = sm.product_config_id
        WHERE pm.product_title ILIKE '%Rosemary%'
    `);
    console.log("Mappings for Rosemary:");
    res.rows.forEach(r => {
        console.log(`Variant: ${r.variant_title} -> pot_size: ${r.pot_size}`);
    });
    await client.end();
}
run();
