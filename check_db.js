require('dotenv').config();
const { Client } = require('pg');
const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function run() {
    try {
        await client.connect();
        console.log("Connected to DB");

        const tables = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
        console.log("Tables:", tables.rows.map(r => r.table_name));

        if (tables.rows.find(r => r.table_name === 'shopify_sessions')) {
            const sessions = await client.query('SELECT * FROM shopify_sessions');
            console.log("Sessions Count:", sessions.rows.length);
            sessions.rows.forEach(s => {
                console.log(`Shop: ${s.shop}, ID: ${s.id}, AccessToken: ${s.accessToken ? 'PRESENT' : 'MISSING'}`);
            });
        } else {
            console.log("shopify_sessions table not found!");
        }
    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}

run();
