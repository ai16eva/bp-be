const fetch = require('node-fetch');

let cachedCreators = null;
let cacheTimestamp = null;
const CACHE_DURATION =  0;//1 * 60 * 1000; 

const parseCSV = (csv) => {
  const lines = csv.trim().split('\n');
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));
  const walletIndex = headers.findIndex(h => h === 'wallet_address' || h === 'wallet');

  if (walletIndex === -1) return [];

  return lines.slice(1).map((line) => {
    const values = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || [];
    const cleanValues = values.map(v => v.replace(/^"|"$/g, '').trim());

    return {
      wallet_address: cleanValues[walletIndex] || '',
      name: cleanValues[headers.indexOf('name')] || null,
      created_at: cleanValues[headers.indexOf('created_at')] || null,
    };
  }).filter(c => c.wallet_address);
};

const fetchCreators = async () => {
  const sheetUrl = process.env.CREATOR_SHEET_URL;
  if (!sheetUrl) {
    return [];
  }

  if (cachedCreators && cacheTimestamp && (Date.now() - cacheTimestamp < CACHE_DURATION)) {
    return cachedCreators;
  }

  try {
    const response = await fetch(sheetUrl);
    if (!response.ok) {
      console.error('Failed to fetch Google Sheet:', response.statusText);
      return cachedCreators || [];
    }

    const csv = await response.text();
    cachedCreators = parseCSV(csv);
    cacheTimestamp = Date.now();

    return cachedCreators;
  } catch (error) {
    console.error('Error fetching Google Sheet:', error);
    return cachedCreators || [];
  }
};

const isCreator = async (walletAddress) => {
  if (!walletAddress) return false;

  const creators = await fetchCreators();
  return creators.some(
    c => c.wallet_address.toLowerCase() === walletAddress.toLowerCase()
  );
};

const getCreatorInfo = async (walletAddress) => {
  if (!walletAddress) return null;

  const creators = await fetchCreators();
  return creators.find(
    c => c.wallet_address.toLowerCase() === walletAddress.toLowerCase()
  ) || null;
};

const clearCache = () => {
  cachedCreators = null;
  cacheTimestamp = null;
};

module.exports = {
  fetchCreators,
  isCreator,
  getCreatorInfo,
  clearCache,
};
