const express = require('express');
const router = express.Router({ strict: true, mergeParams: true });
const voteCtrl = require('../controllers/voteController');

// Admin routes - placed first to avoid conflicts
router.post(
  '/admin/set-decision-and-execute-answer',
  /*  #swagger.auto = false
      #swagger.tags = ['Vote Admin']
      #swagger.summary = 'Set decision and execute answer (admin)'
      #swagger.description = 'Admin function to set decision and execute answer for a quest'
      #swagger.parameters['quest_key'] = {
          in: 'path',
          description: 'The key of the quest',
          required: true,
          type: 'integer'
      }
      #swagger.requestBody = {
          required: true,
          "@content": {
              "application/json": {
                  schema: {
                      required: ['answer_keys', 'authority'],
                      properties: {
                          answer_keys: {
                              type: 'array',
                              items: { type: 'integer' },
                              description: 'Array of answer keys'
                          },
                          authority: {
                              type: 'string',
                              description: 'Admin authority wallet address'
                          }
                      }
                  }
              }
          }
      }
      #swagger.responses[200] = {
              description: 'Success',
      }
      #swagger.responses[400] = {
         description: 'Bad Request',
      }
  */
  voteCtrl.setDecisionAndExecuteAnswer
);

router.post(
  '/admin/set-answer-result',
  /*  #swagger.auto = false
      #swagger.tags = ['Vote Admin']
      #swagger.summary = 'Set answer result (admin)'
      #swagger.description = 'Admin function to set answer result for a quest'
      #swagger.parameters['quest_key'] = {
          in: 'path',
          description: 'The key of the quest',
          required: true,
          type: 'integer'
      }
      #swagger.requestBody = {
          required: true,
          "@content": {
              "application/json": {
                  schema: {
                      required: ['answer_keys', 'authority'],
                      properties: {
                          answer_keys: {
                              type: 'array',
                              items: { type: 'integer' },
                              description: 'Array of answer keys'
                          },
                          authority: {
                              type: 'string',
                              description: 'Admin authority wallet address'
                          }
                      }
                  }
              }
          }
      }
      #swagger.responses[200] = {
              description: 'Success',
      }
      #swagger.responses[400] = {
         description: 'Bad Request',
      }
  */
  voteCtrl.setAnswerResult
);

router.post(
  '/admin/cancel-answer',
  /*  #swagger.auto = false
      #swagger.tags = ['Vote Admin']
      #swagger.summary = 'Cancel answer (admin)'
      #swagger.description = 'Admin function to cancel answer for a quest'
      #swagger.parameters['quest_key'] = {
          in: 'path',
          description: 'The key of the quest',
          required: true,
          type: 'integer'
      }
      #swagger.requestBody = {
          required: true,
          "@content": {
              "application/json": {
                  schema: {
                      required: ['reason', 'authority'],
                      properties: {
                          reason: {
                              type: 'string',
                              description: 'Reason for canceling answer'
                          },
                          authority: {
                              type: 'string',
                              description: 'Admin authority wallet address'
                          }
                      }
                  }
              }
          }
      }
      #swagger.responses[200] = {
              description: 'Success',
      }
      #swagger.responses[400] = {
         description: 'Bad Request',
      }
  */
  voteCtrl.cancelAnswer
);

