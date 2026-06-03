require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const pool = require('./db/pool');

// Fix: The official package is @shopify/shopify-api
const { shopifyApi, ApiVersion } = require('@shopify/shopify-api');
const shopifyApp = require('@shopify/shopify-app-express').shopifyApp;
const { PostgreSQLSessionStorage } = require('@shopify/shopify-app-session-storage-postgresql');

// Routes will be required below after module.exports is set

const app = express();
const PORT = process.env.PORT || 3000;

// Force the PostgreSQL driver to use SSL natively to satisfy Neon DB's strict requirements
process.env.PGSSLMODE = 'no-verify';

// Use shopify-app-express for auth and session
const shopify = shopifyApp({
  api: {
    apiKey: process.env.SHOPIFY_API_KEY,
    apiSecretKey: process.env.SHOPIFY_API_SECRET,
    scopes: process.env.SHOPIFY_SCOPES ? process.env.SHOPIFY_SCOPES.split(',') : [],
    hostName: (process.env.RAILWAY_PUBLIC_DOMAIN || (process.env.APP_URL ? process.env.APP_URL.replace(/https?:\/\//, '') : '')),
    apiVersion: ApiVersion.October23,
    isEmbeddedApp: true,
  },
  auth: {
    path: '/api/auth',
    callbackPath: '/api/auth/callback',
  },
  webhooks: {
    path: '/api/webhooks',
  },
  sessionStorage: new PostgreSQLSessionStorage(process.env.DATABASE_URL),
});

// Important: export shopify to use its API client in products.js
module.exports.shopify = shopify;

const authRoutes = require('./routes/auth');
const potRoutes = require('./routes/pots');
const inventoryRoutes = require('./routes/inventory');
const productConfigRoutes = require('./routes/productConfig');
const imageRoutes = require('./routes/images');
const webhookRoutes = require('./routes/webhooks');
const activityRoutes = require('./routes/activity');
const productRoutes = require('./routes/products'); // New route file

app.use(cors());
app.use(express.json({
  verify: (req, res, buf) => {
    if (req.originalUrl.includes('/webhooks')) {
      req.rawBody = buf;
    }
  }
}));

// Shopify auth routes
app.get('/api/auth', shopify.auth.begin());
app.get('/api/auth/callback', shopify.auth.callback(), (req, res) => {
  const shop = req.query.shop;
  const host = req.query.host;
  res.redirect(`/?shop=${shop}&host=${host}`);
});

// Secure all /api/* routes with session validation (excluding auth and webhooks)
// app.use('/api/*', shopify.validateAuthenticatedSession());  <-- You can use this for production

// Your routes
app.use('/api/pots', potRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/product-config', productConfigRoutes);
app.use('/api/images', imageRoutes);
app.use('/api/activity', activityRoutes);
app.use('/api/products', productRoutes); // New

// Webhooks (raw body)
app.use('/webhooks', express.raw({ type: 'application/json' }), webhookRoutes);

// Add CSP header to allow Shopify to embed this app in an iframe
app.use((req, res, next) => {
  const shop = req.query.shop || req.headers['x-shopify-shop-domain'];
  if (shop) {
    res.setHeader('Content-Security-Policy', `frame-ancestors https://${shop} https://admin.shopify.com;`);
  } else {
    res.setHeader('Content-Security-Policy', `frame-ancestors https://*.myshopify.com https://admin.shopify.com;`);
  }
  next();
});

// Health check (must be before the catch-all)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Always serve the React frontend
app.use(express.static(path.join(__dirname, '../client/dist')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/dist/index.html'));
});


// Auto-run DB migrations on startup
async function runMigrations() {
  try {
    const migrations = `
      CREATE TABLE IF NOT EXISTS pot_colors (id SERIAL PRIMARY KEY, name VARCHAR(100) NOT NULL, type VARCHAR(100), hex_code VARCHAR(7) NOT NULL, display_order INTEGER DEFAULT 0, is_active BOOLEAN DEFAULT true, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE IF NOT EXISTS pot_inventory (id SERIAL PRIMARY KEY, pot_color_id INTEGER REFERENCES pot_colors(id) ON DELETE CASCADE, size VARCHAR(50) NOT NULL, quantity INTEGER DEFAULT 0, low_stock_threshold INTEGER DEFAULT 10, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, UNIQUE(pot_color_id, size));
      CREATE TABLE IF NOT EXISTS product_pot_config (id SERIAL PRIMARY KEY, shopify_product_id BIGINT NOT NULL UNIQUE, product_title VARCHAR(255), is_enabled BOOLEAN DEFAULT true, no_pot_discount DECIMAL(10,2) DEFAULT 10.00, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE IF NOT EXISTS size_mappings (id SERIAL PRIMARY KEY, product_config_id INTEGER REFERENCES product_pot_config(id) ON DELETE CASCADE, shopify_variant_id BIGINT NOT NULL, variant_title VARCHAR(255), pot_size VARCHAR(50) NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE IF NOT EXISTS composite_images (id SERIAL PRIMARY KEY, product_config_id INTEGER REFERENCES product_pot_config(id) ON DELETE CASCADE, pot_color_id INTEGER REFERENCES pot_colors(id) ON DELETE CASCADE, size VARCHAR(50), image_url TEXT NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE IF NOT EXISTS activity_log (id SERIAL PRIMARY KEY, event_type VARCHAR(50) NOT NULL, description TEXT, metadata JSONB, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
      ALTER TABLE pot_colors ADD COLUMN IF NOT EXISTS image_url TEXT;
    `;
    await pool.query(migrations);
    console.log('Database migrations completed successfully');
  } catch (err) {
    console.error('Migration error (non-fatal):', err.message);
  }
}

if (require.main === module) {
  runMigrations().then(() => {
    app.listen(PORT, () => {
      console.log(`Plant + Pot Bundle App running on port ${PORT}`);
    });
  });
}
