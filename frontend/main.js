// API Configuration
// API Configuration
const IS_LOCALHOST = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const API_BASE_URL = IS_LOCALHOST
    ? 'http://localhost:3001/api'
    : 'https://inventoryprodemo.up.railway.app/api';

// Global state
let products = [];
let filteredProducts = [];
let currentPage = 1;
let itemsPerPage = 20;
let sortField = 'name';
let sortOrder = 'asc';
let selectedProductId = null;
let isLoading = false;

// Utility Functions
const showNotification = (message, type = 'success') => {
    const notification = document.getElementById('notification');
    const notificationIcon = document.getElementById('notificationIcon');
    const notificationMessage = document.getElementById('notificationMessage');

    // Set icon based on type
    if (type === 'success') {
        notificationIcon.innerHTML = '<svg class="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path></svg>';
    } else if (type === 'error') {
        notificationIcon.innerHTML = '<svg class="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"></path></svg>';
    }

    notificationMessage.textContent = message;
    notification.classList.add('show');

    setTimeout(() => {
        notification.classList.remove('show');
    }, 3000);
};

const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
};

const getStockStatus = (stock) => {
    if (stock === 0) return { status: 'Out of Stock', class: 'status-out-of-stock' };
    if (stock <= 10) return { status: 'Low Stock', class: 'status-low-stock' };
    return { status: 'In Stock', class: 'status-in-stock' };
};

// API Functions
const apiCall = async (endpoint, options = {}) => {
    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'API request failed');
        }

        return data;
    } catch (error) {
        console.error('API call error:', error);
        throw error;
    }
};

const fetchProducts = async (params = {}) => {
    // Filter out empty values from params
    const filteredParams = Object.fromEntries(
        Object.entries(params).filter(([_, value]) => value !== '' && value !== null && value !== undefined)
    );

    // Add sorting parameters
    filteredParams.sort = sortField;
    filteredParams.order = sortOrder;

    const queryString = new URLSearchParams(filteredParams).toString();
    return apiCall(`/products?${queryString}`);
};

const fetchStats = async (filters = {}) => {
    // Build query string with filters
    const queryParams = {};
    if (filters.category) queryParams.category = filters.category;
    if (filters.status) queryParams.status = filters.status;

    const queryString = new URLSearchParams(queryParams).toString();
    const endpoint = queryString ? `/history/summary?${queryString}` : '/history/summary';
    return apiCall(endpoint);
};

const fetchHistory = async (productId) => {
    return apiCall(`/history/product/${productId}`);
};

const addProduct = async (productData) => {
    return apiCall('/products', {
        method: 'POST',
        body: JSON.stringify(productData)
    });
};

const updateProduct = async (productId, productData) => {
    return apiCall(`/products/${productId}`, {
        method: 'PUT',
        body: JSON.stringify(productData)
    });
};

const deleteProduct = async (productId) => {
    return apiCall(`/products/${productId}`, {
        method: 'DELETE'
    });
};

const exportProducts = async () => {
    const response = await fetch(`${API_BASE_URL}/import/products`);
    if (!response.ok) {
        throw new Error('Export failed');
    }
    return response.blob();
};

const importProducts = async (file) => {
    const formData = new FormData();
    formData.append('csvFile', file);

    const response = await fetch(`${API_BASE_URL}/import/products`, {
        method: 'POST',
        body: formData
    });

    if (!response.ok) {
        throw new Error('Import failed');
    }

    return response.json();
};