router.post(
  '/',
  /*  #swagger.auto = false
      #swagger.tags = ['Vote']
      #swagger.summary = 'Create a new vote for a quest'
      #swagger.description = 'Creates a new vote for a specific quest'
      #swagger.parameters['quest_key'] = {
          in: 'path',
          description: 'The key of the quest to vote on',
          required: true,
          type: 'integer'
      }
      #swagger.requestBody = {
          required: true,
          "@content": {
              "application/json": {
                  schema: {
                      required: ['voter', 'power', 'option', 'tx'],
                        properties: {
                          voter: {
                              $ref: '#/components/schemas/Vote/properties/vote_voter'
                          },
                          power: {
                              $ref: '#/components/schemas/Vote/properties/vote_power'
                          },
                          option: {
                              $ref: '#/components/schemas/Vote/properties/vote_draft_option'
                          },
                          tx: {
                              type: 'string',
                              description: 'Transaction signature from Solana after signing and submitting the vote transaction',
                              example: '5j7s8K9L0mN1oP2qR3sT4uV5wX6yZ7aB8cD9eF0gH1iJ2kL3mN4oP5qR6sT7uV8wX9yZ0aB1cD2eF'
                          }
                        }
                  },
                  examples:{
                    Vote:{$ref: '#/components/examples/VoteCreate'}
                }
              }
          }
      }
    #swagger.responses[200] = {
            description: 'Created',
    }
    #swagger.responses[404] = {
       description: 'Not Found',
    }

    #swagger.responses[405] = {
       description: 'Validation Exception',
    }
}
*/
  voteCtrl.createVote
);

// after contract call update vote status
router.patch(
  '/:voter/success',
  /*  #swagger.auto = false
      #swagger.tags = ['Vote']
      #swagger.summary = 'Update vote success data'
      #swagger.description = 'After smart contract call update success option & tx'
      #swagger.parameters['quest_key'] = {
          in: 'path',
          description: 'The key of the quest to vote on',
          required: true,
          type: 'integer'
      }
      #swagger.parameters['voter'] = {
          in: 'path',
          description: 'The address of the voter',
          required: true,
          type: 'string'
      }
      #swagger.requestBody = {
          required: true,
          "@content": {
              "application/json": {
                  schema: {
                      required: ['option', 'tx'],
                        properties: {
                          option: {
                              $ref: '#/components/schemas/Vote/properties/vote_success_option'
                          },
                          tx: {
                              $ref: '#/components/schemas/Vote/properties/vote_success_tx'
                          }
                        }
                  },
                  examples:{
                    Vote:{$ref: '#/components/examples/VoteUpdateSuccess'}
                }
                }
              }
          }
    #swagger.responses[200] = {
            description: 'Updated',
    }
    #swagger.responses[404] = {
       description: 'Not Found',
    }

    #swagger.responses[405] = {
       description: 'Validation Exception',
    }
}
*/
  voteCtrl.updateVoteSuccess
);
router.patch(
  '/:voter/answer',
  /*  #swagger.auto = false
      #swagger.tags = ['Vote']
      #swagger.summary = 'Update vote answer data'
      #swagger.description = 'After smart contract call update answer option & tx'
      #swagger.parameters['quest_key'] = {
          in: 'path',
          description: 'The key of the quest to vote on',
          required: true,
          type: 'integer'
      }
      #swagger.parameters['voter'] = {
          in: 'path',
          description: 'The address of the voter',
          required: true,
          type: 'string'
      }
      #swagger.requestBody = {
          required: true,
          "@content": {
              "application/json": {
                  schema: {
                      required: ['answer_key', 'tx'],
                        properties: {
                          answer_key: {
                              $ref: '#/components/schemas/Vote/properties/quest_answer_key'
                          },
                          tx: {
                              $ref: '#/components/schemas/Vote/properties/vote_answer_tx'
                          }
                        }
                  },
                  examples:{
                    Vote:{$ref: '#/components/examples/VoteUpdateAnswer'}
                }
                }
              }
          }
    #swagger.responses[200] = {
            description: 'Updated',
    }
    #swagger.responses[404] = {
       description: 'Not Found',
    }
    #swagger.responses[405] = {
       description: 'Validation Exception',
    }
}
*/
  voteCtrl.updateVoteAnswer
);
router.patch(
  '/:voter/reward',
  /*  #swagger.auto = false
      #swagger.tags = ['Vote']
      #swagger.summary = 'Update vote reward amount '
      #swagger.description = 'After smart contract call update amount of reward. it means the voter got reward'
      #swagger.parameters['quest_key'] = {
          in: 'path',
          description: 'The key of the quest to vote on',
          required: true,
          type: 'integer'
      }
      #swagger.parameters['voter'] = {
          in: 'path',
          description: 'The address of the voter',
          required: true,
          type: 'string'
      }
      #swagger.parameters['reward'] = {
          in: 'body',
          description: 'Amount of reawrd',
          required: true,
          type: 'integer'
      }
    #swagger.responses[200] = {
            description: 'Reward Updated',
    }
    #swagger.responses[404] = {
       description: 'Not Found',
    }
    #swagger.responses[405] = {
       description: 'Validation Exception',
    }
}
*/
  voteCtrl.updateVoteReward
);

