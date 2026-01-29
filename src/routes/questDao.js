const express = require('express');
const router = express.Router({ strict: true });
const questDaoCtrl = require('../controllers/questDaoController');
const governanceCtrl = require('../controllers/questDao/governanceController');
const { adminAuth } = require('../middlewares/authWeb3');
const { updateQuestHot } = require('../controllers/questController');
/**
 * governance item status change api
 */
router.get(
  '/',
  /*  #swagger.auto = false
      #swagger.tags = ['Quest-dao']
      #swagger.summary = 'List DAO Quests in admin page'
      #swagger.description = 'Retrieves a list of DAO quests with optional filtering and pagination'
      #swagger.security = [{
         "bearerAuth": []
    }]
      #swagger.parameters['x-auth-message'] = {
          in: 'header',
          description: 'Authentication message',
          required: true,
          type: 'string'
      }f
      #swagger.parameters['x-auth-signature'] = {
          in: 'header',
          description: 'Authentication signature',
          required: true,
          type: 'string'
      }
     #swagger.parameters['status'] = {
        in: 'query',
        description: 'filter dao quest status',
        required: true,
        type:  'string',
        default: 'ongoing',
        enum: [
         'draft',
         'publish',
         'decision',
         'answer',
         'success',
         'adjourn',
         'ongoing',
        ]
    }
     #swagger.parameters['page'] = {
             in: 'query',
             description: 'page number',
             required: false,
            type:  'integer',
            default: 1
       }
      #swagger.parameters['size'] = {
           in: 'query',
           description: 'page size',
           required: false,
           type:  'integer',
           default: 10
        }
      #swagger.responses[200] = {
        description: 'OK',
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
                        default: []
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
              },
              examples:{
                draft: {$ref: '#/components/examples/Draft'},
                publish: {$ref: '#/components/examples/Publish'},
                decision: {$ref: '#/components/examples/Decision'},
                answer: {$ref: '#/components/examples/Answer'},
                success: {$ref: '#/components/examples/Success'},
                adjourn: {$ref: '#/components/examples/Adjourn'},
                ongoing: {$ref: '#/components/examples/Ongoing'}
            }
          }
        }
      }
  */
  questDaoCtrl.listQuestDao
);

router.patch(
  '/:quest_key/hot',
  /*
            #swagger.auto = false
            #swagger.tags = ['Quest-dao']
            #swagger.summary = 'Update quest hot status depends on current value.'
            #swagger.security = [{
               "bearerAuth": []
            }]
            #swagger.parameters['x-auth-message'] = {
                in: 'header',
                description: 'Authentication message',
                required: true,
                type: 'string'
            }f
            #swagger.parameters['x-auth-signature'] = {
                in: 'header',
                description: 'Authentication signature',
                required: true,
                type: 'string'
            }
            #swagger.parameters['quest_key'] = {
              in: 'path',
              description: 'Id of quest',
              required: true,
              type: 'string'
            }
               #swagger.responses[200] = {
                  description: 'Ok',
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
                                      default: null
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
            #swagger.responses[404] = {
               description: 'Quest Not Found',
            }
        */
  updateQuestHot
);

router.get(
  '/governance/nfts',
  /*  #swagger.auto = false
      #swagger.tags = ['Quest-dao']
      #swagger.summary = 'Get governance NFTs owned by wallet'
      #swagger.description = 'Returns governance NFTs owned by a wallet from indexed database (avoids RPC rate limits)'
      #swagger.parameters['wallet'] = {
          in: 'query',
          description: 'Wallet address to query NFTs for',
          required: true,
          type: 'string'
      }
      #swagger.responses[200] = {
          description: 'Success',
          content: {
              "application/json": {
                  schema: {
                      type: 'object',
                      properties: {
                          success: { type: 'integer', example: 1 },
                          data: {
                              type: 'object',
                              properties: {
                                  wallet: { type: 'string' },
                                  collectionAddress: { type: 'string' },
                                  nfts: {
                                      type: 'array',
                                      items: {
                                          type: 'object',
                                          properties: {
                                              mint: { type: 'string' },
                                              metadataAccount: { type: 'string' },
                                              tokenAccount: { type: 'string' },
                                              amount: { type: 'integer' }
                                          }
                                      }
                                  },
                                  count: { type: 'integer' }
                              }
                          },
                          message: { type: 'string' },
                          error: { type: 'null' }
                      }
                  }
              }
          }
      }
      #swagger.responses[400] = {
          description: 'Bad Request - wallet parameter missing'
      }
  */
  governanceCtrl.getGovernanceNftsByOwner
);

