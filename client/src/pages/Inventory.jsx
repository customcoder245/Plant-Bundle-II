import React, { useState, useEffect } from 'react';
import {
    Page, Card, ResourceList, ResourceItem,
    TextField, Button, InlineStack, Badge, Text,
    Banner, BlockStack, Box, Divider, EmptyState,
    SkeletonBodyText, Tabs, Layout
} from '@shopify/polaris';
import { SaveIcon, RefreshIcon, SearchIcon } from '@shopify/polaris-icons';
import { Box as BoxIcon, AlertTriangle } from 'lucide-react';

// ─── RECENT MOVEMENTS COMPONENT ────────────────────────────────────────────────
function RecentMovements() {
    const [movements, setMovements] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchMovements = async () => {
            try {
                const res = await fetch('/api/activity?event_type=INVENTORY_DEDUCTED&limit=5');
                const data = await res.json();
                setMovements(Array.isArray(data) ? data : []);
            } catch (e) { console.error(e); }
            finally { setLoading(false); }
        };
        fetchMovements();
    }, []);

    if (loading) return <SkeletonBodyText lines={3} />;
    if (movements.length === 0) return null;

    return (
        <Card>
            <Box padding="400">
                <BlockStack gap="300">
                    <InlineStack gap="200">
                        <AlertTriangle size={18} color="#c05621" />
                        <Text variant="headingSm">Recent Stock Deductions</Text>
                    </InlineStack>
                    <Divider />
                    {movements.map((m, i) => (
                        <div key={i} style={{ padding: '8px 0', borderBottom: i < movements.length - 1 ? '1px solid #f1f2f3' : 'none' }}>
                            <InlineStack align="space-between">
                                <BlockStack gap="050">
                                    <Text variant="bodyMd" fontWeight="semibold">{m.description}</Text>
                                    <Text variant="bodyXs" tone="subdued">{new Date(m.created_at).toLocaleString()}</Text>
                                </BlockStack>
                                <Badge tone="warning">- {m.metadata?.quantity || 1}</Badge>
                            </InlineStack>
                        </div>
                    ))}
                </BlockStack>
            </Box>
        </Card>
    );
}

