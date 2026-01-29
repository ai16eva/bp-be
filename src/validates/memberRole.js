const MemberRoleInvalid = require('../exceptions/MemberRoleInvalid');

function validateRole(role) {
  const validRoles = ['ADMIN', 'USER'];
  const upperRole = role.toUpperCase();

  if (!validRoles.includes(upperRole)) {
    throw new MemberRoleInvalid();
  }

  return upperRole;
}

module.exports = validateRole;