router.patch(
  '/:quest_key/draft/set',
  /*  #swagger.auto = false
      #swagger.tags = ['Quest-dao']
      #swagger.summary = 'Set the Draft result for a quest'
      #swagger.description = 'Sets the draft result for a specified quest and updates its status'
      #swagger.security = [{
         "bearerAuth": []
      }]
      #swagger.parameters['x-auth-message'] = {
          in: 'header',
          description: 'Authentication message',
          required: true,
          type: 'string'
      }f
      #swagger.parameters['x-auth-signature'] = {
          in: 'header',
          description: 'Authentication signature',
          required: true,
          type: 'string'
      }
      #swagger.parameters['quest_key'] = {
          in: 'path',
          description: 'The key of the quest to set the draft result for',
          required: true,
          type: 'integer'
      }
      #swagger.responses[200] = {
          description: 'Success',
          content: {
              "application/json": {
                  schema: {
                      success: 1,
                      data: '',
                      message: {
                          type: 'string'
                      },
                      error: null
                  },
                  examples: {
                      "Success": {
                          value: {
                              success: 1,
                              data: '',
                              message: 'approve Or reject',
                              error: null
                          }
                      },
                      "Success with DB Update Failure": {
                          value: {
                              success: 1,
                              data: '',
                              message: 'Transaction success but DB Update Failed',
                              error: null
                          }
                      }
                  }
              }
        }
      }
      #swagger.responses[202] = {
          description: 'Pending',
          schema: {
              success: 1,
              data : '',
              message: 'Pending'
          }
      }
      #swagger.responses[400] = {
          description: 'Smart Contract Bad Request',
      }
      #swagger.responses[404] = {
          description: 'Not Found'
      }
  */
  questDaoCtrl.setDraftResult
);
router.patch(
  '/:quest_key/draft/make',
  /*  #swagger.auto = false
        #swagger.tags = ['Quest-dao']
        #swagger.summary = 'Make the Draft result for a quest'
        #swagger.description = 'Creates the draft result for a specified quest, updates its status, and interacts with the smart contract'
        #swagger.security = [{
           "bearerAuth": []
        }]
        #swagger.parameters['x-auth-message'] = {
            in: 'header',
            description: 'Authentication message',
            required: true,
            type: 'string'
        }
        #swagger.parameters['x-auth-signature'] = {
            in: 'header',
            description: 'Authentication signature',
            required: true,
            type: 'string'
        }
        #swagger.parameters['quest_key'] = {
            in: 'path',
            description: 'The key of the quest to make the draft result for',
            required: true,
            type: 'integer'
        }
        #swagger.responses[200] = {
            description: 'Success',
            content: {
                "application/json": {
                    schema: {
                        success: 1,
                        data: '',
                        message: {
                            type: 'string'
                        },
                        error: null
                    },
                    examples: {
                        "Success": {
                            value: {
                                success: 1,
                                data: '',
                                message: 'approve',
                                error: null
                            }
                        },
                        "Success with DB Update Failure": {
                            value: {
                                success: 1,
                                data: '',
                                message: 'Transaction success but DB Update Failed',
                                error: null
                            }
                        }
                    }
                }
            }
        }
        #swagger.responses[202] = {
            description: 'Pending',
            schema: {
                success: 1,
                data: '',
                message: 'Pending'
            }
        }
      #swagger.responses[400] = {
          description: 'Smart Contract Bad Request',
      }
      #swagger.responses[404] = {
          description: 'Not Found'
      }
    */
  questDaoCtrl.makeDraftResult
);