// UI Rendering Functions
const renderStatsCards = (stats, filters = {}) => {
    const statsContainer = document.getElementById('statsCards');

    // Determine if filters are active
    const hasFilters = filters.category || filters.status;
    const filterLabel = hasFilters ? ' (Filtered)' : '';

    const cards = [
        {
            title: 'Total Products' + filterLabel,
            value: stats.totalProducts,
            icon: `
                <svg class="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" stroke-width="2" 
                     viewBox="0 0 24 24">
                    <path d="M3 7l9-4 9 4-9 4-9-4z"></path>
                    <path d="M3 17l9 4 9-4"></path>
                    <path d="M3 12l9 4 9-4"></path>
                </svg>
            `,
            color: 'bg-blue-50 text-blue-700'
        },
        {
            title: 'In Stock',
            value: stats.stockLevels.in_stock || 0,
            icon: `
                <svg class="w-6 h-6 text-green-600" fill="none" stroke="currentColor" stroke-width="2" 
                     viewBox="0 0 24 24">
                    <path d="M5 13l4 4L19 7"></path>
                </svg>
            `,
            color: 'bg-green-50 text-green-700'
        },
        {
            title: 'Low Stock',
            value: stats.stockLevels.low_stock || 0,
            icon: `
                <svg class="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" stroke-width="2" 
                     viewBox="0 0 24 24">
                    <path d="M10.29 3.86L1.82 18a1 1 0 0 0 .86 1.5h18.64a1 1 0 0 0 .86-1.5L13.71 3.86a1 1 0 0 0-1.72 0z"></path>
                    <line x1="12" y1="9" x2="12" y2="13"></line>
                    <line x1="12" y1="17" x2="12" y2="17"></line>
                </svg>
            `,
            color: 'bg-yellow-50 text-yellow-700'
        },
        {
            title: 'Out of Stock',
            value: stats.stockLevels.out_of_stock || 0,
            icon: `
                <svg class="w-6 h-6 text-red-600" fill="none" stroke="currentColor" stroke-width="2" 
                     viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="15" y1="9" x2="9" y2="15"></line>
                    <line x1="9" y1="9" x2="15" y2="15"></line>
                </svg>
            `,
            color: 'bg-red-50 text-red-700'
        }
    ];


    statsContainer.innerHTML = cards.map(card => `
       <div class="rounded-xl glass-panel p-6 border border-white/10 bg-slate-900/40 
            transition-all duration-300 hover:border-indigo-500/40 hover:shadow-xl">

            <div class="flex items-center">
                <div class="flex-shrink-0">
                    <span class="text-2xl">${card.icon}</span>
                </div>
                <div class="ml-4">
                    <p class="text-sm font-medium text-indigo-300">${card.title}</p>
                    <p class="text-3xl font-bold text-white">${card.value}</p>
                </div>
            </div>
        </div>
    `).join('');
};

const renderProductsTable = (products) => {
    const tbody = document.getElementById('productsTableBody');
    const loadingState = document.getElementById('loadingState');
    const emptyState = document.getElementById('emptyState');

    if (products.length === 0) {
        loadingState.classList.add('hidden');
        emptyState.classList.remove('hidden');
        tbody.innerHTML = '';
        return;
    }

    loadingState.classList.add('hidden');
    emptyState.classList.add('hidden');

    tbody.innerHTML = products.map(product => {
        const stockStatus = getStockStatus(product.stock);

        return `
            <tr class="table-row" data-product-id="${product.id}">
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="flex items-center">
                        <div class="ml-4">
                            <div class="text-sm font-medium text-slate-900">${product.name}</div>
                            <div class="text-sm text-slate-500">${product.unit || 'N/A'}</div>
                        </div>
                    </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                    ${product.category || 'N/A'}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                    ${product.brand || 'N/A'}
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="flex items-center">
                        <input 
                            type="number" 
                            value="${product.stock}" 
                            min="0"
                            class="w-20 px-2 py-1 border border-gray-300 rounded text-sm text-center"
                            onchange="updateStock(${product.id}, this.value)"
                        >
                    </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="status-badge ${stockStatus.class}">${stockStatus.status}</span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button 
                        onclick="viewHistory(${product.id})" 
                        class="text-emerald-600 hover:text-emerald-900 mr-3"
                    >
                        History
                    </button>
                    <button 
                        onclick="deleteProductConfirm(${product.id})" 
                        class="text-red-600 hover:text-red-900"
                    >
                        Delete
                    </button>
                </td>
            </tr>
        `;
    }).join('');
};

