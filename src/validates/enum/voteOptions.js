const MissingRequiredParameter = require('../../exceptions/MissingRequiredParameter');
const OptionInvalid = require('../../exceptions/OptionInvalid');
const VotePowerInvalid = require('../../exceptions/VotePowerInvalid');

const validateDraftOp = (option) => {
  const validOptions = ['APPROVE', 'REJECT'];
  if (!option || option.trim() === '') {
    throw new MissingRequiredParameter();
  }
  if (!validOptions.includes(option.toUpperCase())) {
    throw new OptionInvalid(`Invalid vote_draft_option. Must be one of: ${validOptions.join(', ')}`);
  }

  return option.toUpperCase();
};

const validateSuccessOp = (option) => {
  const validOptions = ['SUCCESS', 'ADJOURN'];
  if (!option || option.trim() === '') {
    throw new MissingRequiredParameter();
  }
  if (!validOptions.includes(option.toUpperCase())) {
    throw new OptionInvalid(`Invalid vote_success_option. Must be one of: ${validOptions.join(', ')}`);
  }

  return option.toUpperCase();
};

const validateVotingPower = (power) => {
  if (typeof power !== 'number' || !power || power === undefined) {
    throw new MissingRequiredParameter('Voting power must be required');
  }
  if (power <= 0 || power >= 30) {
    throw new VotePowerInvalid();
  }
};

module.exports = {
  validateDraftOp,
  validateSuccessOp,
  validateVotingPower,
};
