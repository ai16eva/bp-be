const db = require('../models/mysql');

class NFTWebhookService {
  async processTransfers(tokenTransfers, timestamp) {
    if (!tokenTransfers?.length)
      return { processed: 0, skipped: 0, newOwners: [] };

    let processed = 0,
      skipped = 0;
    const newOwners = [];

    for (const transfer of tokenTransfers) {
      try {
        const { success, isNewOwner, ownerWallet } =
          await this.processSingleTransfer(transfer, timestamp);
        if (success) {
          processed++;
          if (isNewOwner && ownerWallet) newOwners.push(ownerWallet);
        } else skipped++;
      } catch (err) {
        console.error(`Error processing ${transfer.mint}:`, err.message);
        skipped++;
      }
    }

    return { processed, skipped, newOwners };
  }

  async processSingleTransfer(
    { mint, fromUserAccount, toUserAccount, tokenAmount, toTokenAccount },
    timestamp
  ) {
    if (tokenAmount != 1) return { success: false };
    if (!(await this.isOurCollectionNFT(mint))) return { success: false };

    console.log(`Processing NFT: ${mint}`);

    if (fromUserAccount) {
      const removed = await db.governance_nft_owners.destroy({
        where: { mint, owner_wallet: fromUserAccount },
      });
      if (removed) console.log(`Removed from ${fromUserAccount}`);
    }

    if (toUserAccount) {
      const exists = await db.governance_nft_owners.findOne({
        where: { owner_wallet: toUserAccount },
        attributes: ['id'],
      });
      const isNewOwner = !exists;

      await db.governance_nft_owners.upsert({
        mint,
        token_account: toTokenAccount,
        owner_wallet: toUserAccount,
        amount: 1,
        updated_at: timestamp || new Date(),
      });

      if (isNewOwner) console.log(`NEW OWNER: ${toUserAccount}`);
      console.log(`ATA: ${toTokenAccount}`);

      return { success: true, isNewOwner, ownerWallet: toUserAccount };
    }

    return { success: false };
  }

  async isOurCollectionNFT(mint) {
    const nft = await db.governance_nfts.findOne({
      where: { mint },
      attributes: ['id'],
    });
    return !!nft;
  }
}

module.exports = new NFTWebhookService();
