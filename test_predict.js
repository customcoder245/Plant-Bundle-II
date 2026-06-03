require('dotenv').config();
const shop = process.env.SHOPIFY_STORE_DOMAIN;
const token = process.env.ADMIN_API || process.env.SHOPIFY_ACCESS_TOKEN;

function predictPotSize(optionValue) {
    const shopVal = (optionValue || '').toLowerCase().trim();
    if (shopVal.includes('2"') || shopVal.includes('3"') || shopVal.includes('4"') || shopVal.includes('2 inch') || shopVal.includes('4 inch') || shopVal.includes('small') || shopVal.includes('2') || shopVal.includes('4')) return 'Small';
    if (shopVal.includes('6"') || shopVal.includes('8"') || shopVal.includes('6 inch') || shopVal.includes('8 inch') || shopVal.includes('medium') || shopVal.includes('standard') || shopVal.includes('6') || shopVal.includes('8')) return 'Medium';
    if (shopVal.includes('10"') || shopVal.includes('10 inch') || shopVal.includes('large') || shopVal.includes('10') || shopVal.includes('gal')) return 'Large';
    if (shopVal.includes('12"') || shopVal.includes('14"') || shopVal.includes('12 inch') || shopVal.includes('xl') || shopVal.includes('extra-large') || shopVal.includes('extra large') || shopVal.includes('12') || shopVal.includes('14')) return 'Extra Large';
    return 'Medium';
}

async function test() {
    console.log('Fetching products...');
    const res = await fetch(`https://${shop}/admin/api/2023-10/products.json?limit=250`, { headers: { 'X-Shopify-Access-Token': token } });
    const data = await res.json();
    const product = data.products.find(p => p.title.includes('Rosemary'));
    if (!product) return console.log('Product not found');
    console.log('Product:', product.title);
    product.variants.forEach(v => {
        const val = v.option1 || v.title;
        console.log(`Variant: ${val} -> Predicted: ${predictPotSize(val)}`);
    });
}
test();
