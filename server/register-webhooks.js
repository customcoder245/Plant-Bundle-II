require('dotenv').config();
const fetch = require('node-fetch');

async function registerWebhooks() {
    const shop = process.env.SHOPIFY_STORE_DOMAIN;
    const accessToken = process.env.ADMIN_API || process.env.SHOPIFY_ACCESS_TOKEN;
    const appUrl = process.env.APP_URL;

    if (!shop || !accessToken || !appUrl) {
        console.error('Missing SHOPIFY_STORE_DOMAIN, ADMIN_API, or APP_URL in .env');
        return;
    }

    const topics = [
        { topic: 'orders/create', address: `${appUrl}/webhooks/orders/create` },
        { topic: 'orders/cancelled', address: `${appUrl}/webhooks/orders/cancelled` },
        { topic: 'orders/fulfilled', address: `${appUrl}/webhooks/orders/fulfilled` }
    ];

    console.log(`Registering webhooks for ${shop}...`);

    for (const webhook of topics) {
        try {
            const response = await fetch(`https://${shop}/admin/api/2023-10/webhooks.json`, {
                method: 'POST',
                headers: {
                    'X-Shopify-Access-Token': accessToken,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    webhook: {
                        topic: webhook.topic,
                        address: webhook.address,
                        format: 'json'
                    }
                })
            });

            const data = await response.json();
            if (response.ok) {
                console.log(`✅ Success: Registered ${webhook.topic}`);
            } else {
                if (data.errors?.address?.[0]?.includes('already exists')) {
                    console.log(`ℹ️ Info: ${webhook.topic} already registered.`);
                } else {
                    console.error(`❌ Failed: ${webhook.topic} -`, JSON.stringify(data.errors));
                }
            }
        } catch (error) {
            console.error(`❌ Error registering ${webhook.topic}:`, error.message);
        }
    }
}

registerWebhooks();
