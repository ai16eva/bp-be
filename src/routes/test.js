const express = require('express');
const router = express.Router({ strict: true });
const testController = require('../controllers/testController');


router.get('/generate_referrals', testController.generateReferral)
router.get('/referrals',
    /*
     * #swagger.auto=true
     */
    testController.getReferrals
)
module.exports = router;