const renderPagination = (pagination) => {
    const paginationContainer = document.getElementById('pagination');

    if (!pagination || pagination.pages <= 1) {
        paginationContainer.innerHTML = '';
        return;
    }

    const { page, pages, total } = pagination;

    paginationContainer.innerHTML = `
        <div class="flex items-center justify-between w-full">
            <div class="text-sm text-slate-700">
                Showing ${(page - 1) * itemsPerPage + 1} to ${Math.min(page * itemsPerPage, total)} of ${total} products
            </div>
            <div class="flex space-x-2">
                <button 
                    onclick="changePage(${page - 1})" 
                    ${page === 1 ? 'disabled' : ''} 
                    class="px-3 py-2 text-sm font-medium text-slate-600 bg-white border border-gray-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    Previous
                </button>
                <span class="px-3 py-2 text-sm font-medium text-slate-900 bg-emerald-50 border border-emerald-300 rounded-lg">
                    ${page} of ${pages}
                </span>
                <button 
                    onclick="changePage(${page + 1})" 
                    ${page === pages ? 'disabled' : ''} 
                    class="px-3 py-2 text-sm font-medium text-slate-600 bg-white border border-gray-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    Next
                </button>
            </div>
        </div>
    `;
};

const renderHistory = (historyData) => {
    const historyContent = document.getElementById('historyContent');
    const historyProductName = document.getElementById('historyProductName');

    historyProductName.textContent = `Product: ${historyData.product.name}`;

    if (historyData.history.length === 0) {
        historyContent.innerHTML = `
            <div class="text-center py-8">
                <div class="text-slate-400 mb-2">
                    <svg class="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                </div>
                <p class="text-slate-600">No history available for this product.</p>
            </div>
        `;
        return;
    }

    historyContent.innerHTML = `
        <div class="space-y-4">
            ${historyData.history.map(entry => `
                <div class="bg-slate-50 rounded-lg p-4">
                    <div class="flex items-center justify-between mb-2">
                        <span class="text-sm font-medium text-slate-900">
                            Stock: ${entry.oldQuantity} → ${entry.newQuantity}
                        </span>
                        <span class="text-sm text-slate-600">
                            ${entry.changeAmount > 0 ? '+' : ''}${entry.changeAmount}
                        </span>
                    </div>
                    <div class="text-xs text-slate-500 mb-1">
                        ${formatDate(entry.changeDate)}
                    </div>
                    ${entry.reason ? `
                        <div class="text-xs text-slate-600">
                            Reason: ${entry.reason}
                        </div>
                    ` : ''}
                </div>
            `).join('')}
        </div>
    `;
};

// Event Handlers
const loadProducts = async (params = {}) => {
    if (isLoading) return;

    isLoading = true;
    const loadingState = document.getElementById('loadingState');
    loadingState.classList.remove('hidden');

    try {
        const response = await fetchProducts({
            page: currentPage,
            limit: itemsPerPage,
            ...params
        });

        products = response.data;
        filteredProducts = products;

        renderProductsTable(products);
        renderPagination(response.pagination);

        // Update sort indicators
        updateSortIndicators();

        // Update category filter options
        await updateCategoryFilter();

        // Update stats with current filters
        const currentFilters = {
            category: params.category || document.getElementById('categoryFilter')?.value || '',
            status: params.status || document.getElementById('statusFilter')?.value || ''
        };
        loadStats(currentFilters);

    } catch (error) {
        console.error('Error loading products:', error);
        showNotification('Failed to load products', 'error');
    } finally {
        isLoading = false;
        loadingState.classList.add('hidden');
    }
};

const loadStats = async (filters = {}) => {
    try {
        // Get current filter values if not provided
        const currentFilters = filters.category !== undefined ? filters : {
            category: document.getElementById('categoryFilter')?.value || '',
            status: document.getElementById('statusFilter')?.value || ''
        };

        const stats = await fetchStats(currentFilters);
        renderStatsCards(stats.data, currentFilters);
    } catch (error) {
        console.error('Error loading stats:', error);
    }
};

