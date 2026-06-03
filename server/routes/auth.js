const express = require('express');
const router = express.Router();

router.get('/callback', async (req, res) => {
    res.json({ status: 'authenticated' });
});

router.get('/session', async (req, res) => {
    res.json({ shop: req.query.shop || 'demo-shop' });
});

module.exports = router;
