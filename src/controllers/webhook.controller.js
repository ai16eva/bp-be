const heliusService = require('../services/helius.service');
const nftWebhookService = require('../services/nftWebhook.service');
const webhookUpdateQueue = require('../services/webhookUpdateQueue.service');

class WebhookController {
  async handleWebhook(req, res) {
    res.status(200).send('OK');

    try {
      const events = req.body;
      if (!Array.isArray(events))
        return console.warn('Invalid webhook payload');

      const newOwners = new Set();

      for (const event of events) {
        const parsed = heliusService.parseEvent(event);
        if (!parsed) continue;

        const result = await nftWebhookService.processTransfers(
          parsed.tokenTransfers,
          parsed.timestamp
        );

        console.log(
          `Processed: ${result.processed}, Skipped: ${result.skipped}`
        );

        if (result.newOwners?.length)
          result.newOwners.forEach((owner) => newOwners.add(owner));
      }

      if (newOwners.size) {
        console.log(`New owners found: ${newOwners.size}`);
        newOwners.forEach((owner) => webhookUpdateQueue.addNewOwner(owner));
      }
    } catch (err) {
      console.error('Error processing webhook:', err.message);
    }
  }

  async getStats(req, res) {
    res.json(webhookUpdateQueue.getStats());
  }
}

module.exports = new WebhookController();
