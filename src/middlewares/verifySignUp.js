const models = require('../models/mysql')
const {err} = require('../utils/responses')
const Member = models.members
checkMemDuplicate = (req, res, next) => {
  // Membername
  if(!req.body.wallet_address){
     res.status(400).json(err('', 'wallet address is required !'))
     return;
    }
  Member.findOne({
    where: {
      wallet_address: req.body.wallet_address
    }
  }).then(user => {
    if (user) {
      res.status(409).json(err('', "Failed! wallet address is already in use!"));
      return;
    }

    // Email
    if(!req.body.email) {      
      res.status(400).json(err('', 'Email is required !'))
      return;
    }
    const emailRegexp = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    if (!emailRegexp.test(req.body.email)) return res.status(400).json(err('', 'Your email is not valid'))
    Member.findOne({
      where: {
        member_email: req.body.email
      }
    }).then(user => {
      if (user) {
        res.status(409).json(err('', "Failed! Email is already in use!"));
        return;
      }

      next();
    });
  });
};


module.exports = {
  checkMemDuplicate: checkMemDuplicate,
};