router.patch(
  '/:quest_key/cancel',
  /*  #swagger.auto = false
          #swagger.tags = ['Quest-dao']
          #swagger.summary = 'Cancel a quest'
          #swagger.description = 'Only use this api when quest is not satisfy first step in dao process'
          #swagger.security = [{
             "bearerAuth": []
          }]
          #swagger.parameters['x-auth-message'] = {
              in: 'header',
              description: 'Authentication message',
              required: true,
              type: 'string'
          }
          #swagger.parameters['x-auth-signature'] = {
              in: 'header',
              description: 'Authentication signature',
              required: true,
              type: 'string'
          }
          #swagger.parameters['quest_key'] = {
              in: 'path',
              description: 'The key of the quest to finish',
              required: true,
              type: 'integer'
          }
          #swagger.responses[200] = {
              description: 'Success',
              content: {
                  "application/json": {
                      schema: {
                          success: 1,
                          data: '',
                          message: {
                              type: 'string'
                          },
                          error: null
                      },
                      examples: {
                          "Success": {
                              value: {
                                  success: 1,
                                  data: '',
                                  message: 'adjourn',
                                  error: null
                              }
                          },
                      }
                  }
              }
          }
      */
  questDaoCtrl.setCancel
);
router.patch(
  '/:quest_key/create-governance-item',
  /*  #swagger.auto = false
        #swagger.tags = ['Quest-dao']
        #swagger.summary = 'Create governance item (PDA) for voting'
        #swagger.description = 'Creates a governance item (PDA) on-chain for voting. This should be called before voting starts. Does NOT publish market.'
        #swagger.security = [{
           "bearerAuth": []
        }]
        #swagger.parameters['x-auth-message'] = {
            in: 'header',
            description: 'Authentication message',
            required: true,
            type: 'string'
        }
        #swagger.parameters['x-auth-signature'] = {
            in: 'header',
            description: 'Authentication signature',
            required: true,
            type: 'string'
        }
        #swagger.parameters['quest_key'] = {
            in: 'path',
            description: 'The key of the quest to create governance item for',
            required: true,
            type: 'integer'
        }
        #swagger.parameters['creatorNftAccount'] = {
            in: 'body',
            description: 'NFT token account address(es) of the quest creator from governance collection. Can be single string or array of strings.',
            required: true,
            schema: {
                type: 'object',
                properties: {
                    creatorNftAccount: {
                        oneOf: [
                            { type: 'string' },
                            { type: 'array', items: { type: 'string' } }
                        ],
                        description: 'Creator NFT token account address(es) from governance collection'
                    }
                },
                required: ['creatorNftAccount']
            }
        }
        #swagger.responses[200] = {
            description: 'Success',
            content: {
                "application/json": {
                    schema: {
                        success: 1,
                        data: '',
                        message: {
                            type: 'string'
                        },
                        error: null
                    },
                    examples: {
                        "Success": {
                            value: {
                                success: 1,
                                data: '',
                                message: 'Governance item created',
                                error: null
                            }
                        }
                    }
                }
            }
        }
        #swagger.responses[400] = {
            description: 'Bad Request',
        }
        #swagger.responses[404] = {
            description: 'Not Found'
        }
    */
  questDaoCtrl.createGovernanceItem
);

