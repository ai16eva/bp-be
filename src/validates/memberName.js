/**
 * Member Name Validation
 * Validates user name for security and data quality
 */

const InvalidName = require('../exceptions/InvalidName');

/**
 * Validate member name
 * @param {string} name - Name to validate
 * @param {object} options - Validation options
 * @param {number} options.minLength - Minimum length (default: 1)
 * @param {number} options.maxLength - Maximum length (default: 50)
 * @param {boolean} options.allowEmpty - Allow empty string (default: false)
 * @returns {string} Validated name
 * @throws {InvalidName} If validation fails
 */
const validateName = (name, options = {}) => {
  const {
    minLength = 1,
    maxLength = 50,
    allowEmpty = false,
  } = options;

  // Allow empty if specified
  if (allowEmpty && (name === null || name === undefined || name === '')) {
    return '';
  }

  // Check if name is provided
  if (name === null || name === undefined || name === '') {
    throw new InvalidName('Name is required');
  }

  // Must be a string
  if (typeof name !== 'string') {
    throw new InvalidName('Name must be a string');
  }

  // Trim whitespace
  const trimmedName = name.trim();

  // Check length
  if (trimmedName.length < minLength) {
    throw new InvalidName(`Name must be at least ${minLength} character(s) long`);
  }

  if (trimmedName.length > maxLength) {
    throw new InvalidName(`Name must not exceed ${maxLength} characters`);
  }

  // Check for XSS patterns (basic)
  const xssPatterns = [
    /<script/i,
    /javascript:/i,
    /on\w+\s*=/i, // onclick, onload, etc.
    /<iframe/i,
    /<object/i,
    /<embed/i,
  ];

  for (const pattern of xssPatterns) {
    if (pattern.test(trimmedName)) {
      throw new InvalidName('Name contains invalid characters or patterns');
    }
  }

  // Check for excessive special characters (more than 30% of length)
  const specialCharCount = (trimmedName.match(/[^a-zA-Z0-9\s\-_\.]/g) || []).length;
  if (specialCharCount > trimmedName.length * 0.3) {
    throw new InvalidName('Name contains too many special characters');
  }

  return trimmedName;
};

module.exports = validateName;

