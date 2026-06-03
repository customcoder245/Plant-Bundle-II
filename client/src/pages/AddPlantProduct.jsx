import React, { useState, useEffect } from 'react';
import {
    Page, Layout, Card, FormLayout, TextField, Button,
    InlineStack, Select, BlockStack, Text, Box,
    Divider, Banner, Badge, Tabs, Thumbnail, Spinner,
    Icon, Tag
} from '@shopify/polaris';
import {
    PlusIcon, DeleteIcon, SearchIcon, RefreshIcon,
    ChevronLeftIcon, DuplicateIcon, ViewIcon, ShareIcon,
    MenuVerticalIcon, ImageIcon, CheckCircleIcon,
    ChevronDownIcon, ChevronUpIcon, EditIcon
} from '@shopify/polaris-icons';

/* ─────────────────────────────────────────────────────────────
   MEDIA UPLOAD CARD
   ───────────────────────────────────────────────────────────── */
function MediaUploadCard({ imageUrl, onUpload }) {
    return (
        <Card>
            <Box padding="400">
                <BlockStack gap="400">
                    <InlineStack align="space-between">
                        <Text variant="headingMd">Media</Text>
                        <Button variant="tertiary" size="slim">Add from URL</Button>
                    </InlineStack>
                    <div style={{
                        border: '1px dashed #c4cdd5',
                        borderRadius: '8px',
                        padding: '40px',
                        textAlign: 'center',
                        background: '#f9fafb',
                        cursor: 'pointer'
                    }}>
                        <BlockStack gap="200" align="center">
                            <Icon source={ImageIcon} tone="subdued" />
                            {imageUrl ? (
                                <img src={imageUrl} style={{ maxWidth: '120px', maxHeight: '120px', borderRadius: '4px', objectFit: 'cover' }} />
                            ) : (
                                <Text variant="bodyMd" tone="subdued">Upload images or drag and drop</Text>
                            )}
                            <Button onClick={() => onUpload && onUpload('https://images.unsplash.com/photo-1512428559087-560fa5ceab42?auto=format&fit=crop&w=300&h=300&q=80')}>Mock Upload</Button>
                        </BlockStack>
                    </div>
                </BlockStack>
            </Box>
        </Card>
    );
}

/* ─────────────────────────────────────────────────────────────
   SIDEBAR COMPONENT
   ───────────────────────────────────────────────────────────── */
function Sidebar({ status, setStatus, organization, setOrganization, tags, setTags }) {
    const [tagInput, setTagInput] = useState('');

    const handleAddTag = () => {
        if (tagInput.trim() && !tags.includes(tagInput.trim())) {
            setTags([...tags, tagInput.trim()]);
            setTagInput('');
        }
    };

    return (
        <BlockStack gap="400">
            <Card>
                <Box padding="400">
                    <BlockStack gap="300">
                        <Text variant="headingMd">Status</Text>
                        <Select
                            label="Product Status"
                            labelHidden
                            options={[
                                { label: 'Active', value: 'active' },
                                { label: 'Draft', value: 'draft' },
                                { label: 'Archived', value: 'archived' }
                            ]}
                            value={status}
                            onChange={setStatus}
                        />
                    </BlockStack>
                </Box>
            </Card>

            <Card>
                <Box padding="400">
                    <BlockStack gap="400">
                        <Text variant="headingMd">Product organization</Text>
                        <FormLayout>
                            <TextField
                                label="Type"
                                value={organization.type}
                                onChange={(v) => setOrganization({ ...organization, type: v })}
                                autoComplete="off"
                                placeholder="e.g. Drought-tolerant"
                            />
                            <TextField
                                label="Vendor"
                                value={organization.vendor}
                                onChange={(v) => setOrganization({ ...organization, vendor: v })}
                                autoComplete="off"
                                placeholder="Planet Desert"
                            />
                            <TextField
                                label="Collections"
                                value={organization.collection}
                                onChange={(v) => setOrganization({ ...organization, collection: v })}
                                autoComplete="off"
                                placeholder="Plants Collection"
                                helpText="Add to target bundle collection"
                            />
                        </FormLayout>
                    </BlockStack>
                </Box>
            </Card>

            <Card>
                <Box padding="400">
                    <BlockStack gap="300">
                        <Text variant="headingMd">Tags</Text>
                        <TextField
                            label="Add tags"
                            labelHidden
                            value={tagInput}
                            onChange={setTagInput}
                            onBlur={handleAddTag}
                            onKeyPress={(e) => e.key === 'Enter' && handleAddTag()}
                            autoComplete="off"
                            placeholder="Watering_Needs:Low, Houseplant..."
                        />
                        <InlineStack gap="100">
                            {tags.map((t, i) => (
                                <Tag key={i} onRemove={() => setTags(tags.filter((_, idx) => idx !== i))}>{t}</Tag>
                            ))}
                        </InlineStack>
                    </BlockStack>
                </Box>
            </Card>
        </BlockStack>
    );
}

/* ─────────────────────────────────────────────────────────────
   PICK FROM SHOPIFY (TAB 1)
   ───────────────────────────────────────────────────────────── */
