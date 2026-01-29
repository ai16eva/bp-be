/**
 * Invalid Name Exception
 * Thrown when name validation fails
 */

class InvalidName extends Error {
  constructor(message) {
    super(message);
    this.name = 'InvalidName';
    this.statusCode = 400;
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = InvalidName;

