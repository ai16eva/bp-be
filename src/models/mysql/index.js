var fs = require('fs');
var path = require('path');
var Sequelize = require('sequelize');
var basename = path.basename(module.filename);

const env = process.env.NODE_ENV || 'dev';
// Load env files
try {
  require('dotenv').config({ path: path.resolve(process.cwd(), `.env.${env}`) });
  require('dotenv').config();
} catch (_) { }

var config = require('../../config/db');
const dbConfig = config[env];

if (!dbConfig || !dbConfig.dialect) {
  throw new Error(`Database config for environment '${env}' is missing or incomplete. Please check config/db.js and .env.${env}`);
}

const sequelize = new Sequelize({
  dialect: dbConfig.dialect,
  storage: dbConfig.storage,
  host: dbConfig.host,
  port: dbConfig.port,
  database: dbConfig.database,
  username: dbConfig.username,
  password: dbConfig.password,
  logging: false
});

sequelize.sync({ alter: true });

var db = {};

fs.readdirSync(__dirname)
  .filter(function (file) {
    return file.indexOf('.') !== 0 && file != basename;
  })
  .forEach(function (file) {
    if (file.slice(-3) !== '.js') return;
    var model = require(path.join(__dirname, file))(sequelize, Sequelize.DataTypes);
    db[model.name] = model;
  });

//Quests and Answers
db.quests.hasMany(db.answers, { foreignKey: 'quest_key', as: 'answers' });
db.answers.belongsTo(db.quests, {
  foreignKey: 'quest_key',
  as: 'quest',
});

//Quests and Bettings
db.quests.hasMany(db.bettings, { foreignKey: 'quest_key', as: 'bettings' });
db.bettings.belongsTo(db.quests, {
  foreignKey: 'quest_key',
  as: 'quest',
});

//Referrals and Referral codes
db.referral_codes.hasMany(db.referrals, { foreignKey: 'referral_code', sourceKey: 'referral_code', as: 'referrals' });
db.referrals.belongsTo(db.referral_codes, { foreignKey: 'referral_code', targetKey: 'referral_code', as: 'referral_codes' });

//Checkins and members
// db.members.hasMany(db.checkins, { foreignKey: 'wallet_address', as: 'checkins' });
// db.checkins.belongsTo(db.members, { foreignKey: 'wallet_address', as: 'member' });

//Answers and Bettings
db.answers.hasMany(db.bettings, { foreignKey: 'answer_key', as: 'bettings' });
db.bettings.belongsTo(db.answers, {
  foreignKey: 'answer_key',
  as: 'answer',
});

//Seasons and Quest
db.seasons.hasMany(db.quests, { foreignKey: 'season_id', as: 'quests' });
db.quests.belongsTo(db.seasons, {
  foreignKey: 'season_id',
  as: 'season',
});

//Quest Categories and Quests
db.quest_categories.hasMany(db.quests, { foreignKey: 'quest_category_id', as: 'quests' });
db.quests.belongsTo(db.quest_categories, {
  foreignKey: 'quest_category_id',
  as: 'quest_category',
});

// Quests and Votes
db.quests.hasMany(db.votes, { foreignKey: 'quest_key', as: 'votes' });
db.votes.belongsTo(db.quests, {
  foreignKey: 'quest_key',
  as: 'quest',
});

// Answers and Votes
db.answers.hasMany(db.votes, { foreignKey: 'quest_answer_key', as: 'votes' });
db.votes.belongsTo(db.answers, {
  foreignKey: 'quest_answer_key',
  as: 'answer',
});

// Rewards Relationships
// Quests and Rewards
db.quests.hasMany(db.rewards, { foreignKey: 'quest_key', as: 'rewards' });
db.rewards.belongsTo(db.quests, {
  foreignKey: 'quest_key',
  as: 'quest',
});

// Answers and Rewards (for betting rewards)
db.answers.hasMany(db.rewards, { foreignKey: 'answer_key', as: 'rewards' });
db.rewards.belongsTo(db.answers, {
  foreignKey: 'answer_key',
  as: 'answer',
});

// Bettings and Rewards (one-to-one relationship)
db.bettings.hasOne(db.rewards, { foreignKey: 'betting_key', as: 'reward' });
db.rewards.belongsTo(db.bettings, {
  foreignKey: 'betting_key',
  as: 'betting',
});

// Members and Rewards
db.members.hasMany(db.rewards, { foreignKey: 'wallet_address', sourceKey: 'wallet_address', as: 'rewards' });
db.rewards.belongsTo(db.members, {
  foreignKey: 'wallet_address',
  targetKey: 'wallet_address',
  as: 'member',
});


//Fix the wrong count issue in findAndCountAll()
sequelize.addHook('beforeCount', function (options) {
  if (this._scope.include && this._scope.include.length > 0) {
    options.distinct = true;
    options.col =
      this._scope.col || options.col || `"${this.options.name.singular}".id` || `"${this.options.name.singular}".key`;
  }

  if (options.include && options.include.length > 0) {
    options.include = null;
  }
});

db.sequelize = sequelize;

module.exports = db;
