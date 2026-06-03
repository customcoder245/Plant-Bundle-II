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

async function fixDbMappings() {
    const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
    try {
        await client.connect();
        const res = await client.query('SELECT id, variant_title, pot_size FROM size_mappings');
        for (const row of res.rows) {
            const correctSize = predictPotSize(row.variant_title);
            if (row.pot_size !== correctSize) {
                console.log(`Updating mapping ${row.id}: ${row.variant_title} -> from ${row.pot_size} to ${correctSize}`);
                await client.query('UPDATE size_mappings SET pot_size = $1 WHERE id = $2', [correctSize, row.id]);
            }
        }
        console.log("Database mapped sizes successfully updated.");
    } catch (e) {
        console.error(e);
    } finally {
        await client.end();
    }
}

fixDbMappings();
