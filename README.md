# Plant + Pot Bundle App

Shopify app for selling plants with pots as bundled products with dual inventory tracking.

## Features
- Dual Inventory Tracking: Deducts both plant AND pot inventory
- Global Pot Inventory: Pots shared across all plant products
- "No Pot" Option: Customers can opt out for a discount
- Admin Dashboard: Manage pot colors, inventory, product configurations
- Theme Extension: Pot color selector widget for product pages
- Composite Images: Plant+pot combination images
- Webhook Integration: Automatic inventory updates on orders

## Tech Stack
- Backend: Node.js + Express
- Frontend: React + Shopify Polaris
- Database: PostgreSQL
- Deployment: Railway (recommended)

## Quick Start

```bash
# 1. Install dependencies
npm install
cd client && npm install && cd ..

# 2. Configure environment
cp .env.example .env
# Edit .env with your Shopify credentials

# 3. Setup database
npm run db:migrate
npm run db:seed

# 4. Run development server
npm run dev
```

## Webhook Setup
Register in Shopify Admin > Settings > Notifications:
- orders/create -> https://your-app.railway.app/webhooks/orders/create
- orders/cancelled -> https://your-app.railway.app/webhooks/orders/cancelled
- orders/refunded -> https://your-app.railway.app/webhooks/orders/refunded

## Database Schema
- pot_colors: id, name, hex_code, display_order, is_active
- pot_inventory: id, pot_color_id, size, quantity, low_stock_threshold
- product_pot_config: id, shopify_product_id, product_title, is_enabled, no_pot_discount
- size_mappings: id, product_config_id, shopify_variant_id, variant_title, pot_size
- composite_images: id, product_config_id, pot_color_id, size, image_url
- activity_log: id, event_type, description, metadata

## License
MIT
