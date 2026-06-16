const { Client } = require('pg');

async function dump() {
    const client = new Client({
        user: 'postgres',
        host: 'localhost',
        database: 'plant_bundle',
        port: 5432,
    });
    try {
        await client.connect();
        const colors = await client.query('SELECT * FROM pot_colors');
        console.log('--- POT COLORS ---');
        console.table(colors.rows);

        const inv = await client.query('SELECT pi.*, pc.name as color_name FROM pot_inventory pi JOIN pot_colors pc ON pi.pot_color_id = pc.id');
        console.log('--- POT INVENTORY ---');
        console.table(inv.rows);

        const configs = await client.query('SELECT id, shopify_product_id, product_title FROM product_pot_config');
        console.log('--- PRODUCT CONFIGS ---');
        console.table(configs.rows);
    } catch (e) {
        console.error(e);
    } finally {
        await client.end();
    }
}

dump();
