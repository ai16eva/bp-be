const CustomErrorCase = require('./CustomErrorCase');

class S3UploadError extends CustomErrorCase {
  constructor(message = 'S3 Upload faild') {
    super(400, message);
  }
}

module.exports = S3UploadError;
