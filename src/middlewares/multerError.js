const multer = require('multer');
const { err } = require('../utils/responses');

const handleError = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      error.message = 'File is too large';
      return res.status(400).json(err(error));
    }

    if (error.code === 'LIMIT_FILE_COUNT') {
      error.message = 'File limit reached';
      return res.status(400).json(err(error));
    }

    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      error.message = 'File must be of type jpeg/png/mp4';
      return res.status(400).json(err(error));
    }

    return res.status(400).json(err(error));
  }

  next(error);
};

module.exports = handleError;
