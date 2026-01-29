const express = require('express');
const router = express.Router({ strict: true });
const marketCtrl = require('../controllers/marketController');

router.post('/lock-wallet', marketCtrl.lockWalletAddress);
router.post('/unlock-wallet', marketCtrl.unlockWalletAddress);

router.get('/', marketCtrl.getAllMarkets);
router.get('/:market_key', marketCtrl.getMarketInfo);
router.get('/:market_key/status', marketCtrl.getMarketStatus);
router.get('/:market_key/fee', marketCtrl.getMarketFee);
router.get('/:market_key/answer/:answer_key', marketCtrl.getAnswerInfo);
router.get('/:market_key/user/:wallet_address/bet', marketCtrl.getUserBetInfo);

router.get(
  '/:market_key/user/:wallet_address/winnings',
  marketCtrl.calculateWinnings
);
router.get(
  '/:market_key/user/:wallet_address/available',
  marketCtrl.availableReceiveTokens
);

module.exports = router;
