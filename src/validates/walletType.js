const WalletTypeInvalid = require('../exceptions/WalletTypeInvalid');

function validateWalletType(role) {
    const validWallets = ['METAMASK', 'BACKPACK', 'COINBASE', 'RAINBOW', 'WALLETCONNECT'];
    const walletType = role.toUpperCase();

    if (!validWallets.includes(walletType)) {
        throw new WalletTypeInvalid();
    }

    return walletType;
}

module.exports = validateWalletType;