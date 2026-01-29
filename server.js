// Load environment variables based on NODE_ENV (e.g., .env.dev, .env.prod)
try {
  const path = require('path');
  const envName = process.env.NODE_ENV ? `.env.${process.env.NODE_ENV}` : '.env';
  require('dotenv').config({ path: path.resolve(process.cwd(), envName) });
  // Fallback to default .env without overriding existing vars
  require('dotenv').config();
} catch (_) {
  // ignore dotenv errors
}

const cron = require('node-cron')
const app = require('./app');
const debug = require('debug')('api:server');
const http = require('http');
const { daoVotingResult } = require('./src/utils/jobs/daoVotting')
const { setQuestFinish } = require('./src/utils/jobs/finishBetting')
const { calculateRewards } = require('./src/utils/jobs/calculateRewards')
const {rewardReferrals, runRewards} = require('./src/utils/jobs/referralReward')
const {rewardCheckins} = require('./src/utils/jobs/checkinReward')

const port = normalizePort(process.env.PORT || '3000');
app.set('port', port);

var server = http.createServer(app);

cron.schedule("*/5 * * * *", async () => { //set scheduler time

  // await daoVotingResult()
  // await calculateRewards()
  console.log('Server started running')
  await rewardReferrals(5)
  await rewardCheckins(5)
  await runRewards()
  // await rewardReferrals(10)
  console.log('Server ended running')
})
server.listen(port);
server.on('error', onError);
server.on('listening', onListening);

function normalizePort(val) {
  var port = parseInt(val, 10);

  if (isNaN(port)) {
    // named pipe
    return val;
  }

  if (port >= 0) {
    // port number
    return port;
  }

  return false;
}

/**
 * Event listener for HTTP server "error" event.
 */

function onError(error) {
  if (error.syscall !== 'listen') {
    throw error;
  }

  var bind = typeof port === 'string'
    ? 'Pipe ' + port
    : 'Port ' + port;

  // handle specific listen errors with friendly messages
  switch (error.code) {
    case 'EACCES':
      console.error(bind + ' requires elevated privileges');
      process.exit(1);
      break;
    case 'EADDRINUSE':
      console.error(bind + ' is already in use');
      process.exit(1);
      break;
    default:
      throw error;
  }
}

/**
 * Event listener for HTTP server "listening" event.
 */

function onListening() {
  var addr = server.address();
  var bind = typeof addr === 'string'
    ? 'pipe ' + addr
    : 'port ' + addr.port;
  debug('Listening on ' + bind);
}
