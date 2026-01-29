const heliusService = require('./helius.service');

class WebhookUpdateQueue {
  constructor() {
    this.pendingNewOwners = new Set();
    this.isUpdating = false;
    this.lastUpdateTime = 0;
    this.MIN_DELAY = 30 * 1000;
    this.MAX_PENDING_OWNERS = 10;
    this.stats = {
      totalUpdates: 0,
      totalNewOwners: 0,
      creditsUsed: 0,
      lastResetDate: new Date().toDateString(),
    };
    this.updateTimer = null;
  }

  addNewOwner(ownerWallet) {
    const first = this.pendingNewOwners.size === 0;
    this.pendingNewOwners.add(ownerWallet);
    this.stats.totalNewOwners++;
    if (this.pendingNewOwners.size >= this.MAX_PENDING_OWNERS || first)
      this.triggerUpdate(this.pendingNewOwners.size >= this.MAX_PENDING_OWNERS);
  }

  triggerUpdate(force = false) {
    if (this.isUpdating || !this.pendingNewOwners.size) return;
    if (this.updateTimer) clearTimeout(this.updateTimer);

    const remaining = Math.max(
      0,
      this.MIN_DELAY - (Date.now() - this.lastUpdateTime)
    );
    if (force || remaining === 0) return this.executeUpdate();

    this.updateTimer = setTimeout(() => this.executeUpdate(), remaining);
  }

  async executeUpdate() {
    if (this.isUpdating || !this.pendingNewOwners.size) return;

    this.isUpdating = true;
    const ownersToAdd = Array.from(this.pendingNewOwners);

    try {
      const webhookId = process.env.HELIUS_WEBHOOK_ID;
      if (!webhookId) throw new Error('HELIUS_WEBHOOK_ID not configured');

      console.log(`Updating webhook for ${ownersToAdd.length} owners...`);
      await heliusService.updateWebhook(webhookId);

      console.log(
        `Webhook updated. New owners: ${ownersToAdd.slice(0, 3).join(', ')}${
          ownersToAdd.length > 3 ? '...' : ''
        }`
      );
      this.pendingNewOwners.clear();
      this.lastUpdateTime = Date.now();
      this.stats.totalUpdates++;
      this.stats.creditsUsed += 100;
      this.resetDailyStatsIfNeeded();
    } catch (err) {
      console.error('Webhook update failed:', err.message);
      setTimeout(() => {
        this.isUpdating = false;
        this.triggerUpdate(false);
      }, 60 * 1000);
      return;
    }

    this.isUpdating = false;
  }

  resetDailyStatsIfNeeded() {
    const today = new Date().toDateString();
    if (this.stats.lastResetDate !== today) {
      this.stats.totalUpdates = 0;
      this.stats.creditsUsed = 0;
      this.stats.lastResetDate = today;
    }
  }

  getStats() {
    return {
      ...this.stats,
      pendingOwners: this.pendingNewOwners.size,
      isUpdating: this.isUpdating,
      timeSinceLastUpdate: Date.now() - this.lastUpdateTime,
    };
  }
}

module.exports = new WebhookUpdateQueue();
