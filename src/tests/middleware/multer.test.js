const request = require('supertest');
const path = require('path');
const app = require('../../../app');
const setupTestDB = require('../testHelper');
const models = require('../../models/mysql');

describe('File Upload Error Case: Using UpdateMember endPoint', () => {
  setupTestDB(models);

  const testWalletAddress = '0x742d35Cc6634C0532925a3b844Bc454e4438f44e';
  const createTestFile = (filename, content, size, mimetype) => {
    return {
      filename,
      buffer: Buffer.from(content.repeat(Math.ceil(size / content.length)).slice(0, size)),
      mimetype: mimetype || `image/${path.extname(filename).slice(1)}`,
    };
  };

  it('should reject a file that is too large', async () => {
    const file = createTestFile('large.png', 'Large PNG content', 11 * 1024 * 1024, 'image/png');

    const response = await request(app)
      .put(`/member/${testWalletAddress}`)
      .attach('avatar', file.buffer, { filename: file.filename, contentType: file.mimetype });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('File is too large');
    expect(response.body.error).toBe('MulterError');
  });

  it('should reject an unexpected file type', async () => {
    const file = createTestFile('test.txt', 'Text content', 1024, 'text/plain');
    const response = await request(app)
      .put(`/member/${testWalletAddress}`)
      .attach('avatar', file.buffer, { filename: file.filename, contentType: file.mimetype });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('File must be of type jpeg/png/mp4');
    expect(response.body.error).toBe('MulterError');
  });

  it('should reject multiple file uploads', async () => {
    const file1 = createTestFile('file1.png', 'PNG content', 1 * 1024 * 1024, 'image/png');
    const file2 = createTestFile('file2.jpg', 'JPEG content', 1 * 1024 * 1024, 'image/jpeg');

    const response = await request(app)
      .put(`/member/${testWalletAddress}`)
      .attach('avatar', file1.buffer, { filename: file1.filename, contentType: file1.mimetype })
      .attach('avatar', file2.buffer, { filename: file2.filename, contentType: file2.mimetype });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('File limit reached');
    expect(response.body.error).toBe('MulterError');
  });
});
