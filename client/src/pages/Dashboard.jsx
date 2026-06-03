import React, { useState, useEffect } from 'react';
import { Page, Layout, Text, BlockStack, InlineStack, Badge, SkeletonBodyText, Banner, Card, Box, Divider, Button } from '@shopify/polaris';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Palette,
    Package,
    Settings,
    PlusCircle,
    ArrowRight,
    History,
    AlertCircle,
    TrendingUp,
    Box as BoxIcon,
    Leaf
} from 'lucide-react';
import { Link } from 'react-router-dom';

const StatCard = ({ title, value, label, icon: Icon, color, delay }) => (
    <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay }}
        className="premium-card"
    >
        <div className="stat-icon-wrapper" style={{ backgroundColor: `${color}15`, color: color }}>
            <Icon size={24} />
        </div>
        <Text variant="headingSm" as="h3" tone="subdued">{title}</Text>
        <div className="stat-value gradient-text">{typeof value === 'number' ? value.toLocaleString() : value}</div>
        <Text variant="bodySm" tone="subdued">{label}</Text>

        <div style={{ position: 'absolute', bottom: '-10px', right: '-10px', opacity: 0.05, transform: 'rotate(-15deg)' }}>
            <Icon size={80} />
        </div>
    </motion.div>
);

const QuickAction = ({ title, icon: Icon, to, delay, primary }) => (
    <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4, delay }}
    >
        <Link to={to} className="quick-action-btn" style={primary ? { background: 'var(--primary)', color: 'white' } : {}}>
            <Icon size={20} />
            <span style={{ flex: 1 }}>{title}</span>
            <ArrowRight size={16} />
        </Link>
    </motion.div>
);

