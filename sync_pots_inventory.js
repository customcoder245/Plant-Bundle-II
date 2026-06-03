require('dotenv').config();
const { syncPotsFromShopify } = require('./server/services/inventoryService');

async function runSync() {
    console.log('Starting pot inventory synchronization...');
    try {
        const result = await syncPotsFromShopify();
        console.log(`Successfully completed synchronization!`);
        console.log(`Updated ${result.updatedCount} pot inventory items in database and pushed updates to Shopify bundle products.`);
        if (result.details.length > 0) {
            console.log('Details:');
            result.details.forEach(item => {
                console.log(` - Color: ${item.color}, Size: ${item.size} -> Stock: ${item.quantity} (source product: "${item.product}")`);
            });
        }
        process.exit(0);
    } catch (error) {
        console.error('Pot inventory synchronization failed:', error);
        process.exit(1);
    }
}

runSync();

