require('dotenv').config();
const { Client } = require('pg');
const client = new Client(process.env.DATABASE_URL);
client.connect().then(() => client.query('SELECT * FROM shopify_sessions'))
    .then(res => { console.log(res.rows); client.end(); })
    .catch(console.error);
