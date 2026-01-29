const express = require('express');
const router = express.Router();
const webhookController = require('../controllers/webhook.controller');
const { verifyWebhook } = require('../middlewares/auth.middleware');

router.post('/helius', (req, res) => {
  webhookController.handleWebhook(req, res);
});

module.exports = router;
