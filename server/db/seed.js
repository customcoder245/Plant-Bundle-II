require('dotenv').config();
const pool = require('./pool');

async function seed() {
    try {
        const colors = [
            { name: 'White', hex_code: '#FFFFFF', display_order: 1 },
            { name: 'Black', hex_code: '#000000', display_order: 2 },
            { name: 'Terracotta', hex_code: '#E2725B', display_order: 3 },
            { name: 'Sage Green', hex_code: '#9CAF88', display_order: 4 },
            { name: 'Navy Blue', hex_code: '#000080', display_order: 5 },
            { name: 'Blush Pink', hex_code: '#FFB6C1', display_order: 6 }
        ];

        for (const color of colors) {
            await pool.query(
                `INSERT INTO pot_colors (name, hex_code, display_order) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
                [color.name, color.hex_code, color.display_order]
            );
        }

        const sizes = ['Small', 'Medium', 'Large', 'Extra Large'];
        const colorResult = await pool.query('SELECT id FROM pot_colors');

        for (const colorRow of colorResult.rows) {
            for (const size of sizes) {
                await pool.query(
                    `INSERT INTO pot_inventory (pot_color_id, size, quantity, low_stock_threshold) VALUES ($1, $2, 50, 10) ON CONFLICT (pot_color_id, size) DO NOTHING`,
                    [colorRow.id, size]
                );
            }
        }

        console.log('Database seeded successfully');
        process.exit(0);
    } catch (error) {
        console.error('Seeding failed:', error);
        process.exit(1);
    }
}

seed();
