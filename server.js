const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

// DEBUG: List files to diagnose deployment issues
try {
    console.log('Current directory:', __dirname);
    console.log('Files in root:', fs.readdirSync(__dirname));
    if (fs.existsSync(path.join(__dirname, 'database'))) {
        console.log('Files in database:', fs.readdirSync(path.join(__dirname, 'database')));
    } else {
        console.log('Database directory NOT FOUND at:', path.join(__dirname, 'database'));
    }
} catch (e) {
    console.error('Error listing files:', e);
}

const Database = require('./database/connection');

// Import routes
const productsRouter = require('./routes/products');
const importRouter = require('./routes/import');
const historyRouter = require('./routes/history');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
const allowedOrigins = process.env.FRONTEND_URL
    ? [process.env.FRONTEND_URL]
    : ['http://localhost:3000', 'http://localhost:3001'];

app.use(cors({
    origin: true, // Allow all origins
    credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files (uploads)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Serve frontend static files
app.use(express.static(path.join(__dirname, 'frontend')));

// Request logging middleware
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// Routes
app.use('/api/products', productsRouter);
app.use('/api/import', importRouter);
app.use('/api/history', historyRouter);

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        message: 'Inventory Management API is running',
        timestamp: new Date().toISOString()
    });
});

// Serve frontend index.html for root route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err);

    if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({
            success: false,
            message: 'File too large. Maximum size is 5MB'
        });
    }

    res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Internal server error'
    });
});

// 404 handler - serve frontend for non-API routes, JSON for API routes
app.use((req, res) => {
    if (req.path.startsWith('/api')) {
        res.status(404).json({
            success: false,
            message: 'API endpoint not found'
        });
    } else {
        // Serve frontend for client-side routing
        res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
    }
});

// Initialize database and start server
async function startServer() {
    try {
        const db = new Database();
        await db.connect();
        await db.initialize();
        await db.close();

        console.log('Database initialized successfully');

        app.listen(PORT, () => {
            console.log(`Server is running on port ${PORT}`);
            console.log(`API available at http://localhost:${PORT}/api`);
        });

    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('Shutting down server...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('Shutting down server...');
    process.exit(0);
});

// Start the server
startServer();
