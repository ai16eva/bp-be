const AuthenticationInvalid = require('../exceptions/AuthenticationInvalid');

exports.isAdmin = (member) => {
  if (member.role !== 'ADMIN') throw new AuthenticationInvalid('Forbidden access: Not Admin');
};
