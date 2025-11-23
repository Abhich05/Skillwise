const { body, param, query, validationResult } = require('express-validator');

// Validation middleware
const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            errors: errors.array()
        });
    }
    next();
};

// Product validation rules
const productValidationRules = () => {
    return [
        body('name')
            .trim()
            .isLength({ min: 1, max: 255 })
            .withMessage('Product name must be between 1 and 255 characters'),
        body('unit')
            .optional()
            .trim()
            .isLength({ max: 50 })
            .withMessage('Unit must be less than 50 characters'),
        body('category')
            .optional()
            .trim()
            .isLength({ max: 100 })
            .withMessage('Category must be less than 100 characters'),
        body('brand')
            .optional()
            .trim()
            .isLength({ max: 100 })
            .withMessage('Brand must be less than 100 characters'),
        body('stock')
            .isInt({ min: 0 })
            .withMessage('Stock must be a non-negative integer'),
        body('status')
            .optional()
            .isIn(['active', 'inactive', 'discontinued'])
            .withMessage('Status must be active, inactive, or discontinued'),
        body('image')
            .optional({ nullable: true, checkFalsy: true })
            .custom((value) => {
                if (!value || value === '') return true;
                try {
                    new URL(value);
                    return true;
                } catch {
                    return false;
                }
            })
            .withMessage('Image must be a valid URL')
    ];
};

// Update product validation rules
const updateProductValidationRules = () => {
    return [
        param('id')
            .isInt({ min: 1 })
            .withMessage('Product ID must be a positive integer'),
        body('name')
            .optional()
            .trim()
            .isLength({ min: 1, max: 255 })
            .withMessage('Product name must be between 1 and 255 characters'),
        body('unit')
            .optional()
            .trim()
            .isLength({ max: 50 })
            .withMessage('Unit must be less than 50 characters'),
        body('category')
            .optional()
            .trim()
            .isLength({ max: 100 })
            .withMessage('Category must be less than 100 characters'),
        body('brand')
            .optional()
            .trim()
            .isLength({ max: 100 })
            .withMessage('Brand must be less than 100 characters'),
        body('stock')
            .optional()
            .isInt({ min: 0 })
            .withMessage('Stock must be a non-negative integer'),
        body('status')
            .optional()
            .isIn(['active', 'inactive', 'discontinued'])
            .withMessage('Status must be active, inactive, or discontinued'),
        body('image')
            .optional({ nullable: true, checkFalsy: true })
            .custom((value) => {
                if (!value || value === '') return true;
                try {
                    new URL(value);
                    return true;
                } catch {
                    return false;
                }
            })
            .withMessage('Image must be a valid URL')
    ];
};

// Search validation rules
const searchValidationRules = () => {
    return [
        query('name')
            .optional({ checkFalsy: true })
            .trim()
            .custom((value) => {
                if (!value || value === '') return true;
                return value.length >= 1 && value.length <= 255;
            })
            .withMessage('Search name must be between 1 and 255 characters'),
        query('category')
            .optional({ checkFalsy: true })
            .trim()
            .custom((value) => {
                if (!value || value === '') return true;
                return value.length <= 100;
            })
            .withMessage('Category must be less than 100 characters'),
        query('status')
            .optional({ checkFalsy: true })
            .isIn(['in_stock', 'low_stock', 'out_of_stock'])
            .withMessage('Status must be in_stock, low_stock, or out_of_stock'),
        query('page')
            .optional({ checkFalsy: true })
            .isInt({ min: 1 })
            .withMessage('Page must be a positive integer'),
        query('limit')
            .optional({ checkFalsy: true })
            .isInt({ min: 1, max: 100 })
            .withMessage('Limit must be between 1 and 100'),
        query('sort')
            .optional({ checkFalsy: true })
            .isIn(['name', 'category', 'brand', 'stock', 'status', 'created_at', 'updated_at'])
            .withMessage('Sort field must be one of: name, category, brand, stock, status, created_at, updated_at'),
        query('order')
            .optional({ checkFalsy: true })
            .isIn(['asc', 'desc'])
            .withMessage('Order must be either asc or desc')
    ];
};

// History validation rules
const historyValidationRules = () => {
    return [
        param('productId')
            .isInt({ min: 1 })
            .withMessage('Product ID must be a positive integer')
    ];
};

module.exports = {
    validate,
    productValidationRules,
    updateProductValidationRules,
    searchValidationRules,
    historyValidationRules
};