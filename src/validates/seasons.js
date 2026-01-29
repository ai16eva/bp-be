// seasonValidate.js

const SeasonInvalidDataField = require('../exceptions/SeasonInvalidDataField');

const validateNonEmpty = (value, fieldName) => {
  if (value === undefined || value === null || value === '') {
    throw new SeasonInvalidDataField(`${fieldName} cannot be empty`);
  }
  return value;
};

const validateString = (value, fieldName, minLength = 1, maxLength = 255) => {
  value = validateNonEmpty(value, fieldName);
  if (typeof value !== 'string') {
    throw new SeasonInvalidDataField(`${fieldName} must be a string`);
  }
  if (value.length < minLength || value.length > maxLength) {
    throw new SeasonInvalidDataField(`${fieldName} must be between ${minLength} and ${maxLength} characters`);
  }
  return value;
};

const validateDate = (value, fieldName) => {
  value = validateNonEmpty(value, fieldName);
  const date = new Date(value);
  if (isNaN(date.getTime())) {
    throw new SeasonInvalidDataField(`${fieldName} must be a valid date`);
  }
  return date;
};

const validateNumber = (value, fieldName, min = -Infinity, max = Infinity) => {
  value = validateNonEmpty(value, fieldName);
  const num = Number(value);
  if (isNaN(num)) {
    throw new SeasonInvalidDataField(`${fieldName} must be a number`);
  }
  if (num < min || num > max) {
    throw new SeasonInvalidDataField(`${fieldName} must be between ${min} and ${max}`);
  }
  return num;
};

const validateCategories = (categories) => {
  if (!Array.isArray(categories) || categories.length === 0) {
    throw new SeasonInvalidDataField('Categories must be a non-empty array');
  }
  return categories.map(validateString);
};

const validateUpdateData = (data) => {
  const validatedData = {};

  if (data.hasOwnProperty('title')) {
    validatedData.title = validateString(data.title, 'Title', 1, 100);
  }
  if (data.hasOwnProperty('description')) {
    validatedData.description = validateString(data.description, 'Description', 1, 1000);
  }
  if (data.hasOwnProperty('start_date')) {
    validatedData.start_date = validateDate(data.start_date, 'Start date');
  }
  if (data.hasOwnProperty('end_date')) {
    validatedData.end_date = validateDate(data.end_date, 'End date');
  }
  if (data.hasOwnProperty('min_pay')) {
    validatedData.min_pay = validateNumber(data.min_pay, 'Minimum pay');
  }
  if (data.hasOwnProperty('max_pay')) {
    validatedData.max_pay = validateNumber(data.max_pay, 'Maximum pay');
  }
  if (data.hasOwnProperty('service_fee')) {
    validatedData.service_fee = validateNumber(data.service_fee, 'Service fee', 0, 100);
  }
  if (data.hasOwnProperty('charity_fee')) {
    validatedData.charity_fee = validateNumber(data.charity_fee, 'Charity fee', 0, 100);
  }
  if (data.hasOwnProperty('creator_fee')) {
    validatedData.creator_fee = validateNumber(data.creator_fee, 'Creator fee', 0, 100);
  }
  if (data.hasOwnProperty('max_vote')) {
    validatedData.creator_fee = validateNumber(data.creator_fee, 'Max vote', 0, 100);
  }
  if (data.hasOwnProperty('dao_reward')) {
    validatedData.creator_fee = validateNumber(data.creator_fee, 'Dao reward', 0, 100);
  }

  return validatedData;
};

const validateCategoryOption = (data) => {
  const validatedData = {};

  if (data.hasOwnProperty('title')) {
    validatedData.title = validateString(data.title, 'Title', 1, 100);
  }
  if (data.hasOwnProperty('order')) {
    validatedData.order = validateNumber(data.order, 'Order', 1, 10);
  }

  return validatedData;
};

module.exports = {
  validateTitle: (value) => validateString(value, 'Title', 1, 100),
  validateDescription: (value) => validateString(value, 'Description', 1, 1000),
  validateStartDate: (value) => validateDate(value, 'Start date'),
  validateEndDate: (value) => validateDate(value, 'End date'),
  validateMinPay: (value) => validateNumber(value, 'Minimum pay'),
  validateMaxPay: (value) => validateNumber(value, 'Maximum pay'),
  validateServiceFee: (value) => validateNumber(value, 'Service fee', 0, 100),
  validateCharityFee: (value) => validateNumber(value, 'Charity fee', 0, 100),
  validateCreatorFee: (value) => validateNumber(value, 'Creator fee', 0, 100),
  validateMaxVotes: (value) => validateNumber(value, 'Max Vote', 0, 100),
  validateDaoReward: (value) => validateNumber(value, 'Dao reward', 0, 100),
  validateCategories,
  validateUpdateData,
  validateCategoryOption,
};
