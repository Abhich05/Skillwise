const express = require('express');
const router = express.Router();
const Database = require('../database/connection');
const { validate, productValidationRules, updateProductValidationRules, searchValidationRules } = require('../middleware/validation');

// Get all products with optional filtering and pagination
router.get('/', searchValidationRules(), validate, async (req, res) => {
    try {
        const db = new Database();
        await db.connect();

        const { name, category, status, page = 1, limit = 50, sort = 'name', order = 'asc' } = req.query;
        const offset = (page - 1) * limit;

        let whereClause = '';
        let params = [];

        if (name) {
            whereClause += ' AND name LIKE ?';
            params.push(`%${name}%`);
        }

        if (category) {
            whereClause += ' AND category = ?';
            params.push(category);
        }

        // Filter by stock status instead of product status
        if (status) {
            if (status === 'out_of_stock') {
                whereClause += ' AND stock = 0';
            } else if (status === 'low_stock') {
                whereClause += ' AND stock > 0 AND stock <= 10';
            } else if (status === 'in_stock') {
                whereClause += ' AND stock > 10';
            }
        }

        // Validate and sanitize sort field to prevent SQL injection
        const allowedSortFields = ['name', 'category', 'brand', 'stock', 'status', 'created_at', 'updated_at'];
        const sortField = allowedSortFields.includes(sort) ? sort : 'name';
        const sortOrder = order.toLowerCase() === 'desc' ? 'DESC' : 'ASC';

        const sql = `
            SELECT * FROM products 
            WHERE 1=1 ${whereClause}
            ORDER BY ${sortField} ${sortOrder}
            LIMIT ? OFFSET ?
        `;

        params.push(parseInt(limit), parseInt(offset));

        const products = await db.all(sql, params);

        // Get total count for pagination
        const countSql = `SELECT COUNT(*) as total FROM products WHERE 1=1 ${whereClause}`;
        const countParams = params.slice(0, -2); // Remove limit and offset
        const countResult = await db.get(countSql, countParams);

        await db.close();

        res.json({
            success: true,
            data: products,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: countResult.total,
                pages: Math.ceil(countResult.total / limit)
            }
        });
    } catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching products',
            error: error.message
        });
    }
});

// Get a single product by ID
router.get('/:id', async (req, res) => {
    try {
        const db = new Database();
        await db.connect();

        const product = await db.get('SELECT * FROM products WHERE id = ?', [req.params.id]);

        await db.close();

        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Product not found'
            });
        }

        res.json({
            success: true,
            data: product
        });
    } catch (error) {
        console.error('Error fetching product:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching product',
            error: error.message
        });
    }
});

// Create a new product
router.post('/', productValidationRules(), validate, async (req, res) => {
    try {
        const db = new Database();
        await db.connect();

        const { name, unit, category, brand, stock, status, image } = req.body;

        // Check if product with same name already exists
        const existingProduct = await db.get('SELECT id FROM products WHERE name = ?', [name]);
        if (existingProduct) {
            await db.close();
            return res.status(409).json({
                success: false,
                message: 'A product with this name already exists'
            });
        }

        const sql = `
            INSERT INTO products (name, unit, category, brand, stock, status, image)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `;

        const result = await db.run(sql, [
            name, unit || null, category || null, brand || null,
            stock, status || 'active', image || null
        ]);

        // Add initial inventory history entry
        await db.run(
            'INSERT INTO inventory_history (product_id, old_quantity, new_quantity, change_amount, reason) VALUES (?, ?, ?, ?, ?)',
            [result.id, 0, stock, stock, 'Initial stock']
        );

        const newProduct = await db.get('SELECT * FROM products WHERE id = ?', [result.id]);

        await db.close();

        res.status(201).json({
            success: true,
            message: 'Product created successfully',
            data: newProduct
        });
    } catch (error) {
        console.error('Error creating product:', error);
        res.status(500).json({
            success: false,
            message: 'Error creating product',
            error: error.message
        });
    }
});

// Update a product
router.put('/:id', updateProductValidationRules(), validate, async (req, res) => {
    try {
        const db = new Database();
        await db.connect();

        const productId = req.params.id;
        const { name, unit, category, brand, stock, status, image } = req.body;

        // Get current product data
        const currentProduct = await db.get('SELECT * FROM products WHERE id = ?', [productId]);
        if (!currentProduct) {
            await db.close();
            return res.status(404).json({
                success: false,
                message: 'Product not found'
            });
        }

        // Check if name is being changed and if it's already taken
        if (name && name !== currentProduct.name) {
            const existingProduct = await db.get('SELECT id FROM products WHERE name = ? AND id != ?', [name, productId]);
            if (existingProduct) {
                await db.close();
                return res.status(409).json({
                    success: false,
                    message: 'A product with this name already exists'
                });
            }
        }

        // Track inventory changes if stock is being updated
        if (stock !== undefined && stock !== currentProduct.stock) {
            const changeAmount = stock - currentProduct.stock;
            await db.run(
                'INSERT INTO inventory_history (product_id, old_quantity, new_quantity, change_amount, reason) VALUES (?, ?, ?, ?, ?)',
                [productId, currentProduct.stock, stock, changeAmount, 'Manual update']
            );
        }

        const sql = `
            UPDATE products 
            SET name = COALESCE(?, name),
                unit = COALESCE(?, unit),
                category = COALESCE(?, category),
                brand = COALESCE(?, brand),
                stock = COALESCE(?, stock),
                status = COALESCE(?, status),
                image = COALESCE(?, image),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `;

        await db.run(sql, [
            name || null, unit || null, category || null, brand || null,
            stock !== undefined ? stock : null, status || null, image || null, productId
        ]);

        const updatedProduct = await db.get('SELECT * FROM products WHERE id = ?', [productId]);

        await db.close();

        res.json({
            success: true,
            message: 'Product updated successfully',
            data: updatedProduct
        });
    } catch (error) {
        console.error('Error updating product:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating product',
            error: error.message
        });
    }
});

// Delete a product
router.delete('/:id', async (req, res) => {
    try {
        const db = new Database();
        await db.connect();

        const productId = req.params.id;

        // Check if product exists
        const product = await db.get('SELECT * FROM products WHERE id = ?', [productId]);
        if (!product) {
            await db.close();
            return res.status(404).json({
                success: false,
                message: 'Product not found'
            });
        }

        // Delete related history first
        await db.run('DELETE FROM inventory_history WHERE product_id = ?', [productId]);

        // Delete the product
        await db.run('DELETE FROM products WHERE id = ?', [productId]);

        await db.close();

        res.json({
            success: true,
            message: 'Product deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting product:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting product',
            error: error.message
        });
    }
});

// Get categories
router.get('/categories/all', async (req, res) => {
    try {
        const db = new Database();
        await db.connect();

        const categories = await db.all(
            'SELECT DISTINCT category FROM products WHERE category IS NOT NULL ORDER BY category'
        );

        await db.close();

        res.json({
            success: true,
            data: categories.map(c => c.category)
        });
    } catch (error) {
        console.error('Error fetching categories:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching categories',
            error: error.message
        });
    }
});

module.exports = router;