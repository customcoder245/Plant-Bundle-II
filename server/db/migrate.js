require('dotenv').config();
const pool = require('./pool');

const migrations = `
CREATE TABLE IF NOT EXISTS pot_colors (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  hex_code VARCHAR(7) NOT NULL,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS pot_inventory (
  id SERIAL PRIMARY KEY,
  pot_color_id INTEGER REFERENCES pot_colors(id) ON DELETE CASCADE,
  size VARCHAR(50) NOT NULL,
  quantity INTEGER DEFAULT 0,
  low_stock_threshold INTEGER DEFAULT 10,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(pot_color_id, size)
);

CREATE TABLE IF NOT EXISTS product_pot_config (
  id SERIAL PRIMARY KEY,
  shopify_product_id BIGINT NOT NULL UNIQUE,
  product_title VARCHAR(255),
  is_enabled BOOLEAN DEFAULT true,
  no_pot_discount DECIMAL(10,2) DEFAULT 10.00,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS size_mappings (
  id SERIAL PRIMARY KEY,
  product_config_id INTEGER REFERENCES product_pot_config(id) ON DELETE CASCADE,
  shopify_variant_id BIGINT NOT NULL,
  variant_title VARCHAR(255),
  pot_size VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS composite_images (
  id SERIAL PRIMARY KEY,
  product_config_id INTEGER REFERENCES product_pot_config(id) ON DELETE CASCADE,
  pot_color_id INTEGER REFERENCES pot_colors(id) ON DELETE CASCADE,
  size VARCHAR(50),
  image_url TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS activity_log (
  id SERIAL PRIMARY KEY,
  event_type VARCHAR(50) NOT NULL,
  description TEXT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pot_inventory_color_size ON pot_inventory(pot_color_id, size);
CREATE INDEX IF NOT EXISTS idx_product_config_shopify_id ON product_pot_config(shopify_product_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_created ON activity_log(created_at DESC);
`;

async function migrate() {
  try {
    await pool.query(migrations);
    console.log('Database migrations completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migrate();
