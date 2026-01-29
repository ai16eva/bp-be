const success = (data, message) => {
  return {
    success: 1,
    data: data || [],
    message: message || '',
    error: null,
  };
};

const err = (e) => {
  return {
    success: 0,
    data: null,
    error: e.name || null,
    message: e.message || '',
  };
};

module.exports = {
  success: success,
  err: err,
};
