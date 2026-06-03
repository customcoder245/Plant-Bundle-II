const fetch = require('node-fetch');

async function simulateOrder() {
  const orderData = {
    id: Date.now(),
    order_number: Math.floor(Math.random() * 10000),
    name: `#${Math.floor(Math.random() * 10000)}-simulated`,
    line_items: [
      {
        id: 11111,
        product_id: 22222,
        title: "Madagascar Palm Bundle",
        quantity: 1,
        variant_id: 33333,
        variant_title: '6" Pot / White'
      }
    ]
  };
  console.log('Sending simulated order webhook...');
  try {
    const response = await fetch('http://localhost:3000/webhooks/orders/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-bypass-webhook-verification': 'true'
      },
      body: JSON.stringify(orderData)
    });
    console.log('Status Code:', response.status);
    const json = await response.json();
    console.log('Response:', json);
  } catch (error) {
    console.error('Error sending request:', error.message);
  }
}

simulateOrder();
