const express = require('express');
const router = express.Router({ strict: true });
const bettingCtrl = require('../controllers/bettingController');
const upload = require('../config/multer');
const handleError = require('../middlewares/multerError');
// const auth = require('../middlewares/authJwt');
const checkRole = require('../middlewares/checkRole');

router.post(
    /*
      #swagger.tags = ['Betting']
    */
    '/add',
    bettingCtrl.addBetting);

router.get(
    /*
      #swagger.auto = false
      #swagger.tags = ['Betting']
      #swagger.summary = 'Get Betting'
      #swagger.description = 'Get betting associated with the given betting key'
      #swagger.parameters['quest_key'] = {
        in: 'path',
        description: 'Id of quest',
        required: true,
        type: 'integer'
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
                                type: "object",
                                items: {},
                                default: {$ref: '#/components/examples/Betting/value'}
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
         description: 'Not Found',
      }
      #swagger.responses[405] = {
         description: 'Validation Exception',
      }
  */
    '/:betting_key', bettingCtrl.getBetting);
router.put(

    /* #swagger.auto = false
           #swagger.tags = ['Betting']
           #swagger.parameters['betting_key'] = {
               in: 'path',
               description: 'Unique Id of betting (betting_key)',
               required: true,
               type: 'string'
           }

           #swagger.requestBody = {
               required: true,
               "@content": {
                   "application/json": {
                       schema: {
                           type: "object",
                           properties:{
                               betting_tx : {
                                     type: "string",
                                     example: "0x123456789098765...",
                                     description: "Transaction hash"
                                 },
                            }
                       }
                   }
               }
           }
        #swagger.responses[200] = {
               "description": "success",
               "content": {
                   "application/json": {
                   "schema": {
                       type:"object",
                       "properties": {
                           "success": {
                               "type": "integer",
                               "default": "1"
                           },
                           data: {
                                type: "object",
                                default: {$ref: '#/components/examples/Betting/value'},
                                description: "Updated Betting",

                           },
                           error: {
                                type: "string",
                                default: null
                           },
                           message: {
                                type: "string",
                                default: ""
                           }
                       }
               }
             }
           }
       }
          #swagger.responses[400] = {
               "description": "Invalid transaction hash",
               "content": {
                   "application/json": {
                   "schema": {
                       type:"object",
                       "properties": {
                            success: {
                                type: "integer",
                                default: 0
                            },
                            data: {
                                type: "string",
                                default: null
                            },
                           "error": {
                               "type": "string",
                               description: "Invalid transaction hash",
                               default: "Invalid transaction hash"
                           },
                           message: {
                                type: "string",
                                description: "Invalid transaction hash",
                                default: "Invalid transaction hash"
                           }
                       }
               }
             }
           }
       }
       #swagger.responses[401] = {
               "description": "Betting Not Found",
               "content": {
                   "application/json": {
                   "schema": {
                       type:"object",
                       "properties": {
                            success: {
                                type: "integer",
                                default: 0
                            },
                            data: {
                                type: "string",
                                default: null
                            },
                           "error": {
                               "type": "string",
                               description: "Betting not found",
                               default: "Betting not found"
                           },
                           message: {
                                type: "string",
                                description: "Betting not found",
                                default: "Betting not found"
                           }
                       }
               }
             }
           }
       }
       */
    '/confirm/:betting_key', bettingCtrl.confirmBetting)
