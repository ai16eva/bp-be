const express = require('express');
const router = express.Router({ strict: true });
const checkinController = require('../controllers/checkinController');

router.post(
    '/:wallet_address',
    /*
    #swagger.auto = true
    #swagger.tags =['Checkin']
    #swagger.summary='Add checkin of the corresponding user(wallet_address)'
     */
    checkinController.checkin,
)
router.get(
    '/:wallet_address',
    /*
    #swagger.auto=true
    #swagger.tags =['Checkin','NEW']
    #swagger.summary='Return checkin info of the corresponding user'
     */
    checkinController.getCheckin
);

module.exports = router;