function Dashboard() {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    useEffect(() => { fetchStats(); }, []);

    const fetchStats = async () => {
        try {
            const [inventoryRes, colorsRes, configRes, activityRes] = await Promise.all([
                fetch('/api/inventory'), fetch('/api/pots/colors'), fetch('/api/product-config'), fetch('/api/activity/stats')
            ]);

            if (!inventoryRes.ok || !colorsRes.ok || !configRes.ok) throw new Error('API Error');

            const inventory = await inventoryRes.json();
            const colors = await colorsRes.json();
            const configs = await configRes.json();
            const activity = await activityRes.json();

            const lowStock = inventory.filter(i => i.is_low_stock).length;
            const totalPots = inventory.reduce((sum, i) => sum + i.quantity, 0);

            setStats({
                totalColors: colors.length,
                totalPots,
                lowStockItems: lowStock,
                configuredProducts: configs.length,
                recentActivity: activity
            });
        } catch (error) {
            console.error('Failed to fetch stats:', error);
            setError(true);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return (
        <Page title="Dashboard">
            <Layout>
                <Layout.Section><SkeletonBodyText lines={10} /></Layout.Section>
            </Layout>
        </Page>
    );

    return (
        <Page fullWidth>
            <div className="dashboard-container">
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{ marginBottom: '2rem' }}
                >
                    <BlockStack gap="200">
                        <Text variant="heading2xl" as="h1">Welcome back!</Text>
                        <Text variant="bodyLg" tone="subdued">Manage your Plant + Pot bundles and inventory with ease.</Text>

                        <div style={{
                            marginTop: '1rem',
                            padding: '12px 18px',
                            background: 'rgba(143, 177, 73, 0.1)',
                            borderLeft: '4px solid #8fb149',
                            borderRadius: '0 12px 12px 0',
                            display: 'inline-block'
                        }}>
                            <InlineStack gap="200" blockAlign="center">
                                <Leaf size={16} color="#1a4d2e" />
                                <Text variant="bodySm" fontWeight="semibold" tone="success">
                                    Quick Care Tip: Madagascar Palms (Pachypodium) thrive in bright direct sun. Keep soil dry between waterings!
                                </Text>
                            </InlineStack>
                        </div>
                    </BlockStack>
                </motion.div>

                <AnimatePresence>
                    {error && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            style={{ marginBottom: '2rem' }}
                        >
                            <Banner title="Connection Warning" tone="warning" onDismiss={() => setError(false)}>
                                <p>There was an issue connecting to the backend. Please check your Shopify API credentials in the Settings.</p>
                            </Banner>
                        </motion.div>
                    )}
                </AnimatePresence>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem', marginBottom: '3rem' }}>
                    <StatCard
                        title="Pot Library"
                        value={stats?.totalColors || 0}
                        label="Available pot styles"
                        icon={Palette}
                        color="#2b6cb0"
                        delay={0.1}
                    />
                    <StatCard
                        title="Total Pot Inventory"
                        value={stats?.totalPots || 0}
                        label={stats?.lowStockItems > 0 ? `${stats.lowStockItems} low stock alerts` : "Stock levels healthy"}
                        icon={BoxIcon}
                        color={stats?.lowStockItems > 0 ? "#c05621" : "#2f855a"}
                        delay={0.2}
                    />
                    <StatCard
                        title="Active Bundles"
                        value={stats?.configuredProducts || 0}
                        label="Live store configs"
                        icon={Package}
                        color="#6b46c1"
                        delay={0.3}
                    />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '3rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.5, delay: 0.4 }}
                            className="premium-card"
                            style={{ padding: 0 }}
                        >
                            <Card padding="0">
                                <Box padding="400">
                                    <InlineStack align="space-between" blockAlign="center">
                                        <Text variant="headingMd">🌿 Recently Configured</Text>
                                        <Button url="/products" variant="tertiary" size="slim">View All</Button>
                                    </InlineStack>
                                </Box>
                                <Divider />
                                <div style={{ padding: '0 16px' }}>
                                    {[
                                        { title: 'Madagascar Palm Plant', sizes: 2, pots: 3, date: '2h ago' },
                                        { title: 'Snake Plant Laurentii', sizes: 3, pots: 5, date: '5h ago' },
                                        { title: 'Monstera Deliciosa', sizes: 1, pots: 4, date: 'Yesterday' }
                                    ].map((b, i) => (
                                        <div key={i} style={{
                                            padding: '12px 0',
                                            borderBottom: i < 2 ? '1px solid #f1f2f3' : 'none',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between'
                                        }}>
                                            <InlineStack gap="300" blockAlign="center">
                                                <div style={{ width: 40, height: 40, background: '#f6f6f7', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                    <Leaf size={20} color="#8fb149" />
                                                </div>
                                                <BlockStack gap="0">
                                                    <Text variant="bodyMd" fontWeight="semibold">{b.title}</Text>
                                                    <Text variant="bodyXs" tone="subdued">{b.sizes} Sizes • {b.pots} Pots</Text>
                                                </BlockStack>
                                            </InlineStack>
                                            <Text variant="bodySm" tone="subdued">{b.date}</Text>
                                        </div>
                                    ))}
                                </div>
                            </Card>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.5, delay: 0.5 }}
                            className="premium-card"
                        >
                            <BlockStack gap="500">
                                <InlineStack align="space-between">
                                    <InlineStack gap="200">
                                        <History size={20} className="gradient-text" />
                                        <Text variant="headingMd" as="h2">System Activity</Text>
                                    </InlineStack>
                                </InlineStack>

                                <div className="activity-list">
                                    {Array.isArray(stats?.recentActivity) && stats.recentActivity.slice(0, 5).map((item, index) => (
                                        <div key={index} className="timeline-item">
                                            <div className="timeline-point" />
                                            <div style={{ flex: 1 }}>
                                                <InlineStack align="space-between">
                                                    <Text variant="bodyMd" fontWeight="semibold">{item.event_type.replace(/_/g, ' ')}</Text>
                                                    <Badge tone="info">{item.count}</Badge>
                                                </InlineStack>
                                                <Text variant="bodySm" tone="subdued">Platform event update</Text>
                                            </div>
                                        </div>
                                    ))}
                                    {(!stats?.recentActivity || stats.recentActivity.length === 0) && (
                                        <div style={{ padding: '2rem', textAlign: 'center' }}>
                                            <AlertCircle size={32} style={{ margin: '0 auto 1rem', opacity: 0.2 }} />
                                            <Text tone="subdued">No recent activity recorded.</Text>
                                        </div>
                                    )}
                                </div>
                            </BlockStack>
                        </motion.div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.5, delay: 0.6 }}
                            className="premium-card"
                        >
                            <BlockStack gap="500">
                                <InlineStack gap="200">
                                    <PlusCircle size={20} className="gradient-text" />
                                    <Text variant="headingMd" as="h2">Quick Actions</Text>
                                </InlineStack>

                                <BlockStack gap="300">
                                    <QuickAction
                                        title="New Bundle Builder"
                                        icon={PlusCircle}
                                        to="/builder"
                                        primary
                                        delay={0.7}
                                    />
                                    <QuickAction
                                        title="Manage Pot Library"
                                        icon={Palette}
                                        to="/pot-colors"
                                        delay={0.8}
                                    />
                                    <QuickAction
                                        title="Inventory Control"
                                        icon={BoxIcon}
                                        to="/inventory"
                                        delay={0.9}
                                    />
                                    <QuickAction
                                        title="Manual Sync"
                                        icon={Settings}
                                        to="/add-product"
                                        delay={1.0}
                                    />
                                </BlockStack>
                            </BlockStack>
                        </motion.div>
                    </div>
                </div>
            </div>
        </Page>
    );
}

export default Dashboard;