const updateCategoryFilter = async () => {
    const categoryFilter = document.getElementById('categoryFilter');
    try {
        const response = await apiCall('/products/categories/all');
        const categories = response.data;

        categoryFilter.innerHTML = '<option value="">All Categories</option>' +
            categories.map(category => `<option value="${category}">${category}</option>`).join('');
    } catch (error) {
        console.error('Error loading categories:', error);
    }
};

const searchProducts = () => {
    const searchTerm = document.getElementById('searchInput').value;
    const category = document.getElementById('categoryFilter').value;
    const status = document.getElementById('statusFilter').value;

    currentPage = 1;
    const filters = {
        name: searchTerm,
        category,
        status
    };

    loadProducts(filters);
    // Stats will be updated automatically in loadProducts
};

const changePage = (page) => {
    if (page < 1) return;

    currentPage = page;
    loadProducts();
};

// Make handleSort globally accessible for onclick handlers
window.handleSort = (field) => {
    // If clicking the same field, toggle order; otherwise set new field and default to asc
    if (sortField === field) {
        sortOrder = sortOrder === 'asc' ? 'desc' : 'asc';
    } else {
        sortField = field;
        sortOrder = 'asc';
    }

    // Reset to first page when sorting changes
    currentPage = 1;

    // Update sort indicators
    updateSortIndicators();

    // Reload products with new sort
    loadProducts();
};

const updateSortIndicators = () => {
    // Remove all active classes
    const indicators = document.querySelectorAll('.sort-indicator');
    indicators.forEach(indicator => {
        indicator.classList.remove('active', 'asc', 'desc');
    });

    // Add active class and direction to current sort field
    const activeIndicator = document.getElementById(`sort-${sortField}`);
    if (activeIndicator) {
        activeIndicator.classList.add('active', sortOrder);
    }
};

const updateStock = async (productId, newStock) => {
    try {
        const stock = parseInt(newStock);
        if (stock < 0) {
            showNotification('Stock cannot be negative', 'error');
            return;
        }

        await updateProduct(productId, { stock });
        showNotification('Stock updated successfully');

        // Reload products and stats
        loadProducts();
        loadStats();

    } catch (error) {
        console.error('Error updating stock:', error);
        const errorMessage = error.message || 'Failed to update stock';
        showNotification(errorMessage, 'error');
    }
};

const viewHistory = async (productId) => {
    try {
        const historyData = await fetchHistory(productId);
        renderHistory(historyData.data);

        const sidebar = document.getElementById('historySidebar');
        sidebar.classList.add('open');

    } catch (error) {
        console.error('Error loading history:', error);
        showNotification('Failed to load history', 'error');
    }
};

const deleteProductConfirm = async (productId) => {
    if (!confirm('Are you sure you want to delete this product?')) {
        return;
    }

    try {
        await deleteProduct(productId);
        showNotification('Product deleted successfully');

        // Reload products and stats
        loadProducts();
        loadStats();

    } catch (error) {
        console.error('Error deleting product:', error);
        const errorMessage = error.message || 'Failed to delete product';
        showNotification(errorMessage, 'error');
    }
};

const openAddProductModal = () => {
    const modal = document.getElementById('addProductModal');
    modal.classList.add('show');

    // Reset form
    document.getElementById('addProductForm').reset();
};

const closeAddProductModal = () => {
    const modal = document.getElementById('addProductModal');
    modal.classList.remove('show');
};

