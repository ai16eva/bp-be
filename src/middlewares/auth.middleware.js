const config = require('../config/helius.config');

function verifyWebhook(req, res, next) {
  const authHeader = req.headers.authorization;
  const expectedAuth = `Bearer ${config.webhookSecret}`;

  if (authHeader !== expectedAuth) {
    console.warn('Unauthorized webhook request');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  next();
}

module.exports = { verifyWebhook };
