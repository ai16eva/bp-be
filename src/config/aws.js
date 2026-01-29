require('dotenv').config();

module.exports = {
  accessKeyId: process.env.ACCESSKEYID, //aws accesskeyid
  secretAccessKey: process.env.SECRETACCESSKEY, //aws s3 secreaccesskey
  region: process.env.REGION,
  bucket: process.env.BUCKET_NAME,
};