// ─── POT STOCK TAB ─────────────────────────────────────────────────────────────
function PotStockTab() {
    const [inventory, setInventory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editedQuantities, setEditedQuantities] = useState({});
    const [saving, setSaving] = useState(false);
    const [queryValue, setQueryValue] = useState('');
    const [syncing, setSyncing] = useState(false);
    const [syncBanner, setSyncBanner] = useState(null);

    useEffect(() => { fetchInventory(); }, []);

    const fetchInventory = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/inventory');
            const data = await res.json();
            setInventory(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error('Failed to fetch inventory:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSyncShopifyPots = async () => {
        setSyncing(true);
        setSyncBanner(null);
        try {
            const res = await fetch('/api/inventory/sync-pots', { method: 'POST' });
            const data = await res.json();
            if (res.ok && data.success) {
                setSyncBanner({
                    tone: 'success',
                    title: 'Inventory Sync Complete',
                    content: `Successfully synced ${data.updatedCount} pot variants from Shopify and pushed them to bundle products.`
                });
                fetchInventory();
            } else {
                throw new Error(data.error || 'Failed to synchronize pots.');
            }
        } catch (error) {
            console.error('Pots sync error:', error);
            setSyncBanner({
                tone: 'critical',
                title: 'Sync Failed',
                content: error.message
            });
        } finally {
            setSyncing(false);
        }
    };

    const handleQuantityChange = (id, value) => {
        setEditedQuantities({ ...editedQuantities, [id]: value === '' ? '' : parseInt(value) || 0 });
    };

    const handleSaveAll = async () => {
        setSaving(true);
        try {
            const updates = Object.entries(editedQuantities)
                .filter(([_, qty]) => qty !== '')
                .map(([id, quantity]) => ({ id: parseInt(id), quantity }));
            const res = await fetch('/api/inventory/bulk-update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ updates })
            });
            if (res.ok) { setEditedQuantities({}); fetchInventory(); }
        } catch (error) {
            console.error('Failed to save inventory:', error);
        } finally {
            setSaving(false);
        }
    };

    const lowStockItems = inventory.filter(i => i.is_low_stock);
    const hasChanges = Object.keys(editedQuantities).length > 0;
    const filteredInventory = inventory.filter(item =>
        item.color_name?.toLowerCase().includes(queryValue.toLowerCase()) ||
        item.size?.toLowerCase().includes(queryValue.toLowerCase())
    );

    if (loading && inventory.length === 0) return <SkeletonBodyText lines={15} />;

    return (
        <Layout>
            <Layout.Section>
                <BlockStack gap="500">
                    <InlineStack align="end" gap="200">
                        <Button onClick={handleSyncShopifyPots} loading={syncing} icon={RefreshIcon} variant="secondary">Sync Pots from Shopify</Button>
                        <Button onClick={fetchInventory} icon={RefreshIcon} variant="tertiary">Refresh</Button>
                        <Button onClick={handleSaveAll} loading={saving} disabled={!hasChanges} icon={SaveIcon} variant="primary">
                            Save Inventory
                        </Button>
                    </InlineStack>

                    {syncBanner && (
                        <Banner
                            tone={syncBanner.tone}
                            title={syncBanner.title}
                            onDismiss={() => setSyncBanner(null)}
                        >
                            <p>{syncBanner.content}</p>
                        </Banner>
                    )}

                    {lowStockItems.length > 0 && (
                        <Banner tone="warning" title={`${lowStockItems.length} items are low on stock`}>
                            <p>Customers might see "Out of Stock" messages for these pot options soon.</p>
                        </Banner>
                    )}

                    <Card padding="0">
                        <Box padding="400">
                            <BlockStack gap="400">
                                <InlineStack align="space-between" blockAlign="center">
                                    <InlineStack gap="200">
                                        <BoxIcon size={20} color="#636363" />
                                        <Text variant="headingMd">Stock Levels</Text>
                                    </InlineStack>
                                    {hasChanges && <Badge tone="attention">Unsaved changes</Badge>}
                                </InlineStack>
                                <TextField
                                    prefix={<SearchIcon style={{ width: 18 }} />}
                                    placeholder="Filter by color or size..."
                                    value={queryValue}
                                    onChange={setQueryValue}
                                    autoComplete="off"
                                    clearButton
                                    onClearButtonClick={() => setQueryValue('')}
                                />
                            </BlockStack>
                        </Box>
                        <Divider />
                        <ResourceList
                            resourceName={{ singular: 'stock item', plural: 'stock items' }}
                            items={filteredInventory}
                            renderItem={(item) => (
                                <ResourceItem id={item.id.toString()}>
                                    <InlineStack align="space-between" blockAlign="center">
                                        <InlineStack gap="400" blockAlign="center">
                                            <div style={{
                                                width: 40, height: 40,
                                                backgroundColor: item.hex_code || (item.color_name.toLowerCase().includes('white') ? '#FFFFFF' : '#cccccc'),
                                                borderRadius: 8,
                                                border: (item.hex_code?.toLowerCase() === '#ffffff' || item.color_name.toLowerCase().includes('white'))
                                                    ? '1px solid #dfe3e8'
                                                    : '2px solid rgba(0,0,0,0.05)',
                                                boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.1)'
                                            }} />
                                            <BlockStack gap="050">
                                                <Text variant="bodyMd" fontWeight="bold">{item.color_name}</Text>
                                                <Text tone="subdued" variant="bodySm">Size: {item.size}</Text>
                                            </BlockStack>
                                        </InlineStack>
                                        <InlineStack gap="400" blockAlign="center">
                                            <div style={{ width: '120px' }}>
                                                <TextField
                                                    type="number" label="In Stock" labelHidden
                                                    value={(editedQuantities[item.id] !== undefined ? editedQuantities[item.id] : item.quantity).toString()}
                                                    onChange={(val) => handleQuantityChange(item.id, val)}
                                                    autoComplete="off" suffix="Units" align="right"
                                                />
                                            </div>
                                            <div style={{ minWidth: '100px', textAlign: 'right' }}>
                                                {item.is_low_stock
                                                    ? <Badge tone="warning">Low Stock</Badge>
                                                    : <Badge tone="success">Healthy</Badge>
                                                }
                                            </div>
                                        </InlineStack>
                                    </InlineStack>
                                </ResourceItem>
                            )}
                            emptyState={(
                                <EmptyState
                                    heading="No matching inventory"
                                    image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                                >
                                    <p>Adjust your filters or add new pot colors in the Colors tab.</p>
                                </EmptyState>
                            )}
                        />
                    </Card>
                </BlockStack>
            </Layout.Section>

            <Layout.Section variant="oneThird">
                <RecentMovements />
            </Layout.Section>
        </Layout>
    );
}

