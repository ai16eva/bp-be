// schemas.js
const schemas = {
  Member: {
    member_id: {
      type: 'integer',
      description: 'Unique identifier for the member',
      readOnly: true,
    },
    wallet_address: {
      type: 'string',
      maxLength: 64,
      description: 'Ethereum wallet address of the member',
    },
    wallet_type: {
      type: 'string',
      maxLength: 100,
      default: 'METAMASK',
      description: 'The type of wallet the user used to login',
    },
    member_role: {
      type: 'string',
      enum: ['USER', 'ADMIN'],
      default: 'USER',
      description: 'Role of the member',
    },
    member_email: {
      type: 'string',
      maxLength: 255,
      nullable: true,
      description: 'Email address of the member',
    },
    member_name: {
      type: 'string',
      maxLength: 20,
      nullable: true,
      description: 'Name of the member',
    },
    member_avatar: {
      type: 'string',
      maxLength: 255,
      nullable: true,
      description: "URL of the member's avatar image",
    },
    member_email_verified: {
      type: 'string',
      maxLength: 2,
      enum: ['T', 'F'],
      default: 'F',
      description: 'Email verification status',
    },
    member_locked_at: {
      type: 'string',
      format: 'date-time',
      nullable: true,
      description: 'Timestamp when the member was locked',
    },
    member_locked_tx: {
      type: 'string',
      maxLength: 66,
      nullable: true,
      description: 'Transaction hash of the locking transaction',
    },
    member_delegated_tx: {
      type: 'string',
      maxLength: 66,
      nullable: true,
      description: 'Transaction hash of the delegation transaction',
    },
    member_created_at: {
      type: 'string',
      format: 'date-time',
      description: 'Timestamp when the member was created',
      readOnly: true,
    },
    member_updated_at: {
      type: 'string',
      format: 'date-time',
      description: 'Timestamp when the member was last updated',
      readOnly: true,
    },
    member_archived_at: {
      type: 'string',
      format: 'date-time',
      nullable: true,
      description: 'Timestamp when the member was archived',
    },
  },

  Vote: {
    vote_id: {
      type: 'string',
      format: 'uuid',
      description: 'Unique identifier for the vote',
    },
    quest_key: {
      type: 'integer',
      format: 'int64',
      description: 'The key of the associated quest',
    },
    vote_voter: {
      type: 'string',
      maxLength: 64,
      description: 'The address of the voter',
    },
    vote_power: {
      type: 'integer',
      nullable: true,
      description: 'The voting power of the voter',
    },
    vote_draft_option: {
      type: 'string',
      enum: ['APPROVE', 'REJECT'],
      nullable: true,
      description: 'The option chosen in the draft vote',
    },
    vote_draft_tx: {
      type: 'string',
      maxLength: 66,
      nullable: true,
      description: 'The transaction hash of the draft vote',
    },
    vote_success_option: {
      type: 'string',
      enum: ['SUCCESS', 'ADJOURN'],
      nullable: true,
      description: 'The option chosen in the success vote',
    },
    vote_success_tx: {
      type: 'string',
      maxLength: 66,
      nullable: true,
      description: 'The transaction hash of the success vote',
    },
    quest_answer_key: {
      type: 'integer',
      format: 'int64',
      nullable: true,
      description: 'The key of the associated quest answer',
    },
    vote_answer_tx: {
      type: 'string',
      maxLength: 66,
      nullable: true,
      description: 'The transaction hash of the answer vote',
    },
    vote_reward: {
      type: 'integer',
      nullable: true,
      description: 'The amount of reward which was recieved',
    },
    vote_archived_at: {
      type: 'string',
      format: 'date-time',
      description: 'The date and time when the vote was archived',
    },
  },

  Quest: {
    quest_key: {
      type: 'integer',
      format: 'int64',
      nullable: false,
      description: 'Key of the associated quest',
    },
    quest_title: {
      type: 'string',
      maxLength: 1000,
      nullable: false,
      description: 'Title of the quest',
    },
    quest_description: {
      type: 'string',
      maxLength: 2000,
      description: 'Description of the quest',
    },
    season_id: {
      type: 'string',
      format: 'uuid',
      description: 'Unique identifier of the season to which this quest is related to',
    },
    quest_category_id: {
      type: 'string',
      format: 'uuid',
      description: 'Unique identifier of the category to which this quest is related to',
    },
    quest_creator: {
      type: 'string',
      maxLength: 66,
      description: 'The creator of the quest (address)',
    },
    quest_betting_token: {
      type: 'string',
      description: 'The voting token used for this prediction',
      default: 'BOOM',
    },
    quest_image_url: {
      type: 'string',
      maxLength: 255,
      description: 'The image url of the quest',
    },
    quest_image_link: {
      type: 'string',
      maxLength: 255,
      description: 'External link of the quest',
    },
    quest_end_date: {
      type: 'string',
      format: 'date-time',
      description: 'The end date of the quest',
    },
    quest_end_date_utc: {
      type: 'string',
      format: 'date-time',
      description: 'The end date of the quest in utc',
    },
    quest_hot: {
      type: 'bool',
      default: false,
      description: 'True if associated quest is hot, false otherwise',
    },
    quest_status: {
      type: 'string',
      enum: ['DRAFT', 'APPROVE', 'REJECT', 'PUBLISH', 'FINISH', 'DAO_SUCCESS', 'MARKET_SUCCESS', 'ADJOURN'],
      description: 'The status of the quest',
    },
    quest_publish_tx: {
      type: 'string',
      nullable: true,
      description: 'Transaction hash of publish tx',
    },
    quest_publish_datetime: {
      type: 'string',
      format: 'date-time',
      nullable: true,
      description: 'The date and time when the quest is published',
    },
    quest_finish_tx: {
      type: 'string',
      nullable: true,
      description: 'The transaction hash of the finish tx',
      maxLength: 66,
    },
    quest_finish_datetime: {
      type: 'string',
      format: 'date-time',
      nullable: true,
      description: 'The date and time when the quest is finished',
    },
    quest_adjourn_tx: {
      type: 'string',
      nullable: true,
      maxLength: 66,
      description: 'The transaction hash of the adjourn tx',
    },
    quest_adjourn_datetime: {
      type: 'string',
      format: 'date-time',
      nullable: true,
      description: 'The date and time when the quest is adjourned',
    },
    quest_success_tx: {
      type: 'string',
      maxLength: 66,
      nullable: true,
      description: 'Transaction hash of the adjourn tx',
    },
    quest_success_datetime: {
      type: 'string',
      format: 'date-time',
      description: 'The date and time when the quest is set to success',
      nullable: true,
    },
    quest_created_at: {
      type: 'string',
      format: 'date-time',
      nullable: true,
      description: 'The date and time when the quest is created',
      readOnly: true,
    },
    quest_updated_at: {
      type: 'string',
      format: 'date-time',
      nullable: true,
      description: 'The date and time when the quest is updated',
    },
    quest_archived_at: {
      type: 'string',
      nullable: true,
      description: 'The date and time when the quest is archived',
      format: 'date-time',
    },
    dao_created_tx: {
      type: 'string',
      nullable: true,
      description: 'Transaction hash of the dao created tx',
    },
    dao_draft_start_at: {
      type: 'string',
      format: 'date-time',
      nullable: true,
      description: 'The start date of the dao draft vote',
    },
    dao_draft_end_at: {
      type: 'string',
      format: 'date-time',
      nullable: true,
      description: 'The end date of the dao draft vote',
    },
    dao_draft_tx: {
      type: 'string',
      nullable: true,
      maxLength: 66,
      description: 'Transaction hash of quest draft tx',
    },
    dao_success_start_at: {
      type: 'string',
      format: 'date-time',
      nullable: true,
      description: 'The start date of dao success votes',
    },
    dao_success_end_at: {
      type: 'string',
      format: 'date-time',
      nullable: true,
      description: 'The end date of dao success votes',
    },
    dao_success_tx: {
      type: 'string',
      nullable: true,
      maxLength: 66,
      description: 'Transaction hash of dao success tx',
    },
    dao_answer_start_at: {
      type: 'string',
      format: 'date-time',
      nullable: true,
      description: 'The start date of dao answer votes',
    },
    dao_answer_end_at: {
      type: 'string',
      nullable: true,
      description: 'The end date of dao answer votes',
    },
    dao_answer_tx: {
      type: 'string',
      nullable: true,
      default: null,
      maxLength: 66,
      description: 'Transaction hash of dao answer tx',
    },
    quest_pending: {
      type: 'bool',
      default: false,
    },
  },

  Answer: {
    answer_key: {
      type: 'integer',
      format: 'int64',
      nullable: false,
      description: 'Primary key of the associated answer',
    },
    answer_title: {
      type: 'string',
      maxLength: 1000,
      nullable: false,
      description: 'Title of the answer',
    },
    quest_selected: {
      type: 'bool',
      default: false,
      nullable: false,
      description: 'True if answer is selected. False, otherwise',
    },
    quest_key: {
      type: 'integer',
      format: 'int64',
      nullable: false,
      description: 'Unique identifier of the quest to which this answer belongs to',
    },
    answer_created_at: {
      type: 'string',
      format: 'date-time',
      nullable: false,
      description: 'The day and time when this answer is created',
    },
    answer_tx: {
      type: 'string',
      nullable: true,
      maxLength: 66,
      description: 'Transaction hash of answer tx',
    },
    answer_pending: {
      type: 'integer',
      format: 'int8',
      nullable: false,
      default: false,
      description: 'True if answer is pending. False, if answer is confirmed',
    },
  },

  Betting: {
    betting_key: {
      type: 'integer',
      format: 'int64',
      nullable: false,
      description: 'Primary key of betting',
    },
    betting_amount: {
      type: 'float',
      nullable: false,
      description: 'Amount of betting',
    },
    betting_tx: {
      type: 'string',
      nullable: true,
      maxLength: 66,
      default: null,
      description: 'Transaction hash of betting',
    },
    answer_key: {
      type: 'integer',
      format: 'int64',
      nullable: false,
      description: 'Unique identifier of associated answer',
    },
    quest_key: {
      type: 'integer',
      format: 'int64',
      nullable: false,
      description: 'Unique identifier of associated quest',
    },
    betting_address: {
      type: 'string',
      maxLength: 66,
      nullable: false,
      description: 'Address of the user who placed the betting',
    },
    reward_amount: {
      type: 'float',
      nullable: false,
      default: 0.0,
      description: 'Amount of reward, if any',
    },
    betting_status: {
      type: 'bool',
      nullable: false,
      default: false,
      description: 'True if betting is confirmed',
    },
    reward_claimed: {
      type: 'bool',
      nullable: false,
      default: false,
      description: 'True if reward is claimed',
    },
    betting_created_at: {
      type: 'string',
      format: 'date-time',
      nullable: false,
      default: 'Now',
    },
    reward_tx: {
      type: 'string',
      nullable: true,
      default: null,
      maxLength: 66,
      description: 'Transaction hash of reward, if any',
    },
  },
  Referral_code: {
    wallet_address: {
      type: 'string',
      nullable: false,
      description: 'Address of the referral',
    },
    referral_code: {
      type: 'string',
      nullable: false,
      description: 'Referral code',
    },
    five_referral_rewarded_at: {
      type: 'string',
      format: 'date-time',
      nullable: true,
      default: null,
    },
    ten_referral_rewarded_at: {
      type: 'string',
      format: 'date-time',
      nullable: true,
      default: null,
    },
    referral_created_at: {
      type: 'string',
      format: 'date-time',
      nullable: false,
      default: 'NOW',
    },
    referral_updated_at: {
      type: 'string',
      format: 'date-time',
      nullable: false,
      default: 'NOW',
    }
  },
  Referral: {
    wallet_address: {
      type: 'string',
      nullable: false,
      description: 'Address of the the wallet address that used the given referral',
    },
    referral_code: {
      type: 'string',
      nullable: false,
      description: 'Referral code',
    },
    created_at: {
      type: 'string',
      format: 'date-time',
      nullable: false,
      default: 'NOW'
    }
  },
  Checkin: {
    wallet_address: {
      type: 'string',
      nullable: false,
      description: 'Wallet address of the user who checked in',
    },
    last_checkin_date: {
      type: 'string',
      format: 'date-time',
      nullable: false,
      default: 'NOW',
    },
    checkin_streak: {
      type: 'integer',
      nullable: false,
      default: 0,
      description: 'number of checkin streak',
    },
    checkin_total: {
      type: 'integer',
      nullable: false,
      default: 0,
      description: 'total number of checkins',
    },
    checkin_created_at: {
      type: 'string',
      format: 'date-time',
      nullable: false,
      defaultValue: 'NOW',
    }
  }

  // schemas.js 파일에서 이렇게 사용할 수 있습니다:
  // module.exports = {
  //   Vote: Vote,
  //   // ... 다른 스키마들
  // };
};

module.exports = schemas;
