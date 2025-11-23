const express = require('express');
const router = express.Router();
const Database = require('../database/connection');
const { validate, historyValidationRules } = require('../middleware/validation');

// Get inventory history for a specific product
router.get('/product/:productId', historyValidationRules(), validate, async (req, res) => {
    try {
        const db = new Database();
        await db.connect();

        const productId = req.params.productId;

        // Verify product exists
        const product = await db.get('SELECT id, name FROM products WHERE id = ?', [productId]);
        if (!product) {
            await db.close();
            return res.status(404).json({
                success: false,
                message: 'Product not found'
            });
        }

        // Get inventory history ordered by date (newest first)
        const history = await db.all(
            `SELECT 
                h.*,
                p.name as product_name
            FROM inventory_history h
            JOIN products p ON h.product_id = p.id
            WHERE h.product_id = ?
            ORDER BY h.change_date DESC`,
            [productId]
        );

        await db.close();

        res.json({
            success: true,
            data: {
                product: {
                    id: product.id,
                    name: product.name
                },
                history: history.map(entry => ({
                    id: entry.id,
                    oldQuantity: entry.old_quantity,
                    newQuantity: entry.new_quantity,
                    changeAmount: entry.change_amount,
                    changeDate: entry.change_date,
                    userInfo: entry.user_info,
                    reason: entry.reason
                }))
            }
        });

    } catch (error) {
        console.error('Error fetching inventory history:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching inventory history',
            error: error.message
        });
    }
});

// Get all inventory history (admin view)
router.get('/', async (req, res) => {
    try {
        const db = new Database();
        await db.connect();

        const { page = 1, limit = 50, productId, startDate, endDate } = req.query;
        const offset = (page - 1) * limit;

        let whereClause = '';
        let params = [];

        if (productId) {
            whereClause += ' AND h.product_id = ?';
            params.push(productId);
        }

        if (startDate) {
            whereClause += ' AND h.change_date >= ?';
            params.push(startDate);
        }

        if (endDate) {
            whereClause += ' AND h.change_date <= ?';
            params.push(endDate);
        }

        const sql = `
            SELECT 
                h.*,
                p.name as product_name
            FROM inventory_history h
            JOIN products p ON h.product_id = p.id
            WHERE 1=1 ${whereClause}
            ORDER BY h.change_date DESC
            LIMIT ? OFFSET ?
        `;

        params.push(parseInt(limit), parseInt(offset));

        const history = await db.all(sql, params);

        // Get total count for pagination
        const countSql = `
            SELECT COUNT(*) as total 
            FROM inventory_history h
            JOIN products p ON h.product_id = p.id
            WHERE 1=1 ${whereClause}
        `;
        const countParams = params.slice(0, -2); // Remove limit and offset
        const countResult = await db.get(countSql, countParams);

        await db.close();

        res.json({
            success: true,
            data: history.map(entry => ({
                id: entry.id,
                productId: entry.product_id,
                productName: entry.product_name,
                oldQuantity: entry.old_quantity,
                newQuantity: entry.new_quantity,
                changeAmount: entry.change_amount,
                changeDate: entry.change_date,
                userInfo: entry.user_info,
                reason: entry.reason
            })),
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: countResult.total,
                pages: Math.ceil(countResult.total / limit)
            }
        });

    } catch (error) {
        console.error('Error fetching inventory history:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching inventory history',
            error: error.message
        });
    }
});

// Get inventory summary/statistics
router.get('/summary', async (req, res) => {
    try {
        const db = new Database();
        await db.connect();

        // Get filter parameters from query
        const { category, status } = req.query;

        // Build WHERE clause for filters
        let whereClause = '';
        let params = [];

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

        // Get total products count with filters
        const totalProducts = await db.get(
            `SELECT COUNT(*) as count FROM products WHERE 1=1 ${whereClause}`,
            params
        );

        // Get products by status (for filtered data)
        const statusStats = await db.all(
            `SELECT status, COUNT(*) as count FROM products WHERE 1=1 ${whereClause} GROUP BY status`,
            params
        );

        // Get stock level statistics with filters
        const stockStats = await db.all(`
            SELECT 
                CASE 
                    WHEN stock = 0 THEN 'out_of_stock'
                    WHEN stock <= 10 THEN 'low_stock'
                    WHEN stock > 10 THEN 'in_stock'
                END as stock_level,
                COUNT(*) as count
            FROM products
            WHERE 1=1 ${whereClause}
            GROUP BY stock_level
        `, params);

        // Get recent activity (last 30 days) - can be filtered by category if needed
        let activityWhereClause = '';
        let activityParams = [];
        
        if (category) {
            activityWhereClause = `
                AND product_id IN (
                    SELECT id FROM products WHERE category = ?
                )
            `;
            activityParams.push(category);
        }

        const recentActivity = await db.get(`
            SELECT COUNT(*) as count
            FROM inventory_history
            WHERE change_date >= datetime('now', '-30 days') ${activityWhereClause}
        `, activityParams);

        // Get total inventory value with filters
        const totalValue = await db.get(
            `SELECT SUM(stock) as total FROM products WHERE 1=1 ${whereClause}`,
            params
        );

        await db.close();

        res.json({
            success: true,
            data: {
                totalProducts: totalProducts.count,
                statusDistribution: statusStats.reduce((acc, stat) => {
                    acc[stat.status] = stat.count;
                    return acc;
                }, {}),
                stockLevels: stockStats.reduce((acc, stat) => {
                    acc[stat.stock_level] = stat.count;
                    return acc;
                }, {}),
                recentActivity: recentActivity.count,
                totalInventoryValue: totalValue.total || 0
            }
        });

    } catch (error) {
        console.error('Error fetching inventory summary:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching inventory summary',
            error: error.message
        });
    }
});

module.exports = router;