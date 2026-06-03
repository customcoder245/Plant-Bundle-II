import React, { useState, useEffect } from 'react';
import {
    Page, Card, BlockStack, InlineStack, Text, Badge,
    Button, TextField, Select, Divider, Banner,
    Box, SkeletonBodyText, Modal, FormLayout, Layout
} from '@shopify/polaris';
import { SearchIcon, RefreshIcon, PlusIcon, CheckIcon } from '@shopify/polaris-icons';
import { Leaf } from 'lucide-react';

/* ════════════════════════════════════════════════════════════
   HELPERS
   ════════════════════════════════════════════════════════════ */
const Spinner = () => (
    <>
        <div style={{
            width: 40, height: 40,
            border: '4px solid #e4e5e7',
            borderTop: '4px solid #008060',
            borderRadius: '50%',
            animation: 'bbspin 0.8s linear infinite',
            margin: '0 auto 12px'
        }} />
        <style>{`@keyframes bbspin{to{transform:rotate(360deg)}}`}</style>
    </>
);

/** Parse "4\" Pot / White" -> { size: '4" Pot', color: 'White' } */
function parseVariantTitle(title = '') {
    if (title.includes(' / ')) {
        const [size, color] = title.split(' / ');
        return { size: size.trim(), color: color.trim() };
    }
    return { size: title.trim(), color: '' };
}

/* colour map for known pot colours */
const COLOR_HEX = {
    white: '#f5f5f0', black: '#2c2c2c', green: '#4a7c59',
    beige: '#d4b483', gold: '#c9a84c', blue: '#4a90d9',
    red: '#c0392b', grey: '#9e9e9e', gray: '#9e9e9e',
    brown: '#795548', terracotta: '#c1440e', cream: '#fffdd0',
};
function colorHex(name = '') {
    return COLOR_HEX[name.toLowerCase()] || '#a9a9a9';
}

/* ════════════════════════════════════════════════════════════
   STEP — STEP INDICATOR
   ════════════════════════════════════════════════════════════ */
function StepIndicator({ current }) {
    const steps = ['1. Pick Plant', '2. Configure Pots', '3. Review & Save'];
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 28 }}>
            {steps.map((label, idx) => {
                const done = idx < current;
                const active = idx === current;
                return (
                    <React.Fragment key={idx}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                            <div style={{
                                width: 36, height: 36, borderRadius: '50%',
                                background: done ? '#008060' : active ? '#004c3f' : '#e4e5e7',
                                color: done || active ? '#fff' : '#8c9196',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontWeight: 700, fontSize: 15,
                                boxShadow: active ? '0 0 0 4px rgba(0,128,96,.2)' : 'none',
                                transition: 'all .3s'
                            }}>
                                {done ? '✓' : idx + 1}
                            </div>
                            <span style={{ fontSize: 12, fontWeight: active ? 700 : 400, color: active ? '#004c3f' : '#8c9196', whiteSpace: 'nowrap' }}>
                                {label}
                            </span>
                        </div>
                        {idx < steps.length - 1 && (
                            <div style={{ flex: 1, height: 2, background: done ? '#008060' : '#e4e5e7', margin: '0 8px', marginBottom: 22, transition: 'background .3s' }} />
                        )}
                    </React.Fragment>
                );
            })}
        </div>
    );
}

/* ════════════════════════════════════════════════════════════
   STEP 1: PLANT GALLERY
   ════════════════════════════════════════════════════════════ */