router.patch(
  '/:quest_key/publish',
  /*  #swagger.auto = false
        #swagger.tags = ['Quest-dao']
        #swagger.summary = 'Publish market (after quest is approved)'
        #swagger.description = 'Publishes market for an approved quest. Requires governance item to exist first. Does NOT create governance item.'
        #swagger.security = [{
           "bearerAuth": []
        }]
        #swagger.parameters['x-auth-message'] = {
            in: 'header',
            description: 'Authentication message',
            required: true,
            type: 'string'
        }
        #swagger.parameters['x-auth-signature'] = {
            in: 'header',
            description: 'Authentication signature',
            required: true,
            type: 'string'
        }
        #swagger.parameters['quest_key'] = {
            in: 'path',
            description: 'The key of the quest to publish market (must be APPROVE status)',
            required: true,
            type: 'integer'
        }
        #swagger.responses[200] = {
            description: 'Success',
            content: {
                "application/json": {
                    schema: {
                        success: 1,
                        data: '',
                        message: {
                            type: 'string'
                        },
                        error: null
                    },
                    examples: {
                        "Success": {
                            value: {
                                success: 1,
                                data: '',
                                message: 'Publish',
                                error: null
                            }
                        },
                        "Success with DB Update Failure": {
                            value: {
                                success: 1,
                                data: '',
                                message: 'Transaction success but DB Update Failed',
                                error: null
                            }
                        }
                    }
                }
            }
        }
        #swagger.responses[202] = {
            description: 'Pending',
            schema: {
                success: 1,
                data: '',
                message: 'Pending'
            }
        }
      #swagger.responses[400] = {
          description: 'Smart Contract Bad Request',
      }
      #swagger.responses[401] = {
          description: 'InvalidQuestStatus',
      }
      #swagger.responses[404] = {
          description: 'Not Found'
      }
    */
  questDaoCtrl.publishQuest
);
router.patch(
  '/:quest_key/dao-success',
  /*  #swagger.auto = false
        #swagger.tags = ['Quest-dao']
        #swagger.summary = 'Start DAO success decision process for a quest'
        #swagger.description = 'Initiates the DAO success decision process for a quest by calling the smart contract and updates the quest status in the database'
        #swagger.security = [{
           "bearerAuth": []
        }]
        #swagger.parameters['x-auth-message'] = {
            in: 'header',
            description: 'Authentication message',
            required: true,
            type: 'string'
        }
        #swagger.parameters['x-auth-signature'] = {
            in: 'header',
            description: 'Authentication signature',
            required: true,
            type: 'string'
        }
        #swagger.parameters['quest_key'] = {
            in: 'path',
            description: 'The key of the quest to start DAO success decision for',
            required: true,
            type: 'integer'
        }
        #swagger.responses[200] = {
            description: 'Success',
            content: {
                "application/json": {
                    schema: {
                        success: 1,
                        data: '',
                        message: {
                            type: 'string'
                        },
                        error: null
                    },
                    examples: {
                        "Success": {
                            value: {
                                success: 1,
                                data: '',
                                message: 'Start Decision',
                                error: null
                            }
                        },
                        "Success with DB Update Failure": {
                            value: {
                                success: 1,
                                data: '',
                                message: 'Transaction success but DB Update Failed',
                                error: null
                            }
                        }
                    }
                }
            }
        }
        #swagger.responses[202] = {
            description: 'Pending',
            schema: {
                success: 1,
                data: '',
                message: 'Pending'
            }
        }
      #swagger.responses[400] = {
          description: 'Smart Contract Bad Request',
      }
    */
  questDaoCtrl.startDaoSuccess
);
router.patch(
  '/:quest_key/dao-success/set',
  /*  #swagger.auto = false
        #swagger.tags = ['Quest-dao']
        #swagger.summary = 'Set DAO success decision for a quest'
        #swagger.description = 'Sets the DAO success decision for a quest by calling the smart contract and updates the quest status in the database'
        #swagger.security = [{
           "bearerAuth": []
        }]
        #swagger.parameters['x-auth-message'] = {
            in: 'header',
            description: 'Authentication message',
            required: true,
            type: 'string'
        }
        #swagger.parameters['x-auth-signature'] = {
            in: 'header',
            description: 'Authentication signature',
            required: true,
            type: 'string'
        }
        #swagger.parameters['quest_key'] = {
            in: 'path',
            description: 'The key of the quest to set DAO success decision for',
            required: true,
            type: 'integer'
        }
        #swagger.responses[200] = {
            description: 'Success',
            content: {
                "application/json": {
                    schema: {
                        success: 1,
                        data: '',
                        message: {
                            type: 'string'
                        },
                        error: null
                    },
                    examples: {
                        "Success": {
                            value: {
                                success: 1,
                                data: '',
                                message: 'success',
                                error: null
                            }
                        },
                        "Failure": {
                            value: {
                                success: 1,
                                data: '',
                                message: 'fail',
                                error: null
                            }
                        },
                        "Success with DB Update Failure": {
                            value: {
                                success: 1,
                                data: '',
                                message: 'Transaction success but DB Update Failed',
                                error: null
                            }
                        }
                    }
                }
            }
        }
        #swagger.responses[202] = {
            description: 'Pending',
            schema: {
                success: 1,
                data: '',
                message: 'Pending'
            }
        }
        #swagger.responses[400] = {
            description: 'Bad Request',
            schema: {
                success: 0,
                data: null,
                message: '',
                error: 'Error message'
            }
        }
    */
  questDaoCtrl.setDaoSuccess
);
router.patch(
  '/:quest_key/dao-success/make',
  /*  #swagger.auto = false
        #swagger.tags = ['Quest-dao']
        #swagger.summary = 'Make DAO success decision for a quest'
        #swagger.description = 'Initiates the process to make a DAO success decision for a quest'
        #swagger.security = [{
           "bearerAuth": []
        }]
        #swagger.parameters['x-auth-message'] = {
            in: 'header',
            description: 'Authentication message',
            required: true,
            type: 'string'
        }
        #swagger.parameters['x-auth-signature'] = {
            in: 'header',
            description: 'Authentication signature',
            required: true,
            type: 'string'
        }
        #swagger.parameters['quest_key'] = {
            in: 'path',
            description: 'The key of the quest to make DAO success decision for',
            required: true,
            type: 'integer'
        }
        #swagger.responses[200] = {
            description: 'Success',
            content: {
                "application/json": {
                    schema: {
                        success: 1,
                        data: '',
                        message: {
                            type: 'string'
                        },
                        error: null
                    },
                    examples: {
                        "Success": {
                            value: {
                                success: 1,
                                data: '',
                                message: 'DAO success decision made',
                                error: null
                            }
                        },
                        "Success with DB Update Failure": {
                            value: {
                                success: 1,
                                data: '',
                                message: 'Transaction success but DB Update Failed',
                                error: null
                            }
                        }
                    }
                }
            }
        }
        #swagger.responses[202] = {
            description: 'Pending',
            schema: {
                success: 1,
                data: '',
                message: 'Pending'
            }
        }
        #swagger.responses[400] = {
            description: 'Bad Request',
            schema: {
                success: 0,
                data: null,
                message: '',
                error: 'Error message'
            }
        }
    */
  questDaoCtrl.makeDaoSuccess
);
router.patch(
  '/:quest_key/finish',
  /*  #swagger.auto = false
        #swagger.tags = ['Quest-dao']
        #swagger.summary = 'Finish a market (lock betting and snapshot)'
        #swagger.security = [{
           "bearerAuth": []
        }]
        #swagger.parameters['x-auth-message'] = { in: 'header', required: true, type: 'string' }
        #swagger.parameters['x-auth-signature'] = { in: 'header', required: true, type: 'string' }
        #swagger.parameters['quest_key'] = { in: 'path', required: true, type: 'integer' }
        #swagger.responses[200] = { description: 'Finish' }
        #swagger.responses[202] = { description: 'Pending' }
        #swagger.responses[400] = { description: 'Bad Request' }
    */
  questDaoCtrl.finishQuest
);
router.patch(
  '/:quest_key/adjourn',
  /*  #swagger.auto = false
        #swagger.tags = ['Quest-dao']
        #swagger.summary = 'Adjourn a quest'
        #swagger.description = 'Adjourns a quest, potentially pausing or delaying its current state'
        #swagger.security = [{
           "bearerAuth": []
        }]
        #swagger.parameters['x-auth-message'] = {
            in: 'header',
            description: 'Authentication message',
            required: true,
            type: 'string'
        }
        #swagger.parameters['x-auth-signature'] = {
            in: 'header',
            description: 'Authentication signature',
            required: true,
            type: 'string'
        }
        #swagger.parameters['quest_key'] = {
            in: 'path',
            description: 'The key of the quest to adjourn',
            required: true,
            type: 'integer'
        }
        #swagger.responses[200] = {
            description: 'Success',
            content: {
                "application/json": {
                    schema: {
                        success: 1,
                        data: '',
                        message: {
                            type: 'string'
                        },
                        error: null
                    },
                    examples: {
                        "Success": {
                            value: {
                                success: 1,
                                data: '',
                                message: 'adjourn',
                                error: null
                            }
                        },
                        "Success with DB Update Failure": {
                            value: {
                                success: 1,
                                data: '',
                                message: 'Transaction success but DB Update Failed',
                                error: null
                            }
                        }
                    }
                }
            }
        }
        #swagger.responses[202] = {
            description: 'Pending',
            schema: {
                success: 1,
                data: '',
                message: 'Pending'
            }
        }
        #swagger.responses[400] = {
            description: 'Bad Request',
            schema: {
                success: 0,
                data: null,
                message: '',
                error: 'Error message'
            }
        }
    */
  questDaoCtrl.adjournQuest
);
router.patch(
  '/:quest_key/answer',
  /*  #swagger.auto = false
        #swagger.tags = ['Quest-dao']
        #swagger.summary = 'Set answer for a quest'
        #swagger.description = 'Sets the answer on-chain and updates the database for a quest in DAO_SUCCESS status'
        #swagger.security = [{
           "bearerAuth": []
        }]
        #swagger.parameters['x-auth-message'] = {
            in: 'header',
            description: 'Authentication message',
            required: true,
            type: 'string'
        }
        #swagger.parameters['x-auth-signature'] = {
            in: 'header',
            description: 'Authentication signature',
            required: true,
            type: 'string'
        }
        #swagger.parameters['quest_key'] = {
            in: 'path',
            description: 'The key of the quest to set answer for',
            required: true,
            type: 'integer'
        }
        #swagger.responses[200] = {
            description: 'Success',
            content: {
                "application/json": {
                    schema: {
                        success: 1,
                        data: '',
                        message: {
                            type: 'string'
                        },
                        error: null
                    },
                    examples: {
                        "Success": {
                            value: {
                                success: 1,
                                data: '',
                                message: 'Answer set successfully',
                                error: null
                            }
                        },
                        "Already Set": {
                            value: {
                                success: 1,
                                data: '',
                                message: 'Answer already set on-chain',
                                error: null
                            }
                        }
                    }
                }
            }
        }
        #swagger.responses[202] = {
            description: 'Pending',
            schema: {
                success: 1,
                data: '',
                message: 'Pending'
            }
        }
        #swagger.responses[400] = {
            description: 'Bad Request',
            schema: {
                success: 0,
                data: null,
                message: '',
                error: 'Error message'
            }
        }
    */
  questDaoCtrl.setAnswer
);
router.patch(
  '/:quest_key/finalize-answer',
  /*  #swagger.auto = false
        #swagger.tags = ['Quest-dao']
        #swagger.summary = 'Finalize answer vote for a quest'
        #swagger.description = 'Finalizes the answer vote phase, allowing rewards to be claimed'
        #swagger.security = [{
           "bearerAuth": []
        }]
        #swagger.parameters['quest_key'] = {
            in: 'path',
            description: 'The key of the quest to finalize answer vote',
            required: true,
            type: 'integer'
        }
        #swagger.responses[200] = {
            description: 'Success',
        }
  */
  questDaoCtrl.finalizeAnswer
);
router.patch(
  '/:quest_key/success',
  /*  #swagger.auto = false
        #swagger.tags = ['Quest-dao']
        #swagger.summary = 'Mark a quest as successful'
        #swagger.description = 'Updates the status of a quest to mark it as successful'
        #swagger.security = [{
           "bearerAuth": []
        }]
        #swagger.parameters['x-auth-message'] = {
            in: 'header',
            description: 'Authentication message',
            required: true,
            type: 'string'
        }
        #swagger.parameters['x-auth-signature'] = {
            in: 'header',
            description: 'Authentication signature',
            required: true,
            type: 'string'
        }
        #swagger.parameters['quest_key'] = {
            in: 'path',
            description: 'The key of the quest to mark as successful',
            required: true,
            type: 'integer'
        }
        #swagger.responses[200] = {
            description: 'Success',
            content: {
                "application/json": {
                    schema: {
                        success: 1,
                        data: '',
                        message: {
                            type: 'string'
                        },
                        error: null
                    },
                    examples: {
                        "Success": {
                            value: {
                                success: 1,
                                data: '',
                                message: 'Quest marked as successful',
                                error: null
                            }
                        },
                        "Success with DB Update Failure": {
                            value: {
                                success: 1,
                                data: '',
                                message: 'Transaction success but DB Update Failed',
                                error: null
                            }
                        }
                    }
                }
            }
        }
        #swagger.responses[202] = {
            description: 'Pending',
            schema: {
                success: 1,
                data: '',
                message: 'Pending'
            }
        }
        #swagger.responses[400] = {
            description: 'Bad Request',
            schema: {
                success: 0,
                data: null,
                message: '',
                error: 'Error message'
            }
        }
    */
  questDaoCtrl.successQuest
);

