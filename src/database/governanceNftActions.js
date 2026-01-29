const models = require('../models/mysql');
const { Op } = require('sequelize');
const GovernanceNft = models.governance_nfts;
const GovernanceNftOwner = models.governance_nft_owners;

const governanceNftActions = {
  upsertNft: async (mint, metadataAccount, collectionAddress) => {
    await GovernanceNft.upsert({
      mint,
      metadata_account: metadataAccount,
      collection_address: collectionAddress,
    });
  },

  upsertOwner: async (mint, tokenAccount, ownerWallet, amount = 1) => {
    const [row] = await GovernanceNftOwner.upsert({
      mint,
      token_account: tokenAccount,
      owner_wallet: ownerWallet,
      amount,
    }, { returning: true });
    return row;
  },

  clearOwnersForMint: async (mint) => {
    await GovernanceNftOwner.destroy({ where: { mint } });
  },

  getByOwner: async (ownerWallet, collectionAddress) => {
    const nfts = await GovernanceNft.findAll({
      where: { collection_address: collectionAddress },
      include: [{
        model: GovernanceNftOwner,
        as: 'owners',
        where: { owner_wallet: ownerWallet, amount: { [Op.gt]: 0 } },
        required: true,
      }],
    });

    return nfts.map(n => ({
      mint: n.mint,
      metadataAccount: n.metadata_account,
      tokenAccount: n.owners?.[0]?.token_account,
      amount: n.owners?.[0]?.amount ?? 1,
    }));
  },
};

if (!GovernanceNft.associations.owners) {
  GovernanceNft.hasMany(GovernanceNftOwner, { foreignKey: 'mint', sourceKey: 'mint', as: 'owners' });
  GovernanceNftOwner.belongsTo(GovernanceNft, { foreignKey: 'mint', targetKey: 'mint', as: 'nft' });
}

module.exports = governanceNftActions;


