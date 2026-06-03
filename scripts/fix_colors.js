
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function fixColors() {
    try {
        console.log("Updating White hex codes...");
        const res = await pool.query("UPDATE pot_colors SET hex_code = '#FFFFFF' WHERE LOWER(name) LIKE 'white%'");
        console.log(`Updated ${res.rowCount} colors to white.`);

        // Also fix any other obvious ones if needed
        await pool.query("UPDATE pot_colors SET hex_code = '#000000' WHERE LOWER(name) = 'black' AND hex_code != '#000000'");

    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}

fixColors();