function PickFromShopify() {
    const [products, setProducts] = useState([]);
    const [configuredIds, setConfiguredIds] = useState(new Set());
    const [loading, setLoading] = useState(true);
    const [addingId, setAddingId] = useState(null);
    const [query, setQuery] = useState('');
    const [msg, setMsg] = useState({ text: '', type: '' });

    useEffect(() => { fetchAll(); }, []);

    const fetchAll = async () => {
        setLoading(true);
        try {
            const [pRes, cRes] = await Promise.all([
                fetch('/api/products'),
                fetch('/api/product-config')
            ]);
            const pData = await pRes.json();
            const cData = await cRes.json();
            setProducts(Array.isArray(pData) ? pData : []);
            setConfiguredIds(new Set(Array.isArray(cData) ? cData.map(c => String(c.shopify_product_id)) : []));
        } catch (e) {
            setMsg({ text: 'Could not load products. Make sure the server is running.', type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const addToBundle = async (product) => {
        setAddingId(product.id);
        try {
            const size_mappings = (product.variants || []).map(v => ({
                shopify_variant_id: v.id,
                variant_title: v.title,
                pot_size: v.title.includes('4') ? '4" Pot' : v.title.includes('6') ? '6" Pot' : v.title.includes('8') ? '8" Pot' : 'Medium'
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
                setMsg({ text: `✅ "${product.title}" is ready for pot bundling!`, type: 'success' });
            } else {
                const err = await res.json();
                throw new Error(err.error);
            }
        } catch (e) {
            setMsg({ text: `❌ ${e.message}`, type: 'error' });
        } finally {
            setAddingId(null);
            setTimeout(() => setMsg({ text: '', type: '' }), 5000);
        }
    };

    const filtered = products.filter(p =>
        p.title?.toLowerCase().includes(query.toLowerCase()) ||
        p.product_type?.toLowerCase().includes(query.toLowerCase())
    );

    if (loading) return (
        <Box padding="800">
            <div style={{ textAlign: 'center' }}>
                <Spinner size="large" />
                <Box marginTop="400">
                    <Text tone="subdued">Syncing Shopify Plants…</Text>
                </Box>
            </div>
        </Box>
    );

    return (
        <BlockStack gap="400">
            {msg.text && (
                <Banner tone={msg.type === 'success' ? 'success' : 'critical'}>
                    <p>{msg.text}</p>
                </Banner>
            )}

            <Card padding="0">
                <Box padding="400">
                    <InlineStack align="space-between" blockAlign="center">
                        <InlineStack gap="200">
                            <Text variant="headingMd">Shopify Inventory</Text>
                            <Badge>{products.length} products</Badge>
                        </InlineStack>
                        <Button onClick={fetchAll} icon={RefreshIcon} variant="tertiary" size="slim">Refresh</Button>
                    </InlineStack>
                    <div style={{ marginTop: 12 }}>
                        <TextField
                            prefix={<SearchIcon style={{ width: 18 }} />}
                            placeholder="Search plants..."
                            value={query}
                            onChange={setQuery}
                            autoComplete="off"
                            clearButton
                            onClearButtonClick={() => setQuery('')}
                        />
                    </div>
                </Box>
                <Divider />

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1px', background: '#f1f2f3' }}>
                    {filtered.map(product => {
                        const isConfigured = configuredIds.has(String(product.id));
                        const imgUrl = product.image?.src || product.images?.[0]?.src;
                        return (
                            <div key={product.id} style={{ background: '#fff', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <div style={{ height: 180, background: '#f9fafb', borderRadius: 8, overflow: 'hidden', position: 'relative' }}>
                                    <img src={imgUrl || 'https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    {isConfigured && (
                                        <div style={{ position: 'absolute', top: 8, right: 8 }}>
                                            <Badge tone="success">Connected</Badge>
                                        </div>
                                    )}
                                </div>
                                <Text variant="bodyMd" fontWeight="semibold">{product.title}</Text>
                                <div style={{ marginTop: 'auto' }}>
                                    {isConfigured ? (
                                        <Button fullWidth disabled icon={CheckCircleIcon}>Ready</Button>
                                    ) : (
                                        <Button fullWidth variant="primary" loading={addingId === product.id} onClick={() => addToBundle(product)}>Connect to Bundle</Button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </Card>
        </BlockStack>
    );
}

/* ─────────────────────────────────────────────────────────────
   DETAILED VARIANT DETAILS EDITOR (IMAGES 2 & 3)
   ───────────────────────────────────────────────────────────── */
function DetailedVariantDetailsEditor({
    productTitle,
    variants,
    editingIndex,
    setEditingIndex,
    onSaveVariant,
    onCancel
}) {
    const activeVariant = variants[editingIndex];
    if (!activeVariant) return null;

    // Local form states
    const [price, setPrice] = useState(activeVariant.price || '29.49');
    const [compareAtPrice, setCompareAtPrice] = useState(activeVariant.compare_at_price || '');
    const [costPerItem, setCostPerItem] = useState(activeVariant.cost_per_item || '4.87');
    const [chargeTax, setChargeTax] = useState(activeVariant.charge_tax !== false);
    const [unitPrice, setUnitPrice] = useState(activeVariant.unit_price || '');
    
    const [inventoryTracked, setInventoryTracked] = useState(activeVariant.inventory_tracked !== false);
    const [quantity, setQuantity] = useState(activeVariant.inventory_quantity || '0');
    const [sku, setSku] = useState(activeVariant.sku || '');
    const [barcode, setBarcode] = useState(activeVariant.barcode || '');
    const [inventoryPolicy, setInventoryPolicy] = useState(activeVariant.inventory_policy || 'deny');

    const [physicalProduct, setPhysicalProduct] = useState(activeVariant.physical_product !== false);
    const [weight, setWeight] = useState(activeVariant.weight || '1.0');
    const [weightUnit, setWeightUnit] = useState(activeVariant.weight_unit || 'lb');
    const [packageType, setPackageType] = useState(activeVariant.package_type || 'Store default • #6 - 12 x 12 x 6 in, 0 lb');
    const [countryOfOrigin, setCountryOfOrigin] = useState(activeVariant.country_of_origin || '');
    const [hsCode, setHsCode] = useState(activeVariant.hs_code || '');

    // Option override states (directly mapped options in sidebar editing)
    const [optSize, setOptSize] = useState(activeVariant.option1 || '');
    const [optColor, setOptColor] = useState(activeVariant.option2 || '');
    const [optNoPot, setOptNoPot] = useState(activeVariant.option3 || '');

    // Metafields
    const [metafields, setMetafields] = useState(activeVariant.metafields || {
        color_image: '', supplier_4: '', supplier_3: '', supplier_2: '',
        age_group: '', condition: '', gender: '', mpn: '',
        supplier: '', variant_title: '', pots: '', width: '', height: ''
    });

    // Collapsible states
    const [priceCollapse, setPriceCollapse] = useState(false);
    const [inventoryCollapse, setInventoryCollapse] = useState(false);
    const [shippingCollapse, setShippingCollapse] = useState(false);

    // Sidebar search/filters
    const [searchQuery, setSearchQuery] = useState('');
    const [sizeFilter, setSizeFilter] = useState('');
    const [colorFilter, setColorFilter] = useState('');
    const [noPotFilter, setNoPotFilter] = useState('');

    // Sync form values if active editing variant swaps in sidebar
    useEffect(() => {
        setPrice(activeVariant.price || '29.49');
        setCompareAtPrice(activeVariant.compare_at_price || '');
        setCostPerItem(activeVariant.cost_per_item || '4.87');
        setChargeTax(activeVariant.charge_tax !== false);
        setUnitPrice(activeVariant.unit_price || '');
        setInventoryTracked(activeVariant.inventory_tracked !== false);
        setQuantity(activeVariant.inventory_quantity || '0');
        setSku(activeVariant.sku || '');
        setBarcode(activeVariant.barcode || '');
        setInventoryPolicy(activeVariant.inventory_policy || 'deny');
        setPhysicalProduct(activeVariant.physical_product !== false);
        setWeight(activeVariant.weight || '1.0');
        setWeightUnit(activeVariant.weight_unit || 'lb');
        setPackageType(activeVariant.package_type || 'Store default • #6 - 12 x 12 x 6 in, 0 lb');
        setCountryOfOrigin(activeVariant.country_of_origin || '');
        setHsCode(activeVariant.hs_code || '');
        setOptSize(activeVariant.option1 || '');
        setOptColor(activeVariant.option2 || '');
        setOptNoPot(activeVariant.option3 || '');
        setMetafields(activeVariant.metafields || {
            color_image: '', supplier_4: '', supplier_3: '', supplier_2: '',
            age_group: '', condition: '', gender: '', mpn: '',
            supplier: '', variant_title: '', pots: '', width: '', height: ''
        });
    }, [editingIndex, activeVariant]);

    const handleMetafieldChange = (field, val) => {
        setMetafields({ ...metafields, [field]: val });
    };

    const handleLocalSave = () => {
        onSaveVariant(editingIndex, {
            ...activeVariant,
            price,
            compare_at_price: compareAtPrice,
            cost_per_item: costPerItem,
            charge_tax: chargeTax,
            unit_price: unitPrice,
            inventory_tracked: inventoryTracked,
            inventory_quantity: quantity,
            sku,
            barcode,
            inventory_policy: inventoryPolicy,
            physical_product: physicalProduct,
            weight,
            weight_unit: weightUnit,
            package_type: packageType,
            country_of_origin: countryOfOrigin,
            hs_code: hsCode,
            option1: optSize,
            option2: optColor,
            option3: optNoPot,
            title: [optSize, optColor, optNoPot].filter(Boolean).join(' / '),
            pot_size: optSize,
            metafields
        });
    };

    // Sidebar variant filters
    const filteredSidebarVariants = variants.filter(v => {
        const matchesSearch = v.title.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesSize = !sizeFilter || v.option1 === sizeFilter;
        const matchesColor = !colorFilter || v.option2 === colorFilter;
        const matchesNoPot = !noPotFilter || v.option3 === noPotFilter;
        return matchesSearch && matchesSize && matchesColor && matchesNoPot;
    });

    const sizes = Array.from(new Set(variants.map(v => v.option1))).filter(Boolean);
    const colors = Array.from(new Set(variants.map(v => v.option2))).filter(Boolean);
    const noPots = Array.from(new Set(variants.map(v => v.option3))).filter(Boolean);

    return (
        <div style={{ background: '#f6f6f7', minHeight: '100vh', paddingBottom: '100px' }}>
            {/* Custom Breadcrumb Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 20px', borderBottom: '1px solid #e1e3e5', background: '#fff' }}>
                <Button icon={ChevronLeftIcon} variant="plain" onClick={onCancel}>Products</Button>
                <Text tone="subdued">/</Text>
                <Text variant="bodyMd" fontWeight="semibold">{productTitle || 'Rosemary Christmas Tree'}</Text>
                <Text tone="subdued">/</Text>
                <Badge tone="info">Add variant</Badge>
            </div>

            <Box padding="500">
                <Layout>
                    {/* Left Column - Variants List & Filters */}
                    <Layout.Section variant="oneThird">
                        <BlockStack gap="400">
                            {/* Product Status Box */}
                            <Card>
                                <Box padding="400">
                                    <InlineStack gap="300" blockAlign="center">
                                        <div style={{ width: '48px', height: '48px', background: '#f1f2f3', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                                            <Icon source={ImageIcon} tone="subdued" />
                                        </div>
                                        <BlockStack gap="050">
                                            <Text variant="bodyMd" fontWeight="bold" truncate>{productTitle || "Rosemary Christmas Tree 'Salvia rosmarinus'"}</Text>
                                            <InlineStack gap="200">
                                                <Badge tone="success">Active</Badge>
                                                <Text variant="bodySm" tone="subdued">{variants.length} variants</Text>
                                            </InlineStack>
                                        </BlockStack>
                                    </InlineStack>
                                </Box>
                            </Card>

                            {/* Sidebar Filters & Scrollable Variant List */}
                            <Card padding="0">
                                <Box padding="400">
                                    <BlockStack gap="300">
                                        <TextField
                                            prefix={<Icon source={SearchIcon} />}
                                            placeholder="Search variants"
                                            value={searchQuery}
                                            onChange={setSearchQuery}
                                            autoComplete="off"
                                            size="slim"
                                        />
                                        <InlineStack gap="100">
                                            <Select
                                                label="Size"
                                                labelHidden
                                                options={[{ label: 'Size', value: '' }, ...sizes.map(s => ({ label: s, value: s }))]}
                                                value={sizeFilter}
                                                onChange={setSizeFilter}
                                            />
                                            <Select
                                                label="Pot Color"
                                                labelHidden
                                                options={[{ label: 'Pot Color', value: '' }, ...colors.map(c => ({ label: c, value: c }))]}
                                                value={colorFilter}
                                                onChange={setColorFilter}
                                            />
                                            <Select
                                                label="No Pot Option"
                                                labelHidden
                                                options={[{ label: 'Pot Option', value: '' }, ...noPots.map(n => ({ label: n, value: n }))]}
                                                value={noPotFilter}
                                                onChange={setNoPotFilter}
                                            />
                                        </InlineStack>
                                    </BlockStack>
                                </Box>
                                <Divider />

                                <div style={{ maxHeight: '420px', overflowY: 'auto' }}>
                                    {filteredSidebarVariants.map((v, idx) => {
                                        const originalIndex = variants.findIndex(val => val.title === v.title);
                                        const isSelected = originalIndex === editingIndex;
                                        return (
                                            <div
                                                key={v.title}
                                                onClick={() => setEditingIndex(originalIndex)}
                                                style={{
                                                    padding: '12px 16px',
                                                    borderBottom: '1px solid #f1f2f3',
                                                    background: isSelected ? '#edf4fe' : '#ffffff',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '12px',
                                                    transition: 'all 0.15s ease'
                                                }}
                                            >
                                                <div style={{ width: '28px', height: '28px', background: '#f9fafb', border: '1px solid #e1e3e5', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                    <Icon source={ImageIcon} tone="subdued" />
                                                </div>
                                                <Text variant="bodyMd" fontWeight={isSelected ? 'bold' : 'regular'} tone={isSelected ? 'brand' : 'default'}>
                                                    {v.title}
                                                </Text>
                                            </div>
                                        );
                                    })}
                                </div>
                            </Card>
                        </BlockStack>
                    </Layout.Section>

                    {/* Right Column - Forms */}
                    <Layout.Section>
                        <BlockStack gap="400">
                            {/* Option 1: Dotted Image Box */}
                            <Card>
                                <Box padding="400">
                                    <InlineStack gap="400" blockAlign="center">
                                        <div style={{
                                            width: '100px',
                                            height: '100px',
                                            border: '2px dashed #c4cdd5',
                                            borderRadius: '8px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            background: '#f9fafb',
                                            cursor: 'pointer'
                                        }}>
                                            <BlockStack align="center" gap="100">
                                                <Icon source={PlusIcon} tone="subdued" />
                                            </BlockStack>
                                        </div>
                                        <BlockStack gap="100">
                                            <Text variant="headingSm">Variant Image</Text>
                                            <Button variant="tertiary" size="slim">All channels</Button>
                                        </BlockStack>
                                    </InlineStack>
                                </Box>
                            </Card>

                            {/* Option Values Card */}
                            <Card>
                                <Box padding="400">
                                    <BlockStack gap="400">
                                        <Text variant="headingMd">Option values</Text>
                                        <FormLayout>
                                            <FormLayout.Group condensed>
                                                <TextField label="Size" value={optSize} onChange={setOptSize} autoComplete="off" />
                                                <TextField label="Pot Color" value={optColor} onChange={setOptColor} autoComplete="off" />
                                                <TextField label="No Pot Option" value={optNoPot} onChange={setOptNoPot} autoComplete="off" />
                                            </FormLayout.Group>
                                        </FormLayout>
                                    </BlockStack>
                                </Box>
                            </Card>

                            {/* Price Card */}
                            <Card>
                                <Box padding="400">
                                    <BlockStack gap="400">
                                        <Text variant="headingMd">Price</Text>
                                        <FormLayout>
                                            <TextField
                                                label="Price"
                                                value={price}
                                                onChange={setPrice}
                                                prefix="$"
                                                autoComplete="off"
                                            />
                                        </FormLayout>
                                        <Divider />
                                        <div style={{ cursor: 'pointer' }} onClick={() => setPriceCollapse(!priceCollapse)}>
                                            <InlineStack align="space-between">
                                                <InlineStack gap="100">
                                                    <Badge>Compare-at</Badge>
                                                    <Badge>Unit price</Badge>
                                                    <Badge tone={chargeTax ? "success" : "subdued"}>Charge tax {chargeTax ? 'Yes' : 'No'}</Badge>
                                                    <Badge>Cost per item ${costPerItem}</Badge>
                                                </InlineStack>
                                                <Icon source={priceCollapse ? ChevronUpIcon : ChevronDownIcon} />
                                            </InlineStack>
                                        </div>
                                        {priceCollapse && (
                                            <Box marginTop="200">
                                                <FormLayout>
                                                    <FormLayout.Group>
                                                        <TextField label="Compare-at price" prefix="$" value={compareAtPrice} onChange={setCompareAtPrice} autoComplete="off" />
                                                        <TextField label="Cost per item" prefix="$" value={costPerItem} onChange={setCostPerItem} autoComplete="off" />
                                                    </FormLayout.Group>
                                                    <FormLayout.Group>
                                                        <TextField label="Unit price" prefix="$" value={unitPrice} onChange={setUnitPrice} autoComplete="off" />
                                                        <Select
                                                            label="Charge tax on this variant"
                                                            options={[{ label: 'Yes', value: 'yes' }, { label: 'No', value: 'no' }]}
                                                            value={chargeTax ? 'yes' : 'no'}
                                                            onChange={(val) => setChargeTax(val === 'yes')}
                                                        />
                                                    </FormLayout.Group>
                                                </FormLayout>
                                            </Box>
                                        )}
                                    </BlockStack>
                                </Box>
                            </Card>

                            {/* Inventory Card */}
                            <Card>
                                <Box padding="400">
                                    <BlockStack gap="400">
                                        <InlineStack align="space-between">
                                            <Text variant="headingMd">Inventory</Text>
                                            <InlineStack gap="200" blockAlign="center">
                                                <Text variant="bodyMd">Inventory tracked</Text>
                                                <input
                                                    type="checkbox"
                                                    checked={inventoryTracked}
                                                    onChange={(e) => setInventoryTracked(e.target.checked)}
                                                    style={{ transform: 'scale(1.3)', cursor: 'pointer' }}
                                                />
                                            </InlineStack>
                                        </InlineStack>
                                        <FormLayout>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '20px', alignItems: 'center' }}>
                                                <Text variant="bodyMd">Planet Desert</Text>
                                                <div style={{ width: '120px' }}>
                                                    <TextField
                                                        label="Quantity"
                                                        labelHidden
                                                        type="number"
                                                        value={quantity}
                                                        onChange={setQuantity}
                                                        autoComplete="off"
                                                    />
                                                </div>
                                            </div>
                                        </FormLayout>
                                        <Divider />
                                        <div style={{ cursor: 'pointer' }} onClick={() => setInventoryCollapse(!inventoryCollapse)}>
                                            <InlineStack align="space-between">
                                                <InlineStack gap="100">
                                                    <Badge>SKU</Badge>
                                                    <Badge>Barcode</Badge>
                                                    <Badge tone={inventoryPolicy === 'continue' ? 'warning' : 'subdued'}>Sell when out of stock {inventoryPolicy === 'continue' ? 'On' : 'Off'}</Badge>
                                                </InlineStack>
                                                <Icon source={inventoryCollapse ? ChevronUpIcon : ChevronDownIcon} />
                                            </InlineStack>
                                        </div>
                                        {inventoryCollapse && (
                                            <Box marginTop="200">
                                                <FormLayout>
                                                    <FormLayout.Group>
                                                        <TextField label="SKU (Stock Keeping Unit)" value={sku} onChange={setSku} autoComplete="off" />
                                                        <TextField label="Barcode (ISBN, UPC, GTIN)" value={barcode} onChange={setBarcode} autoComplete="off" />
                                                    </FormLayout.Group>
                                                    <Select
                                                        label="Inventory policy"
                                                        options={[
                                                            { label: "Don't sell when out of stock", value: 'deny' },
                                                            { label: 'Continue selling when out of stock', value: 'continue' }
                                                        ]}
                                                        value={inventoryPolicy}
                                                        onChange={setInventoryPolicy}
                                                    />
                                                </FormLayout>
                                            </Box>
                                        )}
                                    </BlockStack>
                                </Box>
                            </Card>

                            {/* Shipping Card */}
                            <Card>
                                <Box padding="400">
                                    <BlockStack gap="400">
                                        <InlineStack align="space-between">
                                            <Text variant="headingMd">Shipping</Text>
                                            <InlineStack gap="200" blockAlign="center">
                                                <Text variant="bodyMd">Physical product</Text>
                                                <input
                                                    type="checkbox"
                                                    checked={physicalProduct}
                                                    onChange={(e) => setPhysicalProduct(e.target.checked)}
                                                    style={{ transform: 'scale(1.3)', cursor: 'pointer' }}
                                                />
                                            </InlineStack>
                                        </InlineStack>

                                        {physicalProduct && (
                                            <>
                                                <FormLayout>
                                                    <FormLayout.Group>
                                                        <Select
                                                            label="Package"
                                                            options={[{ label: packageType, value: packageType }]}
                                                            value={packageType}
                                                            onChange={setPackageType}
                                                        />
                                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '8px', alignItems: 'end' }}>
                                                            <TextField
                                                                label="Product weight"
                                                                type="number"
                                                                value={weight}
                                                                onChange={setWeight}
                                                                autoComplete="off"
                                                            />
                                                            <div style={{ width: '70px' }}>
                                                                <Select
                                                                    label="Unit"
                                                                    labelHidden
                                                                    options={[{ label: 'lb', value: 'lb' }, { label: 'oz', value: 'oz' }, { label: 'kg', value: 'kg' }, { label: 'g', value: 'g' }]}
                                                                    value={weightUnit}
                                                                    onChange={setWeightUnit}
                                                                />
                                                            </div>
                                                        </div>
                                                    </FormLayout.Group>
                                                </FormLayout>
                                                <Divider />
                                                <div style={{ cursor: 'pointer' }} onClick={() => setShippingCollapse(!shippingCollapse)}>
                                                    <InlineStack align="space-between">
                                                        <InlineStack gap="100">
                                                            <Badge>Country of origin</Badge>
                                                            <Badge>HS Code</Badge>
                                                        </InlineStack>
                                                        <Icon source={shippingCollapse ? ChevronUpIcon : ChevronDownIcon} />
                                                    </InlineStack>
                                                </div>
                                                {shippingCollapse && (
                                                    <Box marginTop="200">
                                                        <FormLayout>
                                                            <FormLayout.Group>
                                                                <TextField label="Country/Region of origin" placeholder="United States" value={countryOfOrigin} onChange={setCountryOfOrigin} autoComplete="off" />
                                                                <TextField label="Harmonized System (HS) code" placeholder="Search or enter 6-digit HS code" value={hsCode} onChange={setHsCode} autoComplete="off" />
                                                            </FormLayout.Group>
                                                        </FormLayout>
                                                    </Box>
                                                )}
                                            </>
                                        )}
                                    </BlockStack>
                                </Box>
                            </Card>

                            {/* Metafields Card */}
                            <Card>
                                <Box padding="400">
                                    <BlockStack gap="400">
                                        <Text variant="headingMd">Metafields</Text>
                                        <FormLayout>
                                            <TextField label="Color Image" value={metafields.color_image} onChange={(val) => handleMetafieldChange('color_image', val)} autoComplete="off" placeholder="e.g. pot_white.jpg" />
                                            <FormLayout.Group condensed>
                                                <TextField label="Supplier 4" value={metafields.supplier_4} onChange={(val) => handleMetafieldChange('supplier_4', val)} autoComplete="off" />
                                                <TextField label="Supplier 3" value={metafields.supplier_3} onChange={(val) => handleMetafieldChange('supplier_3', val)} autoComplete="off" />
                                                <TextField label="Supplier 2" value={metafields.supplier_2} onChange={(val) => handleMetafieldChange('supplier_2', val)} autoComplete="off" />
                                            </FormLayout.Group>
                                            <FormLayout.Group>
                                                <TextField label="Google: Age Group" value={metafields.age_group} onChange={(val) => handleMetafieldChange('age_group', val)} autoComplete="off" />
                                                <TextField label="Google: Condition" value={metafields.condition} onChange={(val) => handleMetafieldChange('condition', val)} autoComplete="off" />
                                            </FormLayout.Group>
                                            <FormLayout.Group condensed>
                                                <TextField label="Google: Gender" value={metafields.gender} onChange={(val) => handleMetafieldChange('gender', val)} autoComplete="off" />
                                                <TextField label="Google: MPN" value={metafields.mpn} onChange={(val) => handleMetafieldChange('mpn', val)} autoComplete="off" />
                                                <TextField label="supplier" value={metafields.supplier} onChange={(val) => handleMetafieldChange('supplier', val)} autoComplete="off" />
                                            </FormLayout.Group>
                                            <FormLayout.Group>
                                                <TextField label="Variant Title" value={metafields.variant_title} onChange={(val) => handleMetafieldChange('variant_title', val)} autoComplete="off" />
                                                <TextField label="Pots" value={metafields.pots} onChange={(val) => handleMetafieldChange('pots', val)} autoComplete="off" />
                                            </FormLayout.Group>
                                            <FormLayout.Group condensed>
                                                <TextField label="width" value={metafields.width} onChange={(val) => handleMetafieldChange('width', val)} autoComplete="off" />
                                                <TextField label="height" value={metafields.height} onChange={(val) => handleMetafieldChange('height', val)} autoComplete="off" />
                                            </FormLayout.Group>
                                        </FormLayout>
                                    </BlockStack>
                                </Box>
                            </Card>
                        </BlockStack>
                    </Layout.Section>
                </Layout>

                {/* Footer Buttons for Editor */}
                <Box marginTop="600" paddingBlockEnd="800">
                    <InlineStack align="end" gap="300">
                        <Button onClick={onCancel}>Cancel</Button>
                        <Button variant="primary" onClick={handleLocalSave}>Save variant</Button>
                    </InlineStack>
                </Box>
            </Box>
        </div>
    );
}

/* ─────────────────────────────────────────────────────────────
   CREATE NEW PRODUCT (TAB 2)
   ───────────────────────────────────────────────────────────── */
function CreateNewProduct() {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [status, setStatus] = useState('active');
    const [organization, setOrganization] = useState({ type: '', vendor: '', collection: '' });
    const [tags, setTags] = useState([]);
    
    // Multi-option configurations matching Image 1
    const [options, setOptions] = useState([
        { name: 'Size', values: ['4" Pot', '6" Pot', '8" Pot'] },
        { name: 'Pot Color', values: ['White', 'Black', 'Teal', 'Light Green', 'Self Watering'] },
        { name: 'No Pot Option', values: ['With Pot', 'Without Pot'] }
    ]);

    // Combinations of options. 3 * 5 * 2 = 30 variants.
    const [variants, setVariants] = useState([]);
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState({ text: '', type: '' });

    // Active sub-page editor state
    const [editingVariantIndex, setEditingVariantIndex] = useState(null);

    // Group By dashboard setting (Image 1)
    const [groupBy, setGroupBy] = useState('Size');
    const [expandedGroups, setExpandedGroups] = useState(new Set());

    // Generates combinations for the variants array
    const generateCombinations = (opts) => {
        if (opts.length === 0) return [];
        const combos = [];
        const recurse = (optIdx, currentCombo) => {
            if (optIdx === opts.length) {
                combos.push(currentCombo);
                return;
            }
            const option = opts[optIdx];
            const values = option.values.length > 0 ? option.values : ['Default'];
            values.forEach(val => {
                recurse(optIdx + 1, [...currentCombo, { name: option.name, value: val }]);
            });
        };
        recurse(0, []);
        return combos;
    };

    // Keep variants synchronized to options
    useEffect(() => {
        const combos = generateCombinations(options);
        const nextVariants = combos.map(combo => {
            const opt1 = combo[0]?.value || '';
            const opt2 = combo[1]?.value || '';
            const opt3 = combo[2]?.value || '';
            const key = [opt1, opt2, opt3].filter(Boolean).join(' / ');

            // Find existing to preserve configurations
            const existing = variants.find(v => v.title === key);
            if (existing) return existing;

            // Generate beautifully realistic mock data mirroring screenshots
            let basePrice = 29.49;
            let baseQuantity = 36;
            if (opt1.includes('6')) {
                basePrice = 45.49;
                baseQuantity = 27;
            } else if (opt1.includes('8')) {
                basePrice = 71.25;
                baseQuantity = 77;
            }

            // Adjust price slightly based on pot colors
            if (opt2 === 'Self Watering') {
                basePrice += 10.00;
            } else if (opt2 === 'Teal' || opt2 === 'Light Green') {
                basePrice += 5.00;
            }

            // Adjust price for no-pot discounts
            if (opt3 === 'Without Pot') {
                basePrice = Math.max(9.99, basePrice - 10.00);
            }

            // Stagger quantities slightly for realism
            const finalQty = opt2 === 'Black' ? baseQuantity + 5 : opt2 === 'Teal' ? baseQuantity - 3 : baseQuantity;

            return {
                option1: opt1,
                option2: opt2,
                option3: opt3,
                title: key,
                pot_size: opt1,
                price: basePrice.toFixed(2),
                compare_at_price: '',
                cost_per_item: '4.87',
                charge_tax: true,
                unit_price: '',
                inventory_tracked: true,
                inventory_quantity: String(Math.max(0, finalQty)),
                sku: '',
                barcode: '',
                inventory_policy: 'deny',
                physical_product: true,
                weight: '1.0',
                weight_unit: 'lb',
                package_type: 'Store default • #6 - 12 x 12 x 6 in, 0 lb',
                country_of_origin: '',
                hs_code: '',
                metafields: {
                    color_image: '', supplier_4: '', supplier_3: '', supplier_2: '',
                    age_group: '', condition: '', gender: '', mpn: '',
                    supplier: '', variant_title: '', pots: '', width: '', height: ''
                }
            };
        });
        setVariants(nextVariants);
    }, [options]);

    // Handle tag additions for Size/Color/NoPot option tags
    const handleAddValueTag = (optIndex, valueText) => {
        if (!valueText.trim()) return;
        const next = [...options];
        if (!next[optIndex].values.includes(valueText.trim())) {
            next[optIndex].values.push(valueText.trim());
            setOptions(next);
        }
    };

    const handleRemoveValueTag = (optIndex, valIndex) => {
        const next = [...options];
        next[optIndex].values = next[optIndex].values.filter((_, idx) => idx !== valIndex);
        setOptions(next);
    };

    // Grouping calculations for the variants list view
    const getGroupedVariants = () => {
        const groups = {};
        variants.forEach(v => {
            let key = v.option1; // Size
            if (groupBy === 'Pot Color') key = v.option2;
            else if (groupBy === 'No Pot Option') key = v.option3;

            if (!groups[key]) {
                groups[key] = {
                    title: key,
                    items: [],
                    prices: [],
                    totalInventory: 0
                };
            }
            groups[key].items.push(v);
            groups[key].prices.push(parseFloat(v.price) || 0);
            groups[key].totalInventory += parseInt(v.inventory_quantity) || 0;
        });

        return Object.values(groups).map(g => {
            const minPrice = Math.min(...g.prices).toFixed(2);
            const maxPrice = Math.max(...g.prices).toFixed(2);
            return {
                ...g,
                priceDisplay: minPrice === maxPrice ? `$ ${minPrice}` : `$ ${minPrice} - ${maxPrice}`,
                available: g.totalInventory
            };
        });
    };

    const toggleGroupExpand = (title) => {
        const next = new Set(expandedGroups);
        if (next.has(title)) next.delete(title);
        else next.add(title);
        setExpandedGroups(next);
    };

    // Save individual variant settings in editing sub-page
    const handleSaveVariant = (index, updatedObj) => {
        const next = [...variants];
        next[index] = updatedObj;
        setVariants(next);
        setEditingVariantIndex(null);
        setMsg({ text: `Variant "${updatedObj.title}" updated successfully.`, type: 'success' });
        setTimeout(() => setMsg({ text: '', type: '' }), 4000);
    };

    // Inline prices and inventory updates inside the main table
    const handleUpdateVariantDirectly = (variantTitle, field, val) => {
        setVariants(prev => prev.map(v => {
            if (v.title === variantTitle) {
                return { ...v, [field]: val };
            }
            return v;
        }));
    };

    // Bulk price update for grouped item rows
    const handleGroupPriceChange = (groupTitle, val) => {
        if (!val || isNaN(val)) return;
        setVariants(prev => prev.map(v => {
            let matches = false;
            if (groupBy === 'Size' && v.option1 === groupTitle) matches = true;
            else if (groupBy === 'Pot Color' && v.option2 === groupTitle) matches = true;
            else if (groupBy === 'No Pot Option' && v.option3 === groupTitle) matches = true;

            if (matches) {
                return { ...v, price: parseFloat(val).toFixed(2) };
            }
            return v;
        }));
    };

    const handleCreate = async () => {
        if (!title) { setMsg({ text: 'Product title is required.', type: 'error' }); return; }
        setSaving(true);
        try {
            const res = await fetch('/api/products/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title,
                    description,
                    options: options.map(o => ({ name: o.name, values: o.values })),
                    variants: variants.map(v => ({
                        option1: v.option1,
                        option2: v.option2,
                        option3: v.option3,
                        price: v.price,
                        compare_at_price: v.compare_at_price || null,
                        inventory_management: v.inventory_tracked ? 'shopify' : null,
                        inventory_quantity: parseInt(v.inventory_quantity) || 0,
                        sku: v.sku || '',
                        barcode: v.barcode || '',
                        weight: v.weight ? parseFloat(v.weight) : 0,
                        weight_unit: v.weight_unit || 'lb',
                        pot_size: v.pot_size
                    }))
                })
            });
            const data = await res.json();
            if (res.ok) {
                setMsg({ text: `✅ "${title}" has been created and synced beautifully with ${variants.length} variants!`, type: 'success' });
                // Reset form
                setTitle('');
                setDescription('');
                setOptions([
                    { name: 'Size', values: ['4" Pot', '6" Pot', '8" Pot'] },
                    { name: 'Pot Color', values: ['White', 'Black', 'Teal', 'Light Green', 'Self Watering'] },
                    { name: 'No Pot Option', values: ['With Pot', 'Without Pot'] }
                ]);
            } else {
                throw new Error(data.error);
            }
        } catch (e) {
            setMsg({ text: `❌ ${e.message}`, type: 'error' });
        } finally {
            setSaving(false);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    const totalAvailable = variants.reduce((acc, curr) => acc + (parseInt(curr.inventory_quantity) || 0), 0);

    // Render detailed editor sub-page if a variant is selected
    if (editingVariantIndex !== null) {
        return (
            <DetailedVariantDetailsEditor
                productTitle={title}
                variants={variants}
                editingIndex={editingVariantIndex}
                setEditingIndex={setEditingVariantIndex}
                onSaveVariant={handleSaveVariant}
                onCancel={() => setEditingVariantIndex(null)}
            />
        );
    }

    const groupedVariants = getGroupedVariants();

    return (
        <BlockStack gap="500">
            {msg.text && (
                <Banner tone={msg.type === 'success' ? 'success' : 'critical'}>
                    <p>{msg.text}</p>
                </Banner>
            )}

            <Layout>
                <Layout.Section>
                    <BlockStack gap="400">
                        {/* Title & Description Card */}
                        <Card>
                            <Box padding="400">
                                <FormLayout>
                                    <TextField
                                        label="Title"
                                        value={title}
                                        onChange={setTitle}
                                        placeholder="e.g. Rosemary Christmas Tree 'Salvia rosmarinus'"
                                        autoComplete="off"
                                    />
                                    <div style={{ marginBottom: 4 }}>
                                        <Text variant="bodyMd">Description</Text>
                                    </div>
                                    <div style={{ border: '1px solid #c4cdd5', borderRadius: 8, overflow: 'hidden' }}>
                                        <div style={{ background: '#f6f6f7', padding: '8px', borderBottom: '1px solid #c4cdd5', display: 'flex', gap: 8 }}>
                                            <Button variant="tertiary" size="slim"><b>B</b></Button>
                                            <Button variant="tertiary" size="slim"><i>I</i></Button>
                                            <Button variant="tertiary" size="slim"><u>U</u></Button>
                                            <Button variant="tertiary" size="slim">A</Button>
                                            <Divider vertical />
                                            <Button variant="tertiary" size="slim">List</Button>
                                            <Button variant="tertiary" size="slim">Img</Button>
                                            <div style={{ flex: 1 }} />
                                            <Button variant="tertiary" size="slim">{'</>'}</Button>
                                        </div>
                                        <TextField
                                            label="Description"
                                            labelHidden
                                            value={description}
                                            onChange={setDescription}
                                            multiline={8}
                                            autoComplete="off"
                                            placeholder="Introduce this beautiful plant to your customers..."
                                            borderless
                                        />
                                    </div>
                                </FormLayout>
                            </Box>
                        </Card>

                        {/* Media Upload Card */}
                        <MediaUploadCard />

                        {/* Shopify Multi-Option Variants Config Panel (Image 1) */}
                        <Card padding="0">
                            <Box padding="400">
                                <BlockStack gap="400">
                                    <InlineStack align="space-between" blockAlign="center">
                                        <Text variant="headingMd">Variants</Text>
                                        <Button
                                            onClick={() => setEditingVariantIndex(0)}
                                            icon={PlusIcon}
                                            variant="plain"
                                        >
                                            + Add variant
                                        </Button>
                                    </InlineStack>
                                    
                                    {/* Option rows with drag handles & tags */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                        {options.map((opt, optIdx) => (
                                            <div key={opt.name} style={{ display: 'flex', gap: '16px', alignItems: 'center', padding: '12px 16px', background: '#f9fafb', border: '1px solid #e1e3e5', borderRadius: '8px' }}>
                                                <div style={{ cursor: 'grab', display: 'flex', alignItems: 'center' }}>
                                                    <Icon source={MenuVerticalIcon} tone="subdued" />
                                                </div>
                                                <div style={{ flex: 1 }}>
                                                    <BlockStack gap="100">
                                                        <Text variant="bodyMd" fontWeight="semibold">{opt.name}</Text>
                                                        <InlineStack gap="100">
                                                            {opt.values.map((v, valIdx) => (
                                                                <Tag key={v} onRemove={() => handleRemoveValueTag(optIdx, valIdx)}>
                                                                    {v}
                                                                </Tag>
                                                            ))}
                                                            {/* Add sub-tag input box inline */}
                                                            <div style={{ maxWidth: '100px' }}>
                                                                <input
                                                                    placeholder="+ Value"
                                                                    onKeyDown={(e) => {
                                                                        if (e.key === 'Enter') {
                                                                            handleAddValueTag(optIdx, e.target.value);
                                                                            e.target.value = '';
                                                                        }
                                                                    }}
                                                                    style={{
                                                                        padding: '2px 8px',
                                                                        borderRadius: '4px',
                                                                        border: '1px solid #c4cdd5',
                                                                        fontSize: '13px',
                                                                        width: '100%'
                                                                    }}
                                                                />
                                                            </div>
                                                        </InlineStack>
                                                    </BlockStack>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </BlockStack>
                            </Box>
                            <Divider />

                            {/* Group By Filter Bar */}
                            <Box padding="300" background="bg-subdued">
                                <InlineStack align="space-between" blockAlign="center">
                                    <InlineStack gap="300" blockAlign="center">
                                        <Text variant="bodyMd">Group by</Text>
                                        <div style={{ width: '130px' }}>
                                            <Select
                                                label="Group by"
                                                labelHidden
                                                options={[
                                                    { label: 'Size', value: 'Size' },
                                                    { label: 'Pot Color', value: 'Pot Color' },
                                                    { label: 'No Pot Option', value: 'No Pot Option' }
                                                ]}
                                                value={groupBy}
                                                onChange={setGroupBy}
                                            />
                                        </div>
                                    </InlineStack>
                                    <InlineStack gap="200">
                                        <Button icon={SearchIcon} size="slim" />
                                        <Button size="slim">All locations</Button>
                                    </InlineStack>
                                </InlineStack>
                            </Box>
                            <Divider />

                            {/* Grouped Table Dashboard */}
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                                <thead>
                                    <tr style={{ background: '#f6f6f7', borderBottom: '1px solid #e1e3e5' }}>
                                        <th style={{ padding: '12px 16px', width: '40px' }}><input type="checkbox" style={{ cursor: 'pointer' }} /></th>
                                        <th style={{ padding: '12px 16px' }}><Text variant="bodySm" fontWeight="bold">Variant</Text></th>
                                        <th style={{ padding: '12px 16px', width: '220px' }}><Text variant="bodySm" fontWeight="bold">Price</Text></th>
                                        <th style={{ padding: '12px 16px', width: '140px' }}><Text variant="bodySm" fontWeight="bold">Available</Text></th>
                                        <th style={{ padding: '12px 16px', width: '50px' }} />
                                    </tr>
                                </thead>
                                <tbody>
                                    {groupedVariants.map(g => {
                                        const isExpanded = expandedGroups.has(g.title);
                                        return (
                                            <React.Fragment key={g.title}>
                                                <tr style={{ borderBottom: '1px solid #e1e3e5', background: isExpanded ? '#f9fafb' : '#ffffff' }}>
                                                    <td style={{ padding: '12px 16px' }}><input type="checkbox" style={{ cursor: 'pointer' }} /></td>
                                                    <td style={{ padding: '12px 16px' }}>
                                                        <InlineStack gap="300" blockAlign="center">
                                                            <div style={{ width: '40px', height: '40px', background: '#f4f5f6', border: '1px solid #e1e3e5', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                                                                <img src="https://images.unsplash.com/photo-1512428559087-560fa5ceab42?auto=format&fit=crop&w=80&h=80&q=80" style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Plant" />
                                                            </div>
                                                            <BlockStack gap="0">
                                                                <Text variant="bodyMd" fontWeight="semibold">{g.title}</Text>
                                                                <Text variant="bodySm" tone="subdued">{g.items.length} variants</Text>
                                                            </BlockStack>
                                                        </InlineStack>
                                                    </td>
                                                    <td style={{ padding: '12px 16px' }}>
                                                        <div style={{ maxWidth: '180px' }}>
                                                            <TextField
                                                                label="Price Display"
                                                                labelHidden
                                                                prefix="$"
                                                                value={g.priceDisplay.replace('$ ', '')}
                                                                onChange={(val) => handleGroupPriceChange(g.title, val)}
                                                                autoComplete="off"
                                                            />
                                                        </div>
                                                    </td>
                                                    <td style={{ padding: '12px 16px' }}>
                                                        <Text variant="bodyMd">{g.available}</Text>
                                                    </td>
                                                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                                                        <Button
                                                            variant="plain"
                                                            icon={isExpanded ? ChevronUpIcon : ChevronDownIcon}
                                                            onClick={() => toggleGroupExpand(g.title)}
                                                        />
                                                    </td>
                                                </tr>

                                                {/* Expanded Individual Rows */}
                                                {isExpanded && g.items.map(subItem => {
                                                    const originalIndex = variants.findIndex(val => val.title === subItem.title);
                                                    return (
                                                        <tr key={subItem.title} style={{ borderBottom: '1px solid #f1f2f3', background: '#fdfdfd' }}>
                                                            <td style={{ padding: '8px 16px 8px 36px' }}><input type="checkbox" style={{ cursor: 'pointer' }} /></td>
                                                            <td style={{ padding: '8px 16px' }}>
                                                                <InlineStack gap="200" blockAlign="center">
                                                                    <div style={{ width: '28px', height: '28px', background: '#fcfcfc', border: '1px solid #e8e9ea', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                                        <Icon source={ImageIcon} tone="subdued" />
                                                                    </div>
                                                                    <BlockStack gap="0">
                                                                        <Text variant="bodySm">{subItem.title}</Text>
                                                                    </BlockStack>
                                                                </InlineStack>
                                                            </td>
                                                            <td style={{ padding: '8px 16px' }}>
                                                                <div style={{ maxWidth: '100px' }}>
                                                                    <TextField
                                                                        label="price"
                                                                        labelHidden
                                                                        prefix="$"
                                                                        value={subItem.price}
                                                                        onChange={(val) => handleUpdateVariantDirectly(subItem.title, 'price', val)}
                                                                        autoComplete="off"
                                                                        size="slim"
                                                                    />
                                                                </div>
                                                            </td>
                                                            <td style={{ padding: '8px 16px' }}>
                                                                <div style={{ maxWidth: '80px' }}>
                                                                    <TextField
                                                                        label="qty"
                                                                        labelHidden
                                                                        type="number"
                                                                        value={subItem.inventory_quantity}
                                                                        onChange={(val) => handleUpdateVariantDirectly(subItem.title, 'inventory_quantity', val)}
                                                                        autoComplete="off"
                                                                        size="slim"
                                                                    />
                                                                </div>
                                                            </td>
                                                            <td style={{ padding: '8px 16px', textAlign: 'center' }}>
                                                                <Button
                                                                    icon={EditIcon}
                                                                    variant="plain"
                                                                    onClick={() => setEditingVariantIndex(originalIndex)}
                                                                />
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </React.Fragment>
                                        );
                                    })}
                                </tbody>
                            </table>

                            {/* Total Inventory Summary Footer */}
                            <Divider />
                            <Box padding="400" background="bg-subdued">
                                <Text variant="bodyMd" tone="subdued">
                                    Total inventory across all locations: <b>{totalAvailable} available</b>
                                </Text>
                            </Box>
                        </Card>
                    </BlockStack>
                </Layout.Section>

                {/* Sidebar Config Options */}
                <Layout.Section variant="oneThird">
                    <Sidebar
                        status={status}
                        setStatus={setStatus}
                        organization={organization}
                        setOrganization={setOrganization}
                        tags={tags}
                        setTags={setTags}
                    />
                </Layout.Section>
            </Layout>

            <Divider />

            <Box paddingBlockEnd="800">
                <InlineStack align="end" gap="400">
                    <Button size="large">Discard</Button>
                    <Button
                        variant="primary"
                        size="large"
                        loading={saving}
                        onClick={handleCreate}
                        icon={PlusIcon}
                    >
                        Save & Create Product ({variants.length} Variants)
                    </Button>
                </InlineStack>
            </Box>
        </BlockStack>
    );
}

/* ─────────────────────────────────────────────────────────────
   MAIN COMPONENT PAGE
   ───────────────────────────────────────────────────────────── */
function AddPlantProduct() {
    const [selectedTab, setSelectedTab] = useState(1); // Default to brand new creation

    const tabs = [
        { id: 'pick-existing', content: 'Connect Existing', panelID: 'pick-panel' },
        { id: 'create-new', content: 'Create Brand New', panelID: 'create-panel' },
    ];

    return (
        <Page
            backAction={{ content: 'Dashboard', url: '/' }}
            title={selectedTab === 1 ? "Add New Plant" : "Connect Shopify Product"}
            subtitle="Everything you need to sync your plants with the pot bundling system."
            secondaryActions={[
                { content: 'Duplicate', icon: DuplicateIcon },
                { content: 'View', icon: ViewIcon },
                { content: 'Share', icon: ShareIcon },
            ]}
        >
            <BlockStack gap="400">
                <Card padding="0">
                    <Tabs tabs={tabs} selected={selectedTab} onSelect={setSelectedTab} />
                </Card>

                <div style={{ marginTop: 8 }}>
                    {selectedTab === 0 ? <PickFromShopify /> : <CreateNewProduct />}
                </div>
            </BlockStack>
        </Page>
    );
}

export default AddPlantProduct;