router.patch(
  '/:voter/archive',
  /*  #swagger.auto = false
      #swagger.tags = ['Vote']
      #swagger.summary = 'Archive the vote'
      #swagger.description = 'When member want to get rid of the vote from the list, archive it'
      #swagger.parameters['quest_key'] = {
          in: 'path',
          description: 'The key of the quest to vote on',
          required: true,
          type: 'integer'
      }
      #swagger.parameters['voter'] = {
          in: 'path',
          description: 'The address of the voter',
          required: true,
          type: 'string'
      }
    #swagger.responses[200] = {
            description: 'Archived',
    }
    #swagger.responses[404] = {
       description: 'Not Found',
    }
    #swagger.responses[405] = {
       description: 'Validation Exception',
    }
}
*/
  voteCtrl.archiveVote
);
router.patch(
  '/:voter/unarchive',
  /*  #swagger.auto = false
      #swagger.tags = ['Vote']
      #swagger.deprecated = true
      #swagger.summary = 'UnArchive the vote'
      #swagger.description = 'When member want to restore the vote data from the list, unarchive it'
      #swagger.parameters['quest_key'] = {
          in: 'path',
          description: 'The key of the quest to vote on',
          required: true,
          type: 'integer'
      }
      #swagger.parameters['voter'] = {
          in: 'path',
          description: 'The address of the voter',
          required: true,
          type: 'string'
      }
    #swagger.responses[200] = {
            description: 'Unarchived',
    }
    #swagger.responses[404] = {
       description: 'Not Found',
    }
    #swagger.responses[405] = {
       description: 'Validation Exception',
    }
}
*/
  voteCtrl.unArchiveVote
);

router.get(
  '/:voter',
  /*  #swagger.auto = false
      #swagger.tags = ['Vote']
      #swagger.summary = 'Get vote Data'
      #swagger.description = 'Get vote data from voter & quest_key'
      #swagger.parameters['quest_key'] = {
          in: 'path',
          description: 'The key of the quest to vote on',
          required: true,
          type: 'integer'
      }
      #swagger.parameters['voter'] = {
          in: 'path',
          description: 'The address of the voter',
          required: true,
          type: 'string'
      }
    #swagger.responses[200] = {
            description: 'Vote data',
         content: {
            "application/json": {
                schema: {
                    type: "object",
                    properties: {
                        success: {
                            type: "integer",
                            example: 1
                        },
                        data: {
                            type: "array",
                            items: {},
                            default: {$ref: '#/components/examples/Vote/value'}
                        },
                        message: {
                            type: "string",
                            default: ""
                        },
                        error: {
                            type: "null",
                            default: null
                        }
                    }
                }
            }
        }
    }

    #swagger.responses[405] = {
       description: 'Validation Exception',
    }
}
*/
  voteCtrl.getVote
);

// Vote decision route (vote on success/adjourn)
router.post(
  '/decision',
  /*  #swagger.auto = false
      #swagger.tags = ['Vote']
      #swagger.summary = 'Vote on decision (APPROVE/ADJOURN)'
      #swagger.description = 'Submit a vote on quest decision (success or adjourn)'
      #swagger.parameters['quest_key'] = {
          in: 'path',
          description: 'The key of the quest',
          required: true,
          type: 'integer'
      }
      #swagger.requestBody = {
          required: true,
          "@content": {
              "application/json": {
                  schema: {
                      required: ['voter', 'power', 'option', 'voterNftAccount'],
                      properties: {
                          voter: {
                              type: 'string',
                              description: 'Voter wallet address',
                              example: '11111111111111111111111111111112'
                          },
                          power: {
                              type: 'integer',
                              description: 'Voting power',
                              example: 1
                          },
                          option: {
                              type: 'string',
                              enum: ['APPROVE', 'ADJOURN'],
                              description: 'Vote option'
                          },
                          voterNftAccount: {
                              type: 'string',
                              description: 'Voter NFT account address',
                              example: '11111111111111111111111111111113'
                          }
                      }
                  }
              }
          }
      }
      #swagger.responses[200] = {
              description: 'Success',
      }
  */
  voteCtrl.voteDecision
);

