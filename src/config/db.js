require('dotenv').config();

module.exports = {
  dev: {
    username: process.env.DB_USERNAME_DEV,
    password: process.env.DB_PASSWORD_DEV,
    database: process.env.DB_DATABASE_DEV,
    host: process.env.DB_HOST_DEV,
    port: process.env.DB_PORT_DEV,
    dialect: process.env.DB_CONNECTION_DEV,
    define: {
      timestamps: false,
    },
    dialectOptions: {
      dateStrings: true,
      timezone: '+09:00',
      typeCast(field, next) {
        if (field.type === 'DATETIME') {
          return field.string();
        }
        return next();
      },
    },
    timezone: process.env.TIMEZONE || '+09:00',
    logging: false,
  },
  test: {
    username: process.env.DB_TEST_USERNAME,
    password: process.env.DB_TEST_PASSWORD,
    database: process.env.DB_TEST_DATABASE,
    host: process.env.DB_TEST_HOST,
    port: process.env.DB_TEST_PORT,
    dialect: process.env.DB_TEST_CONNECTION,
    define: {
      timestamps: false,
    },
    dialectOptions: {
      // useUTC: false, //for reading from database
      dateStrings: true,
      timezone: '+09:00',
      typeCast(field, next) {
        // for reading from database
        if (field.type === 'DATETIME') {
          return field.string();
        }
        return next();
      },
    },
    timezone: process.env.TIMEZONE || '+09:00',
    logging: false,
  },
  prod: {
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    dialect: process.env.DB_CONNECTION,
    define: {
      timestamps: false,
    },
    dialectOptions: {
      // useUTC: false, //for reading from database
      dateStrings: true,
      timezone: '+09:00',
      typeCast(field, next) {
        // for reading from database
        if (field.type === 'DATETIME') {
          return field.string();
        }
        return next();
      },
    },
    timezone: process.env.TIMEZONE || '+09:00',
    logging: false,
  },
};