router.patch(
  '/:quest_key/retrieve',
  /*  #swagger.auto = false
          #swagger.tags = ['Quest-dao']
          #swagger.summary = 'Retrieve token from the quest'
          #swagger.description = 'Retrieve remain token in the quest after 180 days'
          #swagger.security = [{
             "bearerAuth": []
          }]
          #swagger.parameters['x-auth-message'] = {
              in: 'header',
              description: 'Authentication message',
              required: true,
              type: 'string'
          }
          #swagger.parameters['x-auth-signature'] = {
              in: 'header',
              description: 'Authentication signature',
              required: true,
              type: 'string'
          }
          #swagger.parameters['quest_key'] = {
              in: 'path',
              description: 'The key of the quest',
              required: true,
              type: 'integer'
          }
          #swagger.responses[200] = {
              description: 'Success',
              content: {
                  "application/json": {
                      schema: {
                          success: 1,
                          data: '',
                          message: {
                              type: 'string'
                          },
                          error: null
                      },
                      examples: {
                          "Success": {
                              value: {
                                  success: 1,
                                  data: '',
                                  message: 'Retrieved token',
                                  error: null
                              }
                          }
                      }
                  }
              }
          }
          #swagger.responses[202] = {
              description: 'Pending',
              schema: {
                  success: 1,
                  data: '',
                  message: 'Pending'
              }
          }
          #swagger.responses[400] = {
              description: 'Bad Request',
              schema: {
                  success: 0,
                  data: null,
                  message: '',
                  error: 'Error message'
              }
          }
      */
  questDaoCtrl.retrieveToken
);