// Vote answer route
router.post(
  '/answer',
  /*  #swagger.auto = false
      #swagger.tags = ['Vote']
      #swagger.summary = 'Vote on answer'
      #swagger.description = 'Submit a vote on quest answer'
      #swagger.parameters['quest_key'] = {
          in: 'path',
          description: 'The key of the quest',
          required: true,
          type: 'integer'
      }
      #swagger.requestBody = {
          required: true,
          "@content": {
              "application/json": {
                  schema: {
                      required: ['voter', 'power', 'answer_key', 'voterNftAccount'],
                      properties: {
                          voter: {
                              type: 'string',
                              description: 'Voter wallet address',
                              example: '11111111111111111111111111111112'
                          },
                          power: {
                              type: 'integer',
                              description: 'Voting power',
                              example: 1
                          },
                          answer_key: {
                              type: 'integer',
                              description: 'Answer key to vote on',
                              example: 1
                          },
                          voterNftAccount: {
                              type: 'string',
                              description: 'Voter NFT account address',
                              example: '11111111111111111111111111111113'
                          }
                      }
                  }
              }
          }
      }
      #swagger.responses[200] = {
              description: 'Success',
      }
  */
  voteCtrl.voteAnswer
);

// Additional Admin Routes for MS-BE-014
router.post(
  '/admin/set-quest-result',
  /* #swagger.tags = ['Vote']
      #swagger.summary = 'Set quest result (Admin)'
      #swagger.description = 'Set the result of a quest'
      #swagger.parameters[0] = {
          in: 'path',
          name: 'quest_key',
          description: 'The key of the quest',
          required: true,
          type: 'integer'
      }
      #swagger.responses[200] = {
              description: 'Success',
      }
  */
  voteCtrl.setQuestResult
);

router.post(
  '/admin/make-quest-result',
  /* #swagger.tags = ['Vote']
      #swagger.summary = 'Make quest result (Admin)'
      #swagger.description = 'Make the result of a quest'
      #swagger.parameters[0] = {
          in: 'path',
          name: 'quest_key',
          description: 'The key of the quest',
          required: true,
          type: 'integer'
      }
      #swagger.responses[200] = {
              description: 'Success',
      }
  */
  voteCtrl.makeQuestResult
);

router.post(
  '/admin/cancel-quest',
  /* #swagger.tags = ['Vote']
      #swagger.summary = 'Cancel quest (Admin)'
      #swagger.description = 'Cancel a quest'
      #swagger.parameters[0] = {
          in: 'path',
          name: 'quest_key',
          description: 'The key of the quest',
          required: true,
          type: 'integer'
      }
      #swagger.responses[200] = {
              description: 'Success',
      }
  */
  voteCtrl.cancelQuest
);

router.post(
  '/admin/start-decision',
  /* #swagger.tags = ['Vote']
      #swagger.summary = 'Start decision (Admin)'
      #swagger.description = 'Start decision phase for a quest'
      #swagger.parameters[0] = {
          in: 'path',
          name: 'quest_key',
          description: 'The key of the quest',
          required: true,
          type: 'integer'
      }
      #swagger.responses[200] = {
              description: 'Success',
      }
  */
  voteCtrl.startDecision
);

