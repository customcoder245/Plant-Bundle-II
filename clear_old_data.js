require('dotenv').config();
const { Client } = require('pg');
const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function clearOldData() {
    try {
        await client.connect();
        console.log("Connected to DB");

        console.log("Clearing old data (pre-today)...");
        await client.query("DELETE FROM product_pot_config WHERE created_at < CURRENT_DATE");
        await client.query("DELETE FROM activity_log WHERE created_at < CURRENT_DATE");
        await client.query("DELETE FROM pot_colors WHERE created_at < CURRENT_DATE");
        console.log("Old data cleared successfully.");

    } catch (err) {
        console.error("Error clearing data:", err);
    } finally {
        await client.end();
    }
}

clearOldData();
