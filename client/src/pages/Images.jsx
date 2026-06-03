import React, { useState, useEffect } from 'react';
import {
    Page, Layout, Card, Text, BlockStack, InlineStack,
    Thumbnail, Button, Select, EmptyState, Badge,
    Box, Divider, Banner, SkeletonBodyText, DropZone
} from '@shopify/polaris';
import { ImageIcon, UploadIcon, CameraIcon, ProductIcon } from '@shopify/polaris-icons';
import { motion, AnimatePresence } from 'framer-motion';
import { Trash2, Leaf, MoveRight, Image as LucideImage, Sparkles } from 'lucide-react';

function Images() {
    const [configs, setConfigs] = useState([]);
    const [selectedProduct, setSelectedProduct] = useState('');
    const [images, setImages] = useState([]);
    const [colors, setColors] = useState([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [newImage, setNewImage] = useState({ pot_color_id: '', size: '', file: null });

    useEffect(() => { fetchData(); }, []);
    useEffect(() => { if (selectedProduct) fetchImages(selectedProduct); }, [selectedProduct]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [configsRes, colorsRes] = await Promise.all([
                fetch('/api/product-config'),
                fetch('/api/pots/colors')
            ]);
            const configsData = await configsRes.json();
            const colorsData = await colorsRes.json();

            setConfigs(Array.isArray(configsData) ? configsData : []);
            setColors(Array.isArray(colorsData) ? colorsData : []);

            if (configsData.length > 0) setSelectedProduct(configsData[0].id.toString());
        } catch (error) { console.error('Failed to fetch data:', error); }
        finally { setLoading(false); }
    };

    const fetchImages = async (productConfigId) => {
        try {
            const res = await fetch(`/api/images/product/${productConfigId}`);
            setImages(await res.json());
        } catch (error) { console.error('Failed to fetch images:', error); }
    };

    const handleAddImage = async () => {
        if (!newImage.file) return;
        setUploading(true);
        const formData = new FormData();
        formData.append('product_config_id', selectedProduct);
        formData.append('pot_color_id', newImage.pot_color_id);
        formData.append('size', newImage.size);
        formData.append('image', newImage.file);

        try {
            const res = await fetch('/api/images', { method: 'POST', body: formData });
            if (res.ok) {
                setNewImage({ pot_color_id: '', size: '', file: null });
                fetchImages(selectedProduct);
            } else {
                const data = await res.json();
                alert(`Upload failed: ${data.error}`);
            }
        } catch (error) {
            console.error('Failed to add image:', error);
            alert('Server error during upload');
        } finally {
            setUploading(false);
        }
    };

    const handleDeleteImage = async (id) => {
        if (!confirm('Permanently delete this bundle image from Shopify?')) return;
        try {
            await fetch(`/api/images/${id}`, { method: 'DELETE' });
            fetchImages(selectedProduct);
        } catch (error) { console.error('Failed to delete image:', error); }
    };

    const productOptions = configs.map(c => ({ label: c.product_title || `Product #${c.shopify_product_id}`, value: c.id.toString() }));
    const colorOptions = [{ label: 'Select Pot Style...', value: '' }, ...colors.map(c => ({ label: `${c.name}${c.type ? ` (${c.type})` : ''}`, value: c.id.toString() }))];
    const sizeOptions = [{ label: 'Select Plant Size...', value: '' }, { label: 'Small', value: 'Small' }, { label: 'Medium', value: 'Medium' }, { label: 'Large', value: 'Large' }, { label: 'Extra Large', value: 'Extra Large' }];

    const handleDropZoneDrop = (_droppedFiles, acceptedFiles, _rejectedFiles) => {
        setNewImage({ ...newImage, file: acceptedFiles[0] });
    };

    const getSelectedProductTitle = () => {
        const found = configs.find(c => c.id.toString() === selectedProduct);
        return found?.product_title || 'Plant';
    };

    if (loading) return (
        <Page title="Visual Library">
            <Box padding="1000">
                <BlockStack gap="400" align="center">
                    <div className="stat-icon-wrapper" style={{ background: 'rgba(26, 77, 46, 0.1)', color: 'var(--primary)' }}>
                        <LucideImage size={32} />
                    </div>
                    <Text variant="headingXl">Building your visual library...</Text>
                    <SkeletonBodyText lines={6} />
                </BlockStack>
            </Box>
        </Page>
    );

    if (configs.length === 0) return (
        <Page title="Visual Library">
            <EmptyState
                heading="No active bundles"
                action={{ content: 'Create a Bundle', url: '/builder' }}
                image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
            >
                <p>Configure at least one plant bundle before uploading custom composite images.</p>
            </EmptyState>
        </Page>
    );

    return (
        <Page
            fullWidth
            title="Visual Library"
            subtitle="Manage the high-fidelity composite images customers see during checkout."
        >
            <div className="dashboard-container" style={{ paddingTop: 0 }}>
                <Layout>
                    {/* Sidebar Configuration */}
                    <Layout.Section variant="oneThird">
                        <BlockStack gap="500">
                             <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
                                <Card>
                                    <Box padding="500">
                                        <BlockStack gap="400">
                                            <InlineStack gap="200" align="start" blockAlign="center">
                                                <div style={{ padding: 8, background: '#f5f7f5', borderRadius: 8 }}>
                                                    <Leaf size={20} color="#1a4d2e" />
                                                </div>
                                                <Text variant="headingMd">Plant Selection</Text>
                                            </InlineStack>
                                            <Text variant="bodySm" tone="subdued">Select the plant you want to manage visuals for.</Text>
                                            <Select
                                                label="Active Product"
                                                labelHidden
                                                options={productOptions}
                                                value={selectedProduct}
                                                onChange={setSelectedProduct}
                                            />
                                        </BlockStack>
                                    </Box>
                                </Card>
                             </motion.div>

                             <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}>
                                <Card>
                                    <Box padding="500">
                                        <BlockStack gap="400">
                                            <InlineStack gap="200" align="start" blockAlign="center">
                                                <div style={{ padding: 8, background: 'rgba(143, 177, 73, 0.1)', borderRadius: 8 }}>
                                                    <Sparkles size={20} color="#8fb149" />
                                                </div>
                                                <Text variant="headingMd">New Composite</Text>
                                            </InlineStack>
                                            
                                            <BlockStack gap="300">
                                                <Select label="Target Pot Style" options={colorOptions} value={newImage.pot_color_id} onChange={(value) => setNewImage({ ...newImage, pot_color_id: value })} />
                                                <Select label="Target Plant Size" options={sizeOptions} value={newImage.size} onChange={(value) => setNewImage({ ...newImage, size: value })} />
                                                
                                                <div style={{ marginTop: '10px' }}>
                                                    <Text variant="bodySm" fontWeight="semibold">Blueprint File</Text>
                                                    <Box marginBlockStart="200">
                                                        <DropZone onDrop={handleDropZoneDrop} allowMultiple={false} label="Drag plant+pot photo here">
                                                            {newImage.file ? (
                                                                <Box padding="400">
                                                                    <InlineStack gap="300" blockAlign="center">
                                                                        <Thumbnail size="small" source={window.URL.createObjectURL(newImage.file)} alt="Preview" />
                                                                        <Text variant="bodySm">{newImage.file.name}</Text>
                                                                    </InlineStack>
                                                                </Box>
                                                            ) : <DropZone.FileUpload actionHint="Accepts .jpg, .png, .webp" />}
                                                        </DropZone>
                                                    </Box>
                                                </div>

                                                <Button 
                                                    variant="primary" 
                                                    size="large" 
                                                    fullWidth 
                                                    onClick={handleAddImage} 
                                                    loading={uploading} 
                                                    disabled={!newImage.pot_color_id || !newImage.size || !newImage.file}
                                                >
                                                    Upload to Shopify
                                                </Button>
                                            </BlockStack>
                                        </BlockStack>
                                    </Box>
                                </Card>
                             </motion.div>
                        </BlockStack>
                    </Layout.Section>

                    {/* Main Gallery */}
                    <Layout.Section>
                        <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }}>
                            <Card padding="0">
                                <Box padding="500">
                                    <InlineStack align="space-between" blockAlign="center">
                                        <BlockStack gap="100">
                                            <Text variant="headingLg" as="h2">Live Visuals: {getSelectedProductTitle()}</Text>
                                            <Text variant="bodySm" tone="subdued">These are the actual photos customers will see when configuring their {getSelectedProductTitle()} bundle.</Text>
                                        </BlockStack>
                                        <Badge tone="success">{images.length} Active Assets</Badge>
                                    </InlineStack>
                                </Box>
                                <Divider />
                                <Box padding="500">
                                    <div className="gallery-grid">
                                        <AnimatePresence>
                                            {images.map((img, idx) => (
                                                <motion.div 
                                                    key={img.id}
                                                    initial={{ opacity: 0, y: 20 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    exit={{ opacity: 0, scale: 0.9 }}
                                                    transition={{ delay: idx * 0.05 }}
                                                    className="plant-card-hover"
                                                    style={{ 
                                                        background: '#fff', 
                                                        borderRadius: 20, 
                                                        overflow: 'hidden', 
                                                        border: '1px solid #f0f0f0',
                                                        display: 'flex',
                                                        flexDirection: 'column'
                                                    }}
                                                >
                                                    <div style={{ height: 300, background: '#f8f9f8', overflow: 'hidden', position: 'relative' }}>
                                                        <img src={img.image_url} alt={img.color_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                        <div style={{ position: 'absolute', top: 12, right: 12 }}>
                                                            <Button 
                                                                icon={<Trash2 size={18} color="#eb3b3b" />} 
                                                                onClick={() => handleDeleteImage(img.id)}
                                                                variant="tertiary"
                                                            />
                                                        </div>
                                                        <div style={{ 
                                                            position: 'absolute', bottom: 12, left: 12, 
                                                            padding: '6px 12px', background: 'rgba(255,255,255,0.9)', 
                                                            borderRadius: 20, fontSize: 11, fontWeight: 700, 
                                                            color: '#1a4d2e', display: 'flex', alignItems: 'center', gap: 6,
                                                            backdropFilter: 'blur(4px)'
                                                        }}>
                                                            <LucideImage size={14} /> LIVE PREVIEW
                                                        </div>
                                                    </div>
                                                    <Box padding="400">
                                                        <BlockStack gap="100">
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                                <Text variant="bodyLg" fontWeight="bold">{img.color_name}</Text>
                                                                <Badge tone="info">{img.size}</Badge>
                                                            </div>
                                                            <Text variant="bodySm" tone="subdued">Composite mapped to Shopify variant</Text>
                                                        </BlockStack>
                                                    </Box>
                                                </motion.div>
                                            ))}
                                        </AnimatePresence>

                                        {images.length === 0 && (
                                            <div style={{ gridColumn: '1 / -1', padding: '100px 0', textAlign: 'center' }}>
                                                <LucideImage size={64} style={{ margin: '0 auto 20px', opacity: 0.05 }} />
                                                <Text variant="headingMd" tone="subdued">No bundle visuals found for this plant.</Text>
                                                <Text variant="bodySm" tone="subdued">Upload a plant + pot composite image to get started.</Text>
                                            </div>
                                        )}
                                    </div>
                                </Box>
                            </Card>
                        </motion.div>
                    </Layout.Section>
                </Layout>
            </div>
        </Page>
    );
}

export default Images;
