
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function deduplicate() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        console.log("Fetching colors...");
        const colorsRes = await client.query('SELECT id, name FROM pot_colors ORDER BY name, id');
        const colors = colorsRes.rows;

        const seenNames = new Map();
        const toDeleteIds = [];

        for (const color of colors) {
            const name = color.name.toLowerCase().trim();
            if (seenNames.has(name)) {
                // Duplicate found
                const keepId = seenNames.get(name);
                console.log(`Found duplicate color: "${color.name}" (ID: ${color.id}). Keeping ID: ${keepId}`);

                // Merge inventory before deleting
                // 1. Get inventory for the duplicate
                const dupeInv = await client.query('SELECT * FROM pot_inventory WHERE pot_color_id = $1', [color.id]);

                for (const inv of dupeInv.rows) {
                    // Check if keepId already has this size
                    const existingInv = await client.query('SELECT * FROM pot_inventory WHERE pot_color_id = $1 AND size = $2', [keepId, inv.size]);
                    if (existingInv.rows.length > 0) {
                        // Merge quantities
                        await client.query('UPDATE pot_inventory SET quantity = quantity + $1 WHERE id = $2', [inv.quantity, existingInv.rows[0].id]);
                        console.log(`Merged ${inv.quantity} units of size "${inv.size}" into ID ${existingInv.rows[0].id}`);
                    } else {
                        // Reassign to keepId
                        await client.query('UPDATE pot_inventory SET pot_color_id = $1 WHERE id = $2', [keepId, inv.id]);
                        console.log(`Reassigned size "${inv.size}" to kept color ID ${keepId}`);
                    }
                }

                toDeleteIds.push(color.id);
            } else {
                seenNames.set(name, color.id);
            }
        }

        if (toDeleteIds.length > 0) {
            console.log(`Deleting ${toDeleteIds.length} duplicate color entries...`);
            // Note: cascading delete might be on, but let's be safe. 
            // If inventory was reassigned/merged, we just delete the color.
            // If there's any remaining inventory for these IDs (shouldn't be), delete it first.
            await client.query('DELETE FROM pot_inventory WHERE pot_color_id = ANY($1)', [toDeleteIds]);
            await client.query('DELETE FROM pot_colors WHERE id = ANY($1)', [toDeleteIds]);
        } else {
            console.log("No duplicate colors found by name.");
        }

        // Now handle exact inventory duplicates (same color_id and same size)
        // This can happen if the above reassignment created duplicates within the same color_id
        console.log("Checking for duplicate size records within colors...");
        const invDupesRes = await client.query(`
            SELECT pot_color_id, size, count(*) 
            FROM pot_inventory 
            GROUP BY pot_color_id, size 
            HAVING count(*) > 1
        `);

        for (const dupe of invDupesRes.rows) {
            console.log(`Fixing duplicate size "${dupe.size}" for color ID ${dupe.pot_color_id}...`);
            const records = await client.query(
                'SELECT id, quantity FROM pot_inventory WHERE pot_color_id = $1 AND size = $2 ORDER BY id',
                [dupe.pot_color_id, dupe.size]
            );

            const keepRec = records.rows[0];
            let totalQty = keepRec.quantity;
            const toDeleteInvIds = [];

            for (let i = 1; i < records.rows.length; i++) {
                totalQty += records.rows[i].quantity;
                toDeleteInvIds.push(records.rows[i].id);
            }

            await client.query('UPDATE pot_inventory SET quantity = $1 WHERE id = $2', [totalQty, keepRec.id]);
            await client.query('DELETE FROM pot_inventory WHERE id = ANY($1)', [toDeleteInvIds]);
            console.log(`Merged ${records.rows.length} records into one with total quantity ${totalQty}`);
        }

        await client.query('COMMIT');
        console.log("Deduplication complete!");
    } catch (e) {
        await client.query('ROLLBACK');
        console.error("Error during deduplication:", e);
    } finally {
        client.release();
        await pool.end();
    }
}

deduplicate();