// Only for the test
router.patch(
  '/:quest_key/draft-end',
  adminAuth,
  /*  #swagger.auto = false
        #swagger.tags = ['Quest-dao']
        #swagger.summary = 'Set Draft End time in force (ONLY TEST)'
        #swagger.description = 'This api is only for the test'
        #swagger.security = [{
           "bearerAuth": []
        }]
        #swagger.parameters['x-auth-message'] = {
            in: 'header',
            description: 'Authentication message',
            required: true,
            type: 'string'
        }
        #swagger.parameters['x-auth-signature'] = {
            in: 'header',
            description: 'Authentication signature',
            required: true,
            type: 'string'
        }
        #swagger.parameters['quest_key'] = {
            in: 'path',
            description: 'The key of the quest to mark as successful',
            required: true,
            type: 'integer'
        }
        #swagger.responses[200] = { 
            description: 'Ok'
        }
*/
  questDaoCtrl.EndDraftTime
);

router.patch(
  '/:quest_key/sync',
  adminAuth,
  questDaoCtrl.syncStatus
);

router.patch(
  '/:quest_key/dao-success-end',
  adminAuth,
  /*  #swagger.auto = false
        #swagger.tags = ['Quest-dao']
        #swagger.summary = 'Set Success End time in force (ONLY TEST)'
        #swagger.description = 'This api is only for the test'
        #swagger.security = [{
           "bearerAuth": []
        }]
        #swagger.parameters['x-auth-message'] = {
            in: 'header',
            description: 'Authentication message',
            required: true,
            type: 'string'
        }
        #swagger.parameters['x-auth-signature'] = {
            in: 'header',
            description: 'Authentication signature',
            required: true,
            type: 'string'
        }
        #swagger.parameters['quest_key'] = {
            in: 'path',
            description: 'The key of the quest to mark as successful',
            required: true,
            type: 'integer'
        }
        #swagger.responses[200] = { 
            description: 'Ok'
        }
*/
  questDaoCtrl.EndSuccessTime
);
router.patch(
  '/:quest_key/answer-end',
  adminAuth,
  /*  #swagger.auto = false
        #swagger.tags = ['Quest-dao']
        #swagger.summary = 'Set Answer End time in force (ONLY TEST)'
        #swagger.description = 'This api is only for the test'
        #swagger.security = [{
           "bearerAuth": []
        }]
        #swagger.parameters['x-auth-message'] = {
            in: 'header',
            description: 'Authentication message',
            required: true,
            type: 'string'
        }
        #swagger.parameters['x-auth-signature'] = {
            in: 'header',
            description: 'Authentication signature',
            required: true,
            type: 'string'
        }
        #swagger.parameters['quest_key'] = {
            in: 'path',
            description: 'The key of the quest to mark as successful',
            required: true,
            type: 'integer'
        }
        #swagger.responses[200] = { 
            description: 'Ok'
        }
*/
  questDaoCtrl.EndAnswerTime
);