router.post(
  '/admin/set-decision',
  /* #swagger.tags = ['Vote']
      #swagger.summary = 'Set decision (Admin)'
      #swagger.description = 'Set decision options for a quest'
      #swagger.parameters[0] = {
          in: 'path',
          name: 'quest_key',
          description: 'The key of the quest',
          required: true,
          type: 'integer'
      }
      #swagger.requestBody = {
          required: true,
          "@content": {
              "application/json": {
                  schema: {
                      required: ['answers'],
                      properties: {
                          answers: {
                              type: 'array',
                              items: { type: 'string' },
                              description: 'Array of answer keys'
                          }
                      }
                  }
              }
          }
      }
      #swagger.responses[200] = {
              description: 'Success',
      }
  */
  voteCtrl.setDecision
);

router.post(
  '/admin/make-decision',
  /* #swagger.tags = ['Vote']
      #swagger.summary = 'Make decision (Admin)'
      #swagger.description = 'Make decision for a quest'
      #swagger.parameters[0] = {
          in: 'path',
          name: 'quest_key',
          description: 'The key of the quest',
          required: true,
          type: 'integer'
      }
      #swagger.requestBody = {
          required: true,
          "@content": {
              "application/json": {
                  schema: {
                      required: ['answers'],
                      properties: {
                          answers: {
                              type: 'array',
                              items: { type: 'string' },
                              description: 'Array of answer keys'
                          }
                      }
                  }
              }
          }
      }
      #swagger.responses[200] = {
              description: 'Success',
      }
  */
  voteCtrl.makeDecision
);

// Additional endpoints for MS-BE-015
router.post(
  '/admin/distribute-reward',
  /* #swagger.tags = ['Vote Admin']
     #swagger.summary = 'Distribute DAO reward (Admin)'
     #swagger.requestBody = {
       required: true,
       "@content": {
         "application/json": {
           schema: {
             required: ['quest_key','voter','voterTokenAccount','treasuryTokenAccount','treasuryAuthority'],
             properties: {
               quest_key: { type: 'integer' },
               voter: { type: 'string' },
               voterTokenAccount: { type: 'string' },
               treasuryTokenAccount: { type: 'string' },
               treasuryAuthority: { type: 'string' }
             }
           }
         }
       }
     }
  */
  voteCtrl.distributeReward
);

router.post(
  '/admin/update-voter-checkpoint',
  /* #swagger.tags = ['Vote Admin']
     #swagger.summary = 'Update voter checkpoint (Admin)'
     #swagger.requestBody = {
       required: true,
       "@content": {
         "application/json": {
           schema: {
             required: ['voter'],
             properties: {
               voter: { type: 'string' },
               nftTokenAccounts: { type: 'array', items: { type: 'string' } }
             }
           }
         }
       }
     }
  */
  voteCtrl.updateVoterCheckpoint
);

// Admin config endpoints (Governance)
router.post('/admin/pause-governance',
  /*  #swagger.auto = false
      #swagger.tags = ['Vote Admin']
      #swagger.summary = 'Pause/Unpause Governance (Admin)'
      #swagger.requestBody = {
        required: true,
        "@content": {
          "application/json": {
            schema: {
              required: ['pause', 'authority'],
              properties: {
                pause: { type: 'boolean' },
                authority: { type: 'string', description: 'Admin authority wallet' }
              }
            }
          }
        }
      }
  */
  voteCtrl.pauseGovernance);
router.post('/admin/set-minimum-nfts',
  /*  #swagger.auto = false
      #swagger.tags = ['Vote Admin']
      #swagger.summary = 'Set Minimum NFTs (Admin)'
      #swagger.requestBody = {
        required: true,
        "@content": {
          "application/json": {
            schema: {
              required: ['minNfts', 'authority'],
              properties: {
                minNfts: { type: 'integer' },
                authority: { type: 'string' }
              }
            }
          }
        }
      }
  */
  voteCtrl.setMinimumNfts);
