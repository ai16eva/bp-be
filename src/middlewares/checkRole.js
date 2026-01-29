const { err } = require('../utils/responses');
const checkRole = (roles) => async (req, res, next) => {
    // const found = roles.find((role) => role.toUpperCase() === req.user.role);
    // if (!found) {
    //     return res.status(401).json(err('', 'Authorization Failed!'));
    // }
    next();
};

module.exports = checkRole;