// Transaction monitoring routes
router.post(
  '/:quest_key/submit-signature',
  /* #swagger.tags = ['Quest DAO']
      #swagger.summary = 'Submit transaction signature for monitoring'
      #swagger.description = 'Submit transaction signature after client submits to Solana'
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
                      required: ['signature', 'type'],
                      properties: {
                          signature: {
                              type: 'string',
                              description: 'Transaction signature from Solana'
                          },
                          type: {
                              type: 'string',
                              description: 'Transaction type (setQuestResult, makeQuestResult, etc.)'
                          },
                          updateData: {
                              type: 'object',
                              description: 'Additional data to update in DB when confirmed'
                          }
                      }
                  }
              }
          }
      }
      #swagger.responses[200] = {
          description: 'Success'
      }
  */
  questDaoCtrl.submitTransactionSignature
);

router.get(
  '/:quest_key/pending-transactions',
  /* #swagger.tags = ['Quest DAO']
      #swagger.summary = 'Get pending transactions for a quest'
      #swagger.description = 'Get list of pending transactions being monitored'
      #swagger.parameters[0] = {
          in: 'path',
          name: 'quest_key',
          description: 'The key of the quest',
          required: true,
          type: 'integer'
      }
      #swagger.responses[200] = {
          description: 'Success'
      }
  */
  questDaoCtrl.getPendingTransactions
);

module.exports = router;
