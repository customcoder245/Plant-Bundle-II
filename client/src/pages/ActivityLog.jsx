import React, { useState, useEffect } from 'react';
import {
    Page, Layout, Card, ResourceList, ResourceItem,
    Select, Badge, Text, BlockStack, InlineStack,
    Box, Divider, EmptyState, Icon, Banner
} from '@shopify/polaris';
import { 
    History, Filter, Info, AlertOctagon, TrendingUp, TrendingDown,
    RotateCcw, XCircle, CheckCircle2, RefreshCw, Edit, Plus, Trash2
} from 'lucide-react';

function ActivityLog() {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('');

    useEffect(() => { fetchLogs(); }, [filter]);

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const url = filter ? `/api/activity?event_type=${filter}&limit=100` : '/api/activity?limit=100';
            const res = await fetch(url);
            const data = await res.json();
            setLogs(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error('Failed to fetch logs:', error);
        } finally {
            setLoading(false);
        }
    };

    const getEventStyling = (eventType) => {
        const type = eventType.toLowerCase();
        if (type.includes('error')) {
            return { tone: 'critical', icon: AlertOctagon, bgColor: '#fbeae5', textColor: '#8e1f0b' };
        }
        if (type.includes('refund')) {
            return { tone: 'info', icon: RotateCcw, bgColor: '#e2f5f9', textColor: '#005f73' };
        }
        if (type.includes('cancel') || type.includes('delete') || type.includes('remove')) {
            return { tone: 'critical', icon: XCircle, bgColor: '#fbeae5', textColor: '#8e1f0b' };
        }
        if (type.includes('deduct')) {
            return { tone: 'warning', icon: TrendingDown, bgColor: '#fff4e5', textColor: '#8a5300' };
        }
        if (type.includes('restore')) {
            return { tone: 'success', icon: TrendingUp, bgColor: '#e3f1df', textColor: '#22541c' };
        }
        if (type.includes('create') || type.includes('upload')) {
            return { tone: 'success', icon: Plus, bgColor: '#e3f1df', textColor: '#22541c' };
        }
        if (type.includes('sync')) {
            return { tone: 'info', icon: RefreshCw, bgColor: '#e8f0fe', textColor: '#1a73e8' };
        }
        if (type.includes('update') || type.includes('toggle') || type.includes('config')) {
            return { tone: 'info', icon: Edit, bgColor: '#e2f5f9', textColor: '#005f73' };
        }
        return { tone: 'default', icon: History, bgColor: '#f4f4f4', textColor: '#636363' };
    };

    const filterOptions = [
        { label: 'All Events', value: '' },
        
        // Orders
        { label: 'Order Created', value: 'ORDER_CREATED' },
        { label: 'Order Cancelled', value: 'ORDER_CANCELLED' },
        { label: 'Order Refunded', value: 'ORDER_REFUNDED' },
        
        // Inventory
        { label: 'Inventory Deducted', value: 'INVENTORY_DEDUCTED' },
        { label: 'Inventory Restored', value: 'INVENTORY_RESTORED' },
        { label: 'Manual Inventory Updated', value: 'INVENTORY_UPDATED' },
        { label: 'Bulk Inventory Updated', value: 'INVENTORY_BULK_UPDATE' },
        { label: 'Shopify Pots Synced', value: 'SHOPIFY_POTS_SYNC' },

        // Products
        { label: 'Product Created', value: 'PRODUCT_CREATED' },
        { label: 'Product Configured', value: 'PRODUCT_CONFIGURED' },
        { label: 'Product Toggled', value: 'PRODUCT_TOGGLED' },
        { label: 'Product Config Deleted', value: 'PRODUCT_CONFIG_DELETED' },
        { label: 'Shopify Sync Update', value: 'SHOPIFY_SYNC_UPDATE' },
        { label: 'Shopify Sync Delete', value: 'SHOPIFY_SYNC_DELETE' },

        // Pot Colors
        { label: 'Pot Color Created', value: 'POT_COLOR_CREATED' },
        { label: 'Pot Color Updated', value: 'POT_COLOR_UPDATED' },
        { label: 'Pot Color Deleted', value: 'POT_COLOR_DELETED' },

        // Images
        { label: 'Image Uploaded/Synced', value: 'IMAGE_UPLOADED_SYNCED' },
        { label: 'Image Deleted', value: 'IMAGE_DELETED' },

        // Errors
        { label: 'Webhook Errors', value: 'WEBHOOK_ERROR' }
    ];

    return (
        <Page title="Store Activity" subtitle="Real-time timeline of store events and inventory changes.">
            <Layout>
                <Layout.Section>
                    <BlockStack gap="500">
                        <Card padding="0">
                            <Box padding="400">
                                <InlineStack align="space-between" blockAlign="center">
                                    <InlineStack gap="200">
                                        <Filter size={18} color="#636363" />
                                        <Text variant="headingMd">Event Filtering</Text>
                                    </InlineStack>
                                    <div style={{ width: '250px' }}>
                                        <Select
                                            label="Show event type:"
                                            labelHidden
                                            options={filterOptions}
                                            value={filter}
                                            onChange={setFilter}
                                        />
                                    </div>
                                </InlineStack>
                            </Box>
                            <Divider />

                            <ResourceList
                                loading={loading}
                                resourceName={{ singular: 'log', plural: 'logs' }}
                                items={logs}
                                renderItem={(log) => {
                                    const { tone, icon: EventIcon, bgColor, textColor } = getEventStyling(log.event_type);
                                    const date = new Date(log.created_at);

                                    return (
                                        <ResourceItem id={log.id.toString()}>
                                            <InlineStack align="space-between" blockAlign="center">
                                                <InlineStack gap="400" blockAlign="center">
                                                    <div style={{
                                                        width: 36, height: 36,
                                                        borderRadius: '50%',
                                                        backgroundColor: bgColor,
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        color: textColor
                                                    }}>
                                                        <EventIcon size={18} />
                                                    </div>
                                                    <BlockStack gap="050">
                                                        <Text variant="bodyMd" fontWeight="semibold">
                                                            {log.event_type.replace(/_/g, ' ')}
                                                        </Text>
                                                        <Text tone="subdued" variant="bodySm">{log.description}</Text>
                                                    </BlockStack>
                                                </InlineStack>

                                                <BlockStack align="end" gap="100">
                                                    <Text variant="bodySm" tone="subdued">{date.toLocaleTimeString()} • {date.toLocaleDateString()}</Text>
                                                    {log.metadata && Object.keys(log.metadata).length > 0 && (
                                                        <Badge tone={tone} size="small">
                                                            Details: {Object.keys(log.metadata).length} tags
                                                        </Badge>
                                                    )}
                                                </BlockStack>
                                            </InlineStack>
                                        </ResourceItem>
                                    );
                                }}
                                emptyState={(
                                    <EmptyState
                                        heading="No log data found"
                                        image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                                    >
                                        <p>Activities will appear here once you start configuring products or receiving orders.</p>
                                    </EmptyState>
                                )}
                            />
                        </Card>
                    </BlockStack>
                </Layout.Section>
            </Layout>
        </Page>
    );
}

export default ActivityLog;
