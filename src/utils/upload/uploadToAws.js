const { accessKeyId, secretAccessKey, region, bucket } = require('../../config/aws');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const S3UploadError = require('../../exceptions/S3UploadError');
const uuid = require('uuid').v4;
const AWS_URL = 'https://boomplay-demo.s3.ap-northeast-1.amazonaws.com/';

exports.s3Upload = async (file) => {
  if (!file || !file.buffer || !file.originalname) {
    throw new S3UploadError('Invalid file object');
  }
  const s3client = new S3Client({
    region: region,
    credentials: {
      accessKeyId: accessKeyId,
      secretAccessKey: secretAccessKey,
    },
  });

  const fileExtension = file.originalname.split('.').pop();
  const safeFileName = `boomplay/${uuid()}.${fileExtension}`;

  const params = {
    Bucket: bucket,
    Key: safeFileName,
    Body: file.buffer,
    ContentType: file.mimetype,
    // ACL: 'public-read'
  };

  try {
    const result = await s3client.send(new PutObjectCommand(params));
    if (result && result.$metadata && result.$metadata.httpStatusCode === 200) {
      return `${AWS_URL}${safeFileName}`;
    } else {
      throw new S3UploadError();
    }
  } catch (error) {
    throw new S3UploadError(error.message);
  }
};
