const express = require('express');
const router = express.Router();
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
const Database = require('../database/connection');
const upload = require('../middleware/upload');

// Import products from CSV
router.post('/products', upload.single('csvFile'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No CSV file uploaded'
            });
        }

        const db = new Database();
        await db.connect();

        const results = [];
        const errors = [];
        let processed = 0;
        let added = 0;
        let skipped = 0;

        const filePath = req.file.path;

        // Read and parse CSV file
        const parseCSV = () => {
            return new Promise((resolve, reject) => {
                fs.createReadStream(filePath)
                    .pipe(csv({
                        mapHeaders: ({ header }) => header.trim(),
                        mapValues: ({ value }) => value.trim()
                    }))
                    .on('data', async (data) => {
                        results.push(data);
                    })
                    .on('end', () => {
                        resolve(results);
                    })
                    .on('error', (error) => {
                        reject(error);
                    });
            });
        };

        try {
            const csvData = await parseCSV();

            // Process each row
            for (const row of csvData) {
                processed++;

                try {
                    // Validate required fields
                    if (!row.name) {
                        errors.push({ row: processed, error: 'Product name is required', data: row });
                        skipped++;
                        continue;
                    }

                    // Check if product already exists
                    const existingProduct = await db.get('SELECT id FROM products WHERE name = ?', [row.name]);
                    
                    if (existingProduct) {
                        errors.push({ 
                            row: processed, 
                            error: 'Product with this name already exists', 
                            data: row,
                            action: 'skipped'
                        });
                        skipped++;
                        continue;
                    }

                    // Parse and validate data
                    const product = {
                        name: row.name,
                        unit: row.unit || null,
                        category: row.category || null,
                        brand: row.brand || null,
                        stock: parseInt(row.stock) || 0,
                        status: row.status || 'active',
                        image: row.image || null
                    };

                    // Validate stock
                    if (product.stock < 0) {
                        errors.push({ 
                            row: processed, 
                            error: 'Stock cannot be negative', 
                            data: row 
                        });
                        skipped++;
                        continue;
                    }

                    // Insert product
                    const result = await db.run(
                        'INSERT INTO products (name, unit, category, brand, stock, status, image) VALUES (?, ?, ?, ?, ?, ?, ?)',
                        [product.name, product.unit, product.category, product.brand, product.stock, product.status, product.image]
                    );

                    // Add inventory history
                    if (product.stock > 0) {
                        await db.run(
                            'INSERT INTO inventory_history (product_id, old_quantity, new_quantity, change_amount, reason) VALUES (?, ?, ?, ?, ?)',
                            [result.id, 0, product.stock, product.stock, 'Imported from CSV']
                        );
                    }

                    added++;

                } catch (error) {
                    errors.push({ 
                        row: processed, 
                        error: error.message, 
                        data: row 
                    });
                    skipped++;
                }
            }

        } catch (csvError) {
            await db.close();
            // Clean up uploaded file
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
            
            return res.status(400).json({
                success: false,
                message: 'Error parsing CSV file',
                error: csvError.message
            });
        }

        // Clean up uploaded file
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        await db.close();

        res.json({
            success: true,
            message: 'CSV import completed',
            data: {
                processed,
                added,
                skipped,
                errors: errors.length > 0 ? errors : undefined
            }
        });

    } catch (error) {
        console.error('Error importing products:', error);
        
        // Clean up uploaded file
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }

        res.status(500).json({
            success: false,
            message: 'Error importing products',
            error: error.message
        });
    }
});

// Export products to CSV
router.get('/products', async (req, res) => {
    try {
        const db = new Database();
        await db.connect();

        const products = await db.all('SELECT * FROM products ORDER BY name');

        await db.close();

        if (products.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'No products found to export'
            });
        }

        // Create CSV content
        const headers = ['id', 'name', 'unit', 'category', 'brand', 'stock', 'status', 'image', 'created_at', 'updated_at'];
        const csvContent = [
            headers.join(','),
            ...products.map(product => {
                const values = headers.map(header => {
                    const value = product[header];
                    // Escape quotes and wrap in quotes if contains comma
                    if (value && typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
                        return `"${value.replace(/"/g, '""')}"`;
                    }
                    return value || '';
                });
                return values.join(',');
            })
        ].join('\n');

        // Set response headers for file download
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="products.csv"');
        res.setHeader('Content-Length', Buffer.byteLength(csvContent));

        res.send(csvContent);

    } catch (error) {
        console.error('Error exporting products:', error);
        res.status(500).json({
            success: false,
            message: 'Error exporting products',
            error: error.message
        });
    }
});

module.exports = router;