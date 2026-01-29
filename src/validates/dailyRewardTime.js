function isToday(standardizedDate) {
  const todayUTC = new Date();
  todayUTC.setUTCHours(0, 0, 0, 0);
  if (standardizedDate.getTime() !== todayUTC.getTime()) {
    throw new Error('Claimed date must be today in UTC');
  }
}

module.exports = isToday;