router.post('/admin/set-max-votes-per-voter',
  /*  #swagger.auto = false
      #swagger.tags = ['Vote Admin']
      #swagger.summary = 'Set Max Votes Per Voter (Admin)'
      #swagger.requestBody = {
        required: true,
        "@content": {
          "application/json": {
            schema: {
              required: ['maxVotes', 'authority'],
              properties: {
                maxVotes: { type: 'integer' },
                authority: { type: 'string' }
              }
            }
          }
        }
      }
  */
  voteCtrl.setMaxVotesPerVoter);

router.post('/admin/update-base-token-mint',
  voteCtrl.updateBaseTokenMint
);

router.post('/admin/set-quest-duration-hours',
  /*  #swagger.auto = false
      #swagger.tags = ['Vote Admin']
      #swagger.summary = 'Set Quest Duration Hours (Admin)'
      #swagger.requestBody = {
        required: true,
        "@content": {
          "application/json": {
            schema: {
              required: ['durationHours', 'authority'],
              properties: {
                durationHours: { type: 'integer' },
                authority: { type: 'string' }
              }
            }
          }
        }
      }
  */
  voteCtrl.setQuestDurationHours);
router.post('/admin/set-reward-amount',
  /*  #swagger.auto = false
      #swagger.tags = ['Vote Admin']
      #swagger.summary = 'Set Reward Amount (Admin)'
      #swagger.requestBody = {
        required: true,
        "@content": {
          "application/json": {
            schema: {
              required: ['rewardAmount', 'authority'],
              properties: {
                rewardAmount: { type: 'integer' },
                authority: { type: 'string' }
              }
            }
          }
        }
      }
  */
  voteCtrl.setRewardAmount);
router.post('/admin/set-total-vote',
  /*  #swagger.auto = false
      #swagger.tags = ['Vote Admin']
      #swagger.summary = 'Set Total Vote Min/Max (Admin)'
      #swagger.requestBody = {
        required: true,
        "@content": {
          "application/json": {
            schema: {
              required: ['minTotalVote', 'maxTotalVote', 'authority'],
              properties: {
                minTotalVote: { type: 'integer' },
                maxTotalVote: { type: 'integer' },
                authority: { type: 'string' }
              }
            }
          }
        }
      }
  */
  voteCtrl.setTotalVote);

// Read-only endpoints (Governance data)
router.get('/admin/fetch-config',
  /*  #swagger.auto = false
      #swagger.tags = ['Vote Admin']
      #swagger.summary = 'Fetch Governance Config'
  */
  voteCtrl.fetchConfig);
router.get('/admin/fetch-governance',
  /*  #swagger.auto = false
      #swagger.tags = ['Vote Admin']
      #swagger.summary = 'Fetch Governance Account'
  */
  voteCtrl.fetchGovernance);
router.get('/admin/fetch-governance-item/:quest_key',
  /*  #swagger.auto = false
      #swagger.tags = ['Vote Admin']
      #swagger.summary = 'Fetch Governance Item'
      #swagger.parameters['quest_key'] = { in: 'path', required: true, type: 'integer' }
  */
  voteCtrl.fetchGovernanceItem);
router.get('/admin/fetch-quest-vote/:quest_key',
  /*  #swagger.auto = false
      #swagger.tags = ['Vote Admin']
      #swagger.summary = 'Fetch Quest Vote'
      #swagger.parameters['quest_key'] = { in: 'path', required: true, type: 'integer' }
  */
  voteCtrl.fetchQuestVote);
router.get('/admin/fetch-proposal/:proposal_key',
  /*  #swagger.auto = false
      #swagger.tags = ['Vote Admin']
      #swagger.summary = 'Fetch Proposal'
      #swagger.parameters['proposal_key'] = { in: 'path', required: true, type: 'integer' }
  */
  voteCtrl.fetchProposal);

