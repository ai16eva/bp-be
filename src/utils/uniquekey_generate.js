const crypto = require('crypto');

let lastTimestamp = 0;
let sequence = 0;

function generateUniqueKey(length = 16) {
  const now = Date.now();
  const timestamp = Math.floor(now / 1000);

  if (timestamp <= lastTimestamp) {
    sequence = (sequence + 1) % 1000;
  } else {
    sequence = 0;
    lastTimestamp = timestamp;
  }

  const base = `${timestamp}${sequence.toString().padStart(3, '0')}${(now % 1000).toString().padStart(3, '0')}`;

  const random = crypto.randomInt(1000000).toString().padStart(6, '0');

  const combined = (base + random).slice(0, length);

  const finalKey = combined.padEnd(length, () => crypto.randomInt(10).toString());

  return BigInt(finalKey);
}

module.exports = generateUniqueKey;
