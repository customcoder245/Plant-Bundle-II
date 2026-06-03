import React from 'react';
import { Page, Layout, Card, Text, BlockStack, List, Badge, InlineStack } from '@shopify/polaris';

function Settings() {
    return (
        <Page title="Settings">
            <Layout>
                <Layout.Section>
                    <Card>
                        <BlockStack gap="400">
                            <Text variant="headingMd" as="h2">System Configuration</Text>
                            <Text as="p">Your app is currently using the <strong>Admin API Token</strong> from your environment variables for Shopify communication.</Text>
                            <InlineStack gap="200">
                                <Badge tone="success">Connected to API</Badge>
                                <Badge tone="info">Railway Environment</Badge>
                            </InlineStack>
                        </BlockStack>
                    </Card>
                </Layout.Section>

                <Layout.Section>
                    <Card>
                        <BlockStack gap="400">
                            <Text variant="headingMd" as="h2">Webhook Configuration</Text>
                            <Text as="p">If you are moving from local development to Railway, these webhooks should be updated in your Shopify App setup:</Text>
                            <List>
                                <List.Item>Orders Create: <code>/api/webhooks/orders/create</code></List.Item>
                                <List.Item>Orders Cancelled: <code>/api/webhooks/orders/cancelled</code></List.Item>
                            </List>
                        </BlockStack>
                    </Card>
                </Layout.Section>

                <Layout.Section>
                    <Card>
                        <BlockStack gap="400">
                            <Text variant="headingMd" as="h2">Database Status</Text>
                            <Text as="p">Database: <strong>PostgreSQL (Neon)</strong></Text>
                            <Text as="p">Migrations: <strong>Automated on startup</strong></Text>
                        </BlockStack>
                    </Card>
                </Layout.Section>
            </Layout>
        </Page>
    );
}

export default Settings;
