require('dotenv').config();
const createError = require('http-errors');
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const cors = require('cors');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const swaggerFile = require('./swagger/swagger_output.json');

const indexRouter = require('./src/routes/index');
const memberRouter = require('./src/routes/member');
const questRouter = require('./src/routes/quest');
const bettingRouter = require('./src/routes/betting');
const questDaoRouter = require('./src/routes/questDao');
const marketRouter = require('./src/routes/market');
const voteRouter = require('./src/routes/vote');
const seasonRouter = require('./src/routes/season');
const questCategoryRouter = require('./src/routes/questCategory');
const boardRouter = require('./src/routes/board');
const checkinRouter = require('./src/routes/checkin');
const testRouter = require('./src/routes/test');
const solanaTestRouter = require('./src/routes/solana-test');
const nftRouter = require('./src/routes/nft');
const webhookRoutes = require('./src/routes/webhook.routes');
const { adminAuth } = require('./src/middlewares/authWeb3');
const app = express();

// CORS configuration
const corsOptions = {
  origin: process.env.CORS
    ? process.env.CORS.split(',')
    : ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'x-auth-message',
    'x-auth-signature',
    'x-admin-sk-b58',
  ],
  exposedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 200,
};
app.use(cors(corsOptions));
app.use(logger('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

app.get('/', indexRouter);
app.use(
  '/api-docs',
  swaggerUi.serve,
  swaggerUi.setup(swaggerFile, { explorer: true })
);
app.use('/member', memberRouter);
app.use('/quests', questRouter);
app.use('/quest-dao', adminAuth, questDaoRouter);
app.use('/market', marketRouter);
app.use('/betting', bettingRouter);
app.use('/quests/:quest_key/vote', voteRouter);
// Expose admin vote endpoints under /vote as well (e.g., /vote/admin/initialize-governance)
app.use('/vote', voteRouter);
app.use('/season', seasonRouter);
app.use('/quest-category', questCategoryRouter);
app.use('/board', boardRouter);
app.use('/checkin', checkinRouter);
app.use('/test', testRouter);
app.use('/solana-test', solanaTestRouter);
app.use('/nfts', nftRouter);
app.use('/api/webhooks', webhookRoutes);

app.use(function (req, res) {
  res
    .status(404)
    .send('<h1>Hmmm!~~~ Sorry, I cannot find what you are looking for.</h1>');
});

// error handler
app.use(function (req, res, next) {
  res
    .status(500)
    .send(
      '<h1>Oops! Server is not running well. Please contact admin.</h1> <br/> <p>Internal server error [500]</p>'
    );
});

module.exports = app;