router.put(
    /* #swagger.auto = false
           #swagger.tags = ['Betting']
           #swagger.parameters['betting_key'] = {
               in: 'path',
               description: 'Unique Id of betting (betting_key)',
               required: true,
               type: 'string'
           }

           #swagger.requestBody = {
               required: true,
               "@content": {
                   "application/json": {
                       schema: {
                           type: "object",
                           properties:{
                               reward_tx : {
                                     type: "string",
                                     example: "0x123456789098765...",
                                     description: "Transaction hash"
                                 },
                            }
                       }
                   }
               }
           }
        #swagger.responses[200] = {
               "description": "success",
               "content": {
                   "application/json": {
                   "schema": {
                       type:"object",
                       "properties": {
                           "success": {
                               "type": "integer",
                               "default": "1"
                           },
                           data: {
                                type: "object",
                                default: {$ref: '#/components/examples/Betting/value'},
                                description: "Updated Betting",

                           },
                           error: {
                                type: "string",
                                default: null
                           },
                           message: {
                                type: "string",
                                default: ""
                           }
                       }
               }
             }
           }
       }
          #swagger.responses[400] = {
               "description": "Invalid transaction hash",
               "content": {
                   "application/json": {
                   "schema": {
                       type:"object",
                       "properties": {
                            success: {
                                type: "integer",
                                default: 0
                            },
                            data: {
                                type: "string",
                                default: null
                            },
                           "error": {
                               "type": "string",
                               description: "Invalid transaction hash",
                               default: "Invalid transaction hash"
                           },
                           message: {
                                type: "string",
                                description: "Invalid transaction hash",
                                default: "Invalid transaction hash"
                           }
                       }
               }
             }
           }
       }
       #swagger.responses[401] = {
               "description": "Betting Not Found",
               "content": {
                   "application/json": {
                   "schema": {
                       type:"object",
                       "properties": {
                            success: {
                                type: "integer",
                                default: 0
                            },
                            data: {
                                type: "string",
                                default: null
                            },
                           "error": {
                               "type": "string",
                               description: "Betting not found",
                               default: "Betting not found"
                           },
                           message: {
                                type: "string",
                                description: "Betting not found",
                                default: "Betting not found"
                           }
                       }
               }
             }
           }
       }
       #swagger.responses[402] = {
               "description": "Reward already claimed",
               "content": {
                   "application/json": {
                   "schema": {
                       type:"object",
                       "properties": {
                            success: {
                                type: "integer",
                                default: 0
                            },
                            data: {
                                type: "string",
                                default: null
                            },
                           "error": {
                               "type": "string",
                               description: "Betting already claimed",
                               default: "Betting already claimed"
                           },
                           message: {
                                type: "string",
                                description: "Betting is already claimed",
                                default: "Betting is already claimed"
                           }
                       }
               }
             }
           }
       }
       */
    '/claim-reward/:betting_key', bettingCtrl.claimBettingReward)

// New Solana-specific routes
router.post(
    /*
      #swagger.tags = ['Betting']
      #swagger.summary = 'Check Available Receive Tokens'
      #swagger.description = 'Check how many tokens are available to receive for a bet'
      #swagger.requestBody = {
          required: true,
          "@content": {
              "application/json": {
                  schema: {
                      type: "object",
                      properties:{
                          quest_key: {
                              type: "string",
                              example: "123",
                              description: "Quest key (market key)"
                          },
                          answer_key: {
                              type: "string", 
                              example: "1",
                              description: "Answer key"
                          },
                          betting_address: {
                              type: "string",
                              example: "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM",
                              description: "User wallet address"
                          }
                      }
                  }
              }
          }
      }
    */
    '/available-receive-tokens', bettingCtrl.availableReceiveTokens)

router.post(
    /*
      #swagger.tags = ['Betting']
      #swagger.summary = 'Create Receive Token Transaction'
      #swagger.description = 'Create a transaction to receive tokens from a winning bet'
      #swagger.requestBody = {
          required: true,
          "@content": {
              "application/json": {
                  schema: {
                      type: "object",
                      properties:{
                          quest_key: {
                              type: "string",
                              example: "123",
                              description: "Quest key (market key)"
                          },
                          answer_key: {
                              type: "string",
                              example: "1", 
                              description: "Answer key"
                          },
                          betting_address: {
                              type: "string",
                              example: "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM",
                              description: "User wallet address"
                          }
                      }
                  }
              }
          }
      }
    */
    '/receive-token', bettingCtrl.receiveToken)

router.get(
    /*
      #swagger.tags = ['Betting']
      #swagger.summary = 'Get Market Info'
      #swagger.description = 'Get information about a market/quest from Solana blockchain'
      #swagger.parameters['quest_key'] = {
          in: 'path',
          description: 'Quest key (market key)',
          required: true,
          type: 'string'
      }
    */
    '/market-info/:quest_key', bettingCtrl.getMarketInfo)

router.post(
    /*
      #swagger.tags = ['Betting']
      #swagger.summary = 'Get User Bet Info'
      #swagger.description = 'Get information about a user bet from Solana blockchain'
      #swagger.requestBody = {
          required: true,
          "@content": {
              "application/json": {
                  schema: {
                      type: "object",
                      properties:{
                          quest_key: {
                              type: "string",
                              example: "123",
                              description: "Quest key (market key)"
                          },
                          answer_key: {
                              type: "string",
                              example: "1",
                              description: "Answer key"
                          },
                          betting_address: {
                              type: "string",
                              example: "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM",
                              description: "User wallet address"
                          }
                      }
                  }
              }
          }
      }
    */
    '/user-bet-info', bettingCtrl.getUserBetInfo)

module.exports = router;