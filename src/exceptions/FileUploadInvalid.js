const CustomErrorCase = require('./CustomErrorCase');

class FileUploadInvalid extends CustomErrorCase {
  constructor(message = 'File upload invalid') {
    super(405, message);
  }
}

module.exports = FileUploadInvalid;
