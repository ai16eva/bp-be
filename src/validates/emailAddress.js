const EmailInvalid = require('../exceptions/EmailInvalid');

/**
 * Check Given Email  is vaild
 * @param {string} email - wallet address
 * @throws {EmailInvalid} If Invalid email
 */
function validateEmail(email) {
  if (typeof email !== 'string' || email.trim() === '') {
    throw new EmailInvalid('Email must be a non-empty string');
  }

  const emailRegexp =
    /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  if (!emailRegexp.test(email)) {
    throw new EmailInvalid();
  }
}

module.exports = validateEmail;
