const axios = require('axios');
const config = require('../config/helius.config');
const models = require('../models/mysql');

const GovernanceNftOwner = models.governance_nft_owners;

class HeliusService {
  async getAllOwnerWallets() {
    const owners = await GovernanceNftOwner.findAll({
      attributes: ['owner_wallet'],
    });

    const allWallets = owners.map((o) => o.owner_wallet);

    const uniqueWallets = [...new Set(allWallets)];

    return uniqueWallets;
  }

  async createWebhook() {
    try {
      const webhookType =
        config.network === 'mainnet' ? 'enhanced' : 'enhancedDevnet';
      const ownerWallets = await this.getAllOwnerWallets();

      if (ownerWallets.length === 0) {
        throw new Error('No owners found in database. Add owners first!');
      }

      if (ownerWallets.length > 100000) {
        throw new Error(
          `Too many owners (${ownerWallets.length}). Helius limit is 100,000 addresses.`
        );
      }

      const payload = {
        webhookURL: config.webhookUrl,
        transactionTypes: ['TRANSFER'],
        accountAddresses: ownerWallets,
        webhookType: webhookType,
        txnStatus: 'success',
      };

      if (config.webhookSecret) {
        payload.authHeader = config.webhookSecret;
      }

      const response = await axios.post(
        `${config.apiBaseUrl}/webhooks?api-key=${config.apiKey}`,
        payload
      );

      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async updateWebhook(webhookId) {
    try {
      const webhookType =
        config.network === 'mainnet' ? 'enhanced' : 'enhancedDevnet';
      const ownerWallets = await this.getAllOwnerWallets();

      if (ownerWallets.length === 0) {
        throw new Error('No owners found in database');
      }

      if (ownerWallets.length > 100000) {
        throw new Error(`Too many owners (${ownerWallets.length})`);
      }

      const payload = {
        webhookURL: config.webhookUrl,
        transactionTypes: ['TRANSFER'],
        accountAddresses: ownerWallets,
        webhookType: webhookType,
        txnStatus: 'success',
      };

      if (config.webhookSecret) {
        payload.authHeader = config.webhookSecret;
      }

      const response = await axios.put(
        `${config.apiBaseUrl}/webhooks/${webhookId}?api-key=${config.apiKey}`,
        payload
      );

      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async getWebhooks() {
    try {
      const response = await axios.get(
        `${config.apiBaseUrl}/webhooks?api-key=${config.apiKey}`
      );
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async deleteWebhook(webhookId) {
    try {
      await axios.delete(
        `${config.apiBaseUrl}/webhooks/${webhookId}?api-key=${config.apiKey}`
      );
    } catch (error) {
      throw error;
    }
  }

  parseEvent(event) {
    const { type, timestamp, tokenTransfers, signature, description } = event;

    if (!tokenTransfers || tokenTransfers.length === 0) {
      return null;
    }

    return {
      type,
      timestamp: new Date(timestamp * 1000),
      signature,
      description,
      tokenTransfers: tokenTransfers,
    };
  }
}

module.exports = new HeliusService();
