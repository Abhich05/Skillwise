-- Products table
CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    unit TEXT,
    category TEXT,
    brand TEXT,
    stock INTEGER NOT NULL DEFAULT 0,
    status TEXT DEFAULT 'active',
    image TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Inventory history table
CREATE TABLE IF NOT EXISTS inventory_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER,
    old_quantity INTEGER,
    new_quantity INTEGER,
    change_amount INTEGER,
    change_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    user_info TEXT,
    reason TEXT,
    FOREIGN KEY(product_id) REFERENCES products(id)
);

-- Categories table for better organization
CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Insert default categories
INSERT OR IGNORE INTO categories (name, description) VALUES 
('Electronics', 'Electronic devices and components'),
('Clothing', 'Apparel and fashion items'),
('Food & Beverages', 'Consumable products'),
('Books', 'Books and educational materials'),
('Home & Garden', 'Household and garden supplies'),
('Sports', 'Sports equipment and accessories'),
('Health & Beauty', 'Health and beauty products'),
('Toys', 'Toys and games'),
('Automotive', 'Automotive parts and accessories'),
('Office Supplies', 'Office and stationery supplies');

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
CREATE INDEX IF NOT EXISTS idx_inventory_history_product_id ON inventory_history(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_history_change_date ON inventory_history(change_date);