// NFT & Collection endpoints
router.post('/admin/initialize-governance',
  /*  #swagger.auto = false
      #swagger.tags = ['Vote Admin']
      #swagger.summary = 'Initialize Governance (Admin)'
      #swagger.requestBody = {
        required: true,
        "@content": {
          "application/json": {
            schema: {
              required: ['minTotalVote','maxTotalVote','minRequiredNft','maxVotableNft','durationHours','constantRewardToken','baseTokenMint','baseNftCollection','treasury','authority'],
              properties: {
                minTotalVote: { type: 'integer' },
                maxTotalVote: { type: 'integer' },
                minRequiredNft: { type: 'integer' },
                maxVotableNft: { type: 'integer' },
                durationHours: { type: 'integer' },
                constantRewardToken: { type: 'integer' },
                baseTokenMint: { type: 'string' },
                baseNftCollection: { type: 'string' },
                treasury: { type: 'string' },
                authority: { type: 'string' }
              }
            }
          }
        }
      }
  */
  voteCtrl.initializeGovernance);
router.post('/admin/create-collection',
  /*  #swagger.auto = false
      #swagger.tags = ['Vote Admin']
      #swagger.summary = 'Create Governance Collection (Admin)'
      #swagger.requestBody = {
        required: true,
        "@content": {
          "application/json": {
            schema: {
              required: ['name','symbol','uri','authority'],
              properties: {
                name: { type: 'string' },
                symbol: { type: 'string' },
                uri: { type: 'string' },
                authority: { type: 'string' }
              }
            }
          }
        }
      }
  */
  voteCtrl.createCollection);
router.post('/admin/mint-governance-nft',
  /*  #swagger.auto = false
      #swagger.tags = ['Vote Admin']
      #swagger.summary = 'Mint Governance NFT (Admin/User)'
      #swagger.requestBody = {
        required: true,
        "@content": {
          "application/json": {
            schema: {
              required: ['name','symbol','uri','user'],
              properties: {
                name: { type: 'string' },
                symbol: { type: 'string' },
                uri: { type: 'string' },
                user: { type: 'string' }
              }
            }
          }
        }
      }
  */
  voteCtrl.mintGovernanceNft);
router.get('/admin/can-create-governance-item',
  /*  #swagger.auto = false
      #swagger.tags = ['Vote Admin']
      #swagger.summary = 'Check if user can create governance item'
      #swagger.parameters['user'] = { in: 'query', required: true, type: 'string' }
  */
  voteCtrl.canCreateGovernanceItem);

// Transaction signature submission for monitoring (Vote)
router.post('/admin/submit-transaction-signature',
  /*  #swagger.auto = false
      #swagger.tags = ['Vote Admin']
      #swagger.summary = 'Submit transaction signature for monitoring'
      #swagger.requestBody = {
        required: true,
        "@content": {
          "application/json": {
            schema: {
              required: ['signature','type'],
              properties: {
                signature: { type: 'string' },
                type: { type: 'string', description: 'custom type to track update later' },
                updateData: { type: 'object' }
              }
            }
          }
        }
      }
  */
  voteCtrl.submitTransactionSignature);

// Proposal endpoints
router.post('/admin/create-proposal',
  /*  #swagger.auto = false
      #swagger.tags = ['Vote Admin']
      #swagger.summary = 'Create proposal'
      #swagger.requestBody = {
        required: true,
        "@content": {
          "application/json": {
            schema: {
              required: ['proposal_key','title','creator'],
              properties: {
                proposal_key: { type: 'integer' },
                title: { type: 'string' },
                creator: { type: 'string' }
              }
            }
          }
        }
      }
  */
  voteCtrl.createProposal);

router.post('/admin/set-proposal-result/:proposal_key',
  /*  #swagger.auto = false
      #swagger.tags = ['Vote Admin']
      #swagger.summary = 'Set proposal result'
      #swagger.parameters['proposal_key'] = { in: 'path', required: true, type: 'integer' }
      #swagger.requestBody = {
        required: true,
        "@content": {
          "application/json": {
            schema: {
              required: ['result','resultVote','authority'],
              properties: {
                result: { type: 'string', enum: ['yes','no'] },
                resultVote: { type: 'integer' },
                authority: { type: 'string' }
              }
            }
          }
        }
      }
  */
  voteCtrl.setProposalResultAdmin);

//  get list of vote or single vote

module.exports = router;
