const DateFormatInvalid = require('../exceptions/DateFormatInvalid');

const blockTimestampToDate = (timestamp) => {
  const numericTimestamp = Number(timestamp);

  if (isNaN(numericTimestamp)) {
    throw new Error('Invalid timestamp: must be a number or numeric string');
  }

  return new Date(numericTimestamp * 1000);
};

const standardizeToMidnight = (dateString) => {
  const standardizedDate = new Date(dateString);
  if (isNaN(standardizedDate.getTime())) {
    throw new Error('Invalid date format');
  }
  standardizedDate.setUTCHours(0, 0, 0, 0);

  return standardizedDate;
};

const getMonthDateRange = (yearMonth) => {
  if (!yearMonth) {
    return { startDate: null, endDate: null };
  }

  if (!/^\d{4}-\d{2}$/.test(yearMonth)) {
    throw new Error('Invalid yearMonth format. Use YYYY-MM.');
  }

  const [year, month] = yearMonth.split('-').map(Number);
  const startDate = new Date(Date.UTC(year, month - 1, 1));
  const endDate = new Date(Date.UTC(year, month, 0));
  endDate.setUTCHours(23, 59, 59, 999);

  return { startDate, endDate };
};

const sleep = (ms) => {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
  blockTimestampToDate,
  standardizeToMidnight,
  getMonthDateRange,
  sleep,
};