function PlantGallery({ onSelect }) {
    const [plants, setPlants] = useState([]);
    const [loading, setLoading] = useState(true);
    const [query, setQuery] = useState('');
    const [error, setError] = useState('');

    useEffect(() => { load(); }, []);

    const load = async () => {
        setLoading(true); setError('');
        try {
            const res = await fetch('/api/products');
            const d = await res.json();
            if (!res.ok) throw new Error(d.error || 'Failed');
            setPlants(Array.isArray(d) ? d : []);
        } catch (e) { setError(e.message); }
        finally { setLoading(false); }
    };

    const filtered = plants.filter(p =>
        p.title?.toLowerCase().includes(query.toLowerCase())
    );

    if (loading) return (
        <Card><Box padding="800" style={{ textAlign: 'center' }}>
            <Spinner /><Text tone="subdued">Loading plants from Shopify…</Text>
        </Box></Card>
    );

    return (
        <BlockStack gap="400">
            {error && <Banner tone="critical"><p>{error}</p></Banner>}
            <Banner tone="info">
                <p>Select the <strong>plant or tree</strong> you want to configure for pot bundling. You'll set pot sizes and colours in the next step.</p>
            </Banner>

            <Card padding="0">
                <Box padding="400">
                    <InlineStack align="space-between" blockAlign="center">
                        <InlineStack gap="200">
                            <Text variant="headingMd">🌿 All Plants & Trees</Text>
                            <Badge>{plants.length} products</Badge>
                        </InlineStack>
                        <Button onClick={load} icon={RefreshIcon} variant="tertiary" size="slim">Refresh</Button>
                    </InlineStack>
                    <div style={{ marginTop: 10 }}>
                        <TextField
                            prefix={<SearchIcon style={{ width: 18 }} />}
                            placeholder="Search plants..."
                            value={query} onChange={setQuery}
                            autoComplete="off" clearButton
                            onClearButtonClick={() => setQuery('')}
                        />
                    </div>
                </Box>
                <Divider />

                {filtered.length === 0 ? (
                    <Box padding="800"><Text tone="subdued" alignment="center">No plants found.</Text></Box>
                ) : (
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                        gap: '1px', background: '#e1e3e5'
                    }}>
                        {filtered.map(plant => {
                            const img = plant.image?.src || plant.images?.[0]?.src;
                            const variants = plant.variants || [];
                            // parse unique pot sizes from variants
                            const sizes = [...new Set(variants.map(v => parseVariantTitle(v.title).size).filter(Boolean))];
                            const colors = [...new Set(variants.map(v => parseVariantTitle(v.title).color).filter(Boolean))];

                            return (
                                <div key={plant.id} style={{ 
                                    background: '#fff', 
                                    display: 'flex', 
                                    flexDirection: 'column',
                                    borderRadius: 16,
                                    overflow: 'hidden',
                                    border: '1px solid #f0f0f0',
                                    transition: 'all 0.4s ease',
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.03)'
                                }}
                                className="plant-card-hover"
                                >
                                    {/* image */}
                                    <div style={{ height: 240, background: '#f6f6f7', overflow: 'hidden', position: 'relative' }}>
                                        {img ? (
                                            <img src={img} alt={plant.title} style={{
                                                width: '100%', height: '100%', objectFit: 'cover',
                                                transition: 'transform 0.6s cubic-bezier(0.23, 1, 0.32, 1)'
                                            }}
                                            className="plant-img"
                                            />
                                        ) : (
                                            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#c4cdd5' }}>
                                                <Leaf size={40} />
                                            </div>
                                        )}
                                        <div style={{
                                            position: 'absolute', top: 12, left: 12, padding: '4px 10px',
                                            borderRadius: 20, fontSize: 10, fontWeight: 700,
                                            background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(4px)',
                                            color: '#1a4d2e', display: 'flex', alignItems: 'center', gap: 4
                                        }}>
                                            ☀️ Full Sun
                                        </div>
                                        <div style={{
                                            position: 'absolute', top: 12, right: 12, padding: '4px 10px',
                                            borderRadius: 20, fontSize: 10, fontWeight: 700,
                                            background: plant.status === 'active' ? '#1a4d2e' : '#8c9196',
                                            color: '#fff'
                                        }}>
                                            {plant.status === 'active' ? 'ACTIVE' : 'DRAFT'}
                                        </div>
                                    </div>

                                    {/* info */}
                                    <div style={{ padding: '20px', flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
                                        <BlockStack gap="100">
                                            <Text variant="headingMd" fontWeight="bold">{plant.title}</Text>
                                            <Text variant="bodyXs" tone="subdued">Pachypodium lamerei & others</Text>
                                        </BlockStack>

                                        {/* Pot sizes chips */}
                                        {sizes.length > 0 && (
                                            <InlineStack gap="150" wrap={false}>
                                                {sizes.map(s => (
                                                    <span key={s} style={{
                                                        padding: '3px 10px', borderRadius: 6, fontSize: 11,
                                                        background: '#f1f8f1', color: '#1a4d2e', fontWeight: 600,
                                                        border: '1px solid #e2eee2'
                                                    }}>{s}</span>
                                                ))}
                                            </InlineStack>
                                        )}

                                        <div style={{ marginTop: 'auto', paddingTop: 10 }}>
                                            <Button fullWidth variant="primary" onClick={() => onSelect(plant)} size="large">
                                                Configure Bundle
                                            </Button>
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

/* ════════════════════════════════════════════════════════════
   STEP 2: BUNDLE CONFIGURATOR (IMAGE-FIRST)
   Shows every variant's real photo from Shopify so the user can
   choose exactly which plant+pot combos to enable.
   ════════════════════════════════════════════════════════════ */
function PotConfigurator({ plant, onBack, onNext }) {
    const variants = plant.variants || [];
    const images = plant.images || [];

    // Map image_id to URL
    const getVariantImg = (v) => {
        if (!v.image_id) return plant.image?.src || images[0]?.src;
        const found = images.find(img => img.id === v.image_id);
        return found ? found.src : (plant.image?.src || images[0]?.src);
    };

    const parsedVariants = variants.map(v => ({ 
        ...v, 
        ...parseVariantTitle(v.title),
        img: getVariantImg(v)
    }));

    // State: which variants are enabled
    const [enabled, setEnabled] = useState(() => {
        const init = {};
        variants.forEach(v => { init[v.id] = true; });
        return init;
    });
    
    // Pot Size Mappings (Internal logic for stock tracking)
    const [potSizeMappings, setPotSizeMappings] = useState(() => {
        const init = {};
        parsedVariants.forEach(v => {
            const s = (v.size || '').toLowerCase();
            let mapped = 'Medium';
            if (s.includes('4') || s.includes('small')) mapped = 'Small';
            else if (s.includes('6') || s.includes('medium')) mapped = 'Medium';
            else if (s.includes('8') || s.includes('large')) mapped = 'Large';
            init[v.id] = mapped;
        });
        return init;
    });

    const [discount, setDiscount] = useState('10.00');

    const handleNext = () => {
        const size_mappings = parsedVariants
            .filter(v => enabled[v.id])
            .map(v => ({
                shopify_variant_id: v.id,
                variant_title: v.title,
                pot_size: potSizeMappings[v.id] || 'Medium',
                _img: v.img,
                _price: v.price,
                _title: v.title
            }));
        onNext({ plant, discount, size_mappings });
    };

    const toggleVariant = (id) => setEnabled(prev => ({ ...prev, [id]: !prev[id] }));

    return (
        <BlockStack gap="600">
            {/* Header */}
            <Banner tone="info">
                <p>Toggle ON the <strong>Plant + Pot combinations</strong> you want to offer in the bundle. We pulled these photos directly from Shopify.</p>
            </Banner>

            <Layout>
                <Layout.Section>
                    <BlockStack gap="400">
                        <Text variant="headingLg" fontWeight="bold">Select Bundle Options for: {plant.title}</Text>
                        
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
                            gap: '20px'
                        }}>
                            {parsedVariants.map(v => {
                                const isOn = enabled[v.id];
                                return (
                                    <div key={v.id} 
                                        onClick={() => toggleVariant(v.id)}
                                        style={{
                                            background: '#fff',
                                            borderRadius: 20,
                                            overflow: 'hidden',
                                            cursor: 'pointer',
                                            transition: 'all 0.3s ease',
                                            border: `2px solid ${isOn ? '#1a4d2e' : '#f0f0f0'}`,
                                            boxShadow: isOn ? '0 10px 25px rgba(26, 77, 46, 0.15)' : 'none',
                                            position: 'relative',
                                            transform: isOn ? 'translateY(-4px)' : 'none'
                                        }}>
                                        
                                        {/* Variant Image */}
                                        <div style={{ height: 220, position: 'relative', background: '#f8f8f8' }}>
                                            <img src={v.img} alt={v.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                            <div style={{
                                                position: 'absolute', top: 10, right: 10,
                                                width: 24, height: 24, borderRadius: '50%',
                                                background: isOn ? '#1a4d2e' : '#fff',
                                                border: `2px solid ${isOn ? '#1a4d2e' : '#d1d1d1'}`,
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                color: '#fff', fontSize: 14, fontWeight: 'bold'
                                            }}>
                                                {isOn ? '✓' : ''}
                                            </div>
                                        </div>

                                        {/* Variant Detail */}
                                        <div style={{ padding: '16px' }}>
                                            <Text variant="bodyMd" fontWeight="bold">{v.title}</Text>
                                            <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <Badge tone={isOn ? 'success' : 'attention'}>{isOn ? 'Enabled' : 'Disabled'}</Badge>
                                                <Text fontWeight="bold" tone="success">${parseFloat(v.price).toFixed(2)}</Text>
                                            </div>
                                            
                                            {isOn && (
                                                <div style={{ marginTop: 12, borderTop: '1px solid #eee', paddingTop: 10 }}>
                                                    <Select
                                                        label="Internal Pot Size:"
                                                        options={[
                                                            { label: 'Small', value: 'Small' },
                                                            { label: 'Medium', value: 'Medium' },
                                                            { label: 'Large', value: 'Large' },
                                                            { label: 'Extra Large', value: 'Extra Large' }
                                                        ]}
                                                        value={potSizeMappings[v.id]}
                                                        onChange={(val) => setPotSizeMappings(prev => ({ ...prev, [v.id]: val }))}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </BlockStack>
                </Layout.Section>

                <Layout.Section variant="oneThird">
                    <BlockStack gap="400">
                        <Card>
                            <Box padding="400">
                                <BlockStack gap="300">
                                    <Text variant="headingMd">🏷️ Bundle Pricing</Text>
                                    <TextField
                                        label="Bare-Root Discount"
                                        type="number" prefix="$"
                                        helpText="Discount given when consumer selects 'No Pot'"
                                        value={discount} onChange={setDiscount}
                                        autoComplete="off"
                                    />
                                    <Divider />
                                    <Text variant="bodySm" tone="subdued">
                                        Total variants selected: {Object.values(enabled).filter(Boolean).length}
                                    </Text>
                                    <Button variant="primary" fullWidth size="large" onClick={handleNext}>
                                        Review Bundle →
                                    </Button>
                                </BlockStack>
                            </Box>
                        </Card>
                        
                        <Card>
                            <Box padding="400">
                                <BlockStack gap="200">
                                    <Text variant="headingSm">Quick Tip</Text>
                                    <Text variant="bodySm" tone="subdued">
                                        Ensure each plant+pot photo is clean and high-quality in Shopify for the best customer experience.
                                    </Text>
                                </BlockStack>
                            </Box>
                        </Card>
                    </BlockStack>
                </Layout.Section>
            </Layout>

            <Button onClick={onBack} variant="tertiary">← Different Plant</Button>
        </BlockStack>
    );
}

/* ════════════════════════════════════════════════════════════
   STEP 3: REVIEW & SAVE
   ════════════════════════════════════════════════════════════ */
function ReviewAndSave({ config, onBack, onSaved }) {
    const { plant, discount, size_mappings } = config;
    const img = plant.image?.src || plant.images?.[0]?.src;
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    // Group by pot size
    const bySize = {};
    size_mappings.forEach(m => {
        const key = m._size || m.variant_title;
        if (!bySize[key]) bySize[key] = [];
        bySize[key].push(m);
    });

    const handleSave = async () => {
        setSaving(true); setError('');
        try {
            const res = await fetch('/api/product-config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    shopify_product_id: plant.id,
                    product_title: plant.title,
                    no_pot_discount: parseFloat(discount) || 10,
                    size_mappings: size_mappings.map(m => ({
                        shopify_variant_id: m.shopify_variant_id,
                        variant_title: m.variant_title,
                        pot_size: m.pot_size
                    }))
                })
            });
            if (res.ok) { onSaved(); }
            else { const d = await res.json(); throw new Error(d.error || 'Save failed'); }
        } catch (e) { setError(e.message); }
        finally { setSaving(false); }
    };

    return (
        <BlockStack gap="500">
            {error && <Banner tone="critical"><p>{error}</p></Banner>}

            <Card>
                <Box padding="400">
                    <InlineStack gap="400" blockAlign="center">
                        {img && (
                            <img src={img} alt={plant.title} style={{
                                width: 72, height: 72, borderRadius: 8,
                                objectFit: 'cover', border: '2px solid #e4e5e7', flexShrink: 0
                            }} />
                        )}
                        <BlockStack gap="100">
                            <Text variant="headingLg" fontWeight="bold">{plant.title}</Text>
                            <InlineStack gap="200">
                                <Badge tone="success">{size_mappings.length} variants enabled</Badge>
                                <Badge tone="info">Bare-root discount: ${parseFloat(discount).toFixed(2)}</Badge>
                            </InlineStack>
                        </BlockStack>
                    </InlineStack>
                </Box>
            </Card>

            {/* Summary by pot size */}
            <Card padding="0">
                <Box padding="400">
                    <Text variant="headingMd">🪴 Bundle Summary</Text>
                </Box>
                <Divider />
                {Object.entries(bySize).map(([sizeName, items]) => (
                    <Box key={sizeName} padding="400" background={Object.keys(bySize).indexOf(sizeName) % 2 === 1 ? 'bg-surface-secondary' : 'bg-surface'}>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                {items.map(m => (
                                     <div key={m.shopify_variant_id} style={{
                                         display: 'flex', alignItems: 'center', gap: 10,
                                         padding: '6px 14px', borderRadius: 12,
                                         background: '#f0fff4', border: '1px solid #9ae6b4',
                                         fontSize: 13, fontWeight: 600, color: '#1a4d2e'
                                     }}>
                                         <div style={{
                                             width: 32, height: 32, borderRadius: 6,
                                             overflow: 'hidden', border: '1px solid #fff',
                                             boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                                         }}>
                                             <img src={m._img} alt={m.variant_title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                         </div>
                                         <span>{m.variant_title}</span>
                                         <Badge tone="success">${parseFloat(m._price || 0).toFixed(2)}</Badge>
                                     </div>
                                 ))}
                            </div>
                    </Box>
                ))}
            </Card>

            <InlineStack align="space-between">
                <Button onClick={onBack} variant="tertiary">← Back to Configure</Button>
                <Button variant="primary" size="large" loading={saving} onClick={handleSave} icon={PlusIcon}>
                    ✓ Save Bundle Configuration
                </Button>
            </InlineStack>
        </BlockStack>
    );
}

/* ════════════════════════════════════════════════════════════
   SUCCESS SCREEN
   ════════════════════════════════════════════════════════════ */
function SuccessScreen({ productTitle, onReset }) {
    return (
        <Card>
            <Box padding="800">
                <BlockStack gap="400" align="center">
                    <div style={{
                        width: 72, height: 72, borderRadius: '50%',
                        background: '#d4edda', display: 'flex',
                        alignItems: 'center', justifyContent: 'center',
                        margin: '0 auto', fontSize: 32
                    }}>✓</div>
                    <Text variant="headingLg" fontWeight="bold" alignment="center">Bundle Configured!</Text>
                    <Text tone="subdued" alignment="center">
                        <strong>{productTitle}</strong> is now set up for pot bundling.
                        Customers will see the pot selector on its product page.
                    </Text>
                    <InlineStack gap="300" align="center">
                        <Button variant="primary" onClick={onReset}>Configure Another Plant</Button>
                        <Button url="/products" variant="secondary">View All Bundles</Button>
                    </InlineStack>
                </BlockStack>
            </Box>
        </Card>
    );
}

/* ════════════════════════════════════════════════════════════
   MAIN PAGE
   ════════════════════════════════════════════════════════════ */
export default function BundleBuilder() {
    const [step, setStep] = useState(0);   // 0 = pick plant, 1 = configure pots, 2 = review
    const [selectedPlant, setSelectedPlant] = useState(null);
    const [bundleConfig, setBundleConfig] = useState(null);
    const [saved, setSaved] = useState(false);
    const [savedTitle, setSavedTitle] = useState('');

    const reset = () => {
        setStep(0);
        setSelectedPlant(null);
        setBundleConfig(null);
        setSaved(false);
        setSavedTitle('');
    };

    return (
        <Page
            title="🌿 Plant Bundle Builder"
            subtitle="Pick a plant, set pot options (size & colour), then save."
            backAction={step > 0 && !saved ? { content: 'Back', onAction: () => setStep(s => s - 1) } : undefined}
        >
            <div style={{ maxWidth: 1100, margin: '0 auto' }}>
                {!saved && <StepIndicator current={step} />}

                {saved ? (
                    <SuccessScreen productTitle={savedTitle} onReset={reset} />
                ) : step === 0 ? (
                    <PlantGallery onSelect={plant => { setSelectedPlant(plant); setStep(1); }} />
                ) : step === 1 ? (
                    <PotConfigurator
                        plant={selectedPlant}
                        onBack={() => setStep(0)}
                        onNext={cfg => { setBundleConfig(cfg); setStep(2); }}
                    />
                ) : (
                    <ReviewAndSave
                        config={bundleConfig}
                        onBack={() => setStep(1)}
                        onSaved={() => { setSavedTitle(bundleConfig.plant.title); setSaved(true); }}
                    />
                )}
            </div>
        </Page>
    );
}
