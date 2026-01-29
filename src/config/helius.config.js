require('dotenv').config();

module.exports = {
  apiKey: process.env.HELIUS_API_KEY,
  webhookUrl: process.env.WEBHOOK_URL,
  webhookSecret: process.env.WEBHOOK_SECRET,
  network: process.env.SOLANA_NETWORK_DEV || 'devnet',
  apiBaseUrl: 'https://api.helius.xyz/v0',
};