const handleAddProduct = async (event) => {
    event.preventDefault();

    const formData = new FormData(event.target);
    const productData = {
        name: document.getElementById('productName').value,
        category: document.getElementById('productCategory').value,
        brand: document.getElementById('productBrand').value,
        unit: document.getElementById('productUnit').value,
        stock: parseInt(document.getElementById('productStock').value),
        image: document.getElementById('productImage').value || null
    };

    try {
        await addProduct(productData);
        showNotification('Product added successfully');

        closeAddProductModal();

        // Reload products and stats
        loadProducts();
        loadStats();

    } catch (error) {
        console.error('Error adding product:', error);
        // Show the actual error message from the API
        const errorMessage = error.message || 'Failed to add product';
        showNotification(errorMessage, 'error');
    }
};

const handleExport = async () => {
    try {
        const blob = await exportProducts();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `products-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        showNotification('Products exported successfully');

    } catch (error) {
        console.error('Error exporting products:', error);
        showNotification('Failed to export products', 'error');
    }
};

const handleImport = () => {
    document.getElementById('fileInput').click();
};

const handleFileSelect = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
        showNotification('Please select a CSV file', 'error');
        return;
    }

    try {
        const result = await importProducts(file);

        if (result.success) {
            showNotification(`${result.data.added} products imported successfully`);

            // Reload products and stats
            loadProducts();
            loadStats();
        }

        if (result.data.errors && result.data.errors.length > 0) {
            showNotification(`${result.data.skipped} products were skipped due to errors`, 'error');
        }

    } catch (error) {
        console.error('Error importing products:', error);
        showNotification('Failed to import products', 'error');
    }

    // Reset file input
    event.target.value = '';
};

// Initialize Dashboard
const initializeDashboard = () => {
    // Set up event listeners
    document.getElementById('searchInput').addEventListener('input', debounce(searchProducts, 300));
    document.getElementById('categoryFilter').addEventListener('change', searchProducts);
    document.getElementById('statusFilter').addEventListener('change', searchProducts);
    document.getElementById('clearFilters').addEventListener('click', () => {
        document.getElementById('searchInput').value = '';
        document.getElementById('categoryFilter').value = '';
        document.getElementById('statusFilter').value = '';
        searchProducts();
    });

    document.getElementById('addProductBtn').addEventListener('click', openAddProductModal);
    document.getElementById('closeModal').addEventListener('click', closeAddProductModal);
    document.getElementById('cancelAdd').addEventListener('click', closeAddProductModal);
    document.getElementById('addProductForm').addEventListener('submit', handleAddProduct);

    document.getElementById('exportBtn').addEventListener('click', handleExport);
    document.getElementById('importBtn').addEventListener('click', handleImport);
    document.getElementById('fileInput').addEventListener('change', handleFileSelect);

    document.getElementById('closeSidebar').addEventListener('click', () => {
        document.getElementById('historySidebar').classList.remove('open');
    });

    // Close sidebar when clicking outside
    document.addEventListener('click', (event) => {
        const sidebar = document.getElementById('historySidebar');
        if (!sidebar.contains(event.target) && !event.target.closest('[onclick*="viewHistory"]')) {
            sidebar.classList.remove('open');
        }
    });

    // Initialize animations
    initializeAnimations();

    // Load initial data
    loadProducts();
    loadStats();
};

// Utility function for debouncing
const debounce = (func, wait) => {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
};

// Animation initialization
const initializeAnimations = () => {
    // Animate dashboard title
    if (typeof Typed !== 'undefined') {
        const dashboardTitle = document.getElementById('dashboardTitle');
        if (dashboardTitle) {
            new Typed('#dashboardTitle', {
                strings: ['Dashboard', 'Inventory Dashboard', 'Smart Dashboard'],
                typeSpeed: 50,
                backSpeed: 30,
                backDelay: 2000,
                loop: false,
                showCursor: false
            });
        }
    }

    // Animate stats cards
    setTimeout(() => {
        const cards = document.querySelectorAll('.fade-in');
        cards.forEach((card, index) => {
            setTimeout(() => {
                card.style.opacity = '1';
                card.style.transform = 'translateY(0)';
            }, index * 100);
        });
    }, 500);
};

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    initializeDashboard();
    // Initialize sort indicators on load
    updateSortIndicators();
});