// ─── SHOPIFY PRODUCTS TAB ───────────────────────────────────────────────────────
function ShopifyProductsTab() {
    const [products, setProducts] = useState([]);
    const [configuredIds, setConfiguredIds] = useState(new Set());
    const [loading, setLoading] = useState(true);
    const [addingId, setAddingId] = useState(null);
    const [queryValue, setQueryValue] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const [errorMsg, setErrorMsg] = useState('');

    useEffect(() => { fetchAll(); }, []);

    const fetchAll = async () => {
        setLoading(true);
        setErrorMsg('');
        try {
            const [prodRes, configRes] = await Promise.all([
                fetch('/api/products'),
                fetch('/api/product-config')
            ]);
            const prodData = await prodRes.json();
            const configData = await configRes.json();
            if (!prodRes.ok) throw new Error(prodData.error || 'Failed to load products');
            setProducts(Array.isArray(prodData) ? prodData : []);
            const ids = new Set(Array.isArray(configData) ? configData.map(c => String(c.shopify_product_id)) : []);
            setConfiguredIds(ids);
        } catch (error) {
            console.error('Failed to fetch products:', error);
            setErrorMsg(error.message || 'Could not connect to Shopify. Check your API token in .env');
        } finally {
            setLoading(false);
        }
    };

    const handleAddToBundle = async (product) => {
        setAddingId(product.id);
        setSuccessMsg('');
        setErrorMsg('');
        try {
            const size_mappings = (product.variants || []).map(v => ({
                shopify_variant_id: v.id,
                variant_title: v.title,
                pot_size: v.title === 'Default Title' ? 'Medium' : v.title
            }));
            const res = await fetch('/api/product-config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    shopify_product_id: product.id,
                    product_title: product.title,
                    no_pot_discount: 10.00,
                    size_mappings
                })
            });
            if (res.ok) {
                setConfiguredIds(prev => new Set([...prev, String(product.id)]));
                setSuccessMsg(`✅ "${product.title}" added to bundle config!`);
                setTimeout(() => setSuccessMsg(''), 4000);
            } else {
                const err = await res.json();
                throw new Error(err.error || 'Failed');
            }
        } catch (error) {
            setErrorMsg(`❌ ${error.message}`);
            setTimeout(() => setErrorMsg(''), 5000);
        } finally {
            setAddingId(null);
        }
    };

    const filteredProducts = products.filter(p =>
        p.title?.toLowerCase().includes(queryValue.toLowerCase()) ||
        p.product_type?.toLowerCase().includes(queryValue.toLowerCase())
    );

    if (loading) {
        return (
            <Card>
                <Box padding="800">
                    <BlockStack gap="400" align="center">
                        <div style={{ textAlign: 'center' }}>
                            <div style={{
                                width: 48, height: 48, border: '4px solid #e4e5e7',
                                borderTop: '4px solid #008060', borderRadius: '50%',
                                animation: 'spin 0.8s linear infinite', margin: '0 auto 16px'
                            }} />
                            <Text tone="subdued">Loading Shopify products…</Text>
                        </div>
                    </BlockStack>
                </Box>
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </Card>
        );
    }

    return (
        <BlockStack gap="400">
            {successMsg && <Banner tone="success"><p>{successMsg}</p></Banner>}
            {errorMsg && <Banner tone="critical" title="Error"><p>{errorMsg}</p></Banner>}

            <InlineStack align="end" gap="200">
                <Button onClick={fetchAll} icon={RefreshIcon} variant="tertiary">Refresh</Button>
            </InlineStack>

            <Banner tone="info">
                <p>All products from your Shopify store are shown below with their images and variants.
                    Click <strong>Add to Bundle</strong> to enable pot-bundling for that product.</p>
            </Banner>

            <Card padding="0">
                <Box padding="400">
                    <InlineStack align="space-between" blockAlign="center">
                        <InlineStack gap="200">
                            <Text variant="headingMd">All Shopify Products</Text>
                            <Badge>{products.length} products</Badge>
                        </InlineStack>
                    </InlineStack>
                    <div style={{ marginTop: 12 }}>
                        <TextField
                            prefix={<SearchIcon style={{ width: 18 }} />}
                            placeholder="Search products..."
                            value={queryValue}
                            onChange={setQueryValue}
                            autoComplete="off"
                            clearButton
                            onClearButtonClick={() => setQueryValue('')}
                        />
                    </div>
                </Box>
                <Divider />

                {filteredProducts.length === 0 ? (
                    <EmptyState
                        heading="No products found"
                        image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                    >
                        <p>No Shopify products match your search, or your store has no products yet.</p>
                    </EmptyState>
                ) : (
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                        gap: '1px',
                        background: '#e1e3e5'
                    }}>
                        {filteredProducts.map(product => {
                            const isConfigured = configuredIds.has(String(product.id));
                            const isAdding = addingId === product.id;
                            const imageUrl = product.image?.src || product.images?.[0]?.src;
                            const variants = product.variants || [];
                            const prices = variants.map(v => parseFloat(v.price)).filter(Boolean);
                            const minPrice = prices.length ? Math.min(...prices) : 0;
                            const maxPrice = prices.length ? Math.max(...prices) : 0;
                            const priceRange = prices.length === 0
                                ? 'No price'
                                : minPrice === maxPrice
                                    ? `$${minPrice.toFixed(2)}`
                                    : `$${minPrice.toFixed(2)} – $${maxPrice.toFixed(2)}`;

                            return (
                                <div key={product.id} style={{
                                    background: '#fff',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    overflow: 'hidden'
                                }}>
                                    {/* Product Image */}
                                    <div style={{
                                        height: 200,
                                        background: '#f6f6f7',
                                        overflow: 'hidden',
                                        position: 'relative'
                                    }}>
                                        {imageUrl ? (
                                            <img
                                                src={imageUrl}
                                                alt={product.title}
                                                style={{
                                                    width: '100%', height: '100%',
                                                    objectFit: 'cover',
                                                    transition: 'transform 0.3s ease'
                                                }}
                                                onMouseEnter={e => e.target.style.transform = 'scale(1.05)'}
                                                onMouseLeave={e => e.target.style.transform = 'scale(1)'}
                                            />
                                        ) : (
                                            <div style={{
                                                width: '100%', height: '100%',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                flexDirection: 'column', gap: 8, color: '#8c9196'
                                            }}>
                                                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                                    <rect x="3" y="3" width="18" height="18" rx="2" />
                                                    <circle cx="8.5" cy="8.5" r="1.5" />
                                                    <polyline points="21 15 16 10 5 21" />
                                                </svg>
                                                <Text variant="bodySm" tone="subdued">No image</Text>
                                            </div>
                                        )}
                                        {/* Status pill */}
                                        <div style={{
                                            position: 'absolute', top: 8, right: 8,
                                            padding: '2px 8px', borderRadius: 20, fontSize: 11,
                                            fontWeight: 600, letterSpacing: 0.3,
                                            background: product.status === 'active' ? '#d4edda' : '#fff3cd',
                                            color: product.status === 'active' ? '#155724' : '#856404'
                                        }}>
                                            {product.status === 'active' ? '● Active' : '● Draft'}
                                        </div>
                                        {isConfigured && (
                                            <div style={{
                                                position: 'absolute', top: 8, left: 8,
                                                padding: '2px 8px', borderRadius: 20, fontSize: 11,
                                                fontWeight: 600, background: '#c6f6d5', color: '#22543d'
                                            }}>
                                                ✓ In Bundle
                                            </div>
                                        )}
                                    </div>

                                    {/* Product Info */}
                                    <div style={{ padding: '14px 16px', flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                                        <Text variant="bodyMd" fontWeight="semibold">{product.title}</Text>
                                        <Text variant="bodyLg" fontWeight="bold" tone="success">{priceRange}</Text>

                                        {/* Variants */}
                                        {variants.length > 0 && (
                                            <div style={{
                                                background: '#f6f6f7', borderRadius: 6,
                                                padding: '6px 10px', fontSize: 12, color: '#6d7175'
                                            }}>
                                                <strong>{variants.length} variant{variants.length !== 1 ? 's' : ''}:</strong>{' '}
                                                {variants.slice(0, 3).map(v => v.title).join(' · ')}
                                                {variants.length > 3 ? ` +${variants.length - 3} more` : ''}
                                            </div>
                                        )}

                                        {/* Action */}
                                        <div style={{ marginTop: 'auto', paddingTop: 8 }}>
                                            {isConfigured ? (
                                                <div style={{
                                                    textAlign: 'center', padding: '8px',
                                                    background: '#f0fff4', border: '1px solid #9ae6b4',
                                                    borderRadius: 6, color: '#276749', fontWeight: 600, fontSize: 13
                                                }}>
                                                    ✓ Already in Bundle Config
                                                </div>
                                            ) : (
                                                <Button
                                                    fullWidth
                                                    variant="primary"
                                                    loading={isAdding}
                                                    onClick={() => handleAddToBundle(product)}
                                                >
                                                    + Add to Bundle
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </Card>
        </BlockStack>
    );
}

// ─── MAIN INVENTORY PAGE ───────────────────────────────────────────────────────
function Inventory() {
    const [selectedTab, setSelectedTab] = useState(0);

    const tabs = [
        { id: 'pot-stock', content: '📦 Pot Stock', panelID: 'pot-stock-panel' },
        { id: 'shopify-products', content: '🌿 Shopify Products', panelID: 'shopify-products-panel' },
    ];

    return (
        <Page title="Inventory">
            <BlockStack gap="400">
                <Card padding="0">
                    <Tabs tabs={tabs} selected={selectedTab} onSelect={setSelectedTab} />
                </Card>

                {selectedTab === 0 ? <PotStockTab /> : <ShopifyProductsTab />}
            </BlockStack>
        </Page>
    );
}

export default Inventory;
