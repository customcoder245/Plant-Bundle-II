import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Link as ReactRouterLink } from 'react-router-dom';
import { AppProvider } from '@shopify/polaris';
import '@shopify/polaris/build/esm/styles.css';
import './index.css';
import App from './App';

const Link = ({ children, url, ...rest }) => {
    return (
        <ReactRouterLink to={url} {...rest}>
            {children}
        </ReactRouterLink>
    );
};

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <AppProvider linkComponent={Link}>
            <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                <App />
            </BrowserRouter>
        </AppProvider>
    </React.StrictMode>
);
