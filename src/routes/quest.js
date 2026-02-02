const express = require('express');
const router = express.Router({ strict: true });
const questCtrl = require('../controllers/questController');
const questDaoCtrl = require('../controllers/questDaoController');
const upload = require('../config/multer');
const handleError = require('../middlewares/multerError');
const { memberAuth } = require('../middlewares/authWeb3');
// const auth = require('../middlewares/authJwt');
const checkRole = require('../middlewares/checkRole');

router.post(
  /*
       #swagger.auto = false
       #swagger.consumes = ['multipart/form-data']
       #swagger.tags = ['Quest']
       #swaffer.summary = Here
       #swagger.requestBody = {
       required: true,
       "@content": {
           "multipart/form-data": {
               schema: {
                   type: "object",
                   properties: {
                       quest_title: {
                           type: "string",
                           description: "Title of the quest"
                       },
                       quest_description: {
                        type: "string",
                        description: "Description of associated quest"
                       },
                       quest_end_date: {
                           type: "string",
                           description: "End date of quest betting"
                       },
                       quest_category_id: {
                           type: "string",
                           description: "Id of the category to which this quest belongs to"
                       },
                       season_id: {
                            type: "string",
                            description: "UUID of the season this quest belongs to"
                       },
                       quest_creator:{
                           type: "string",
                           description: "Wallet address of the quest creator"
                       },
                       quest_betting_token: {
                            type: "string",
                            description: "Betting token used for this particular quest!",
                            defaultValue: "BOOM"
                       },
                       quest_image_link: {
                            type: "string",
                            description: "External link of the quest"
                       },
                       answers: {
                           type: "array",
                           description: "An array of answers (i.e., answer titles)",
                           example: ["YES","NO"],
                       },
                       file: {
                           type: "string",
                           description: "Quest image",
                           format: "binary"
                       }
                   },
                   required: ["file", "answers", "quest_title", "quest_description", "quest_image_link", "quest_end_date","quest_category_id", "quest_creator", "quest_betting_token", "season_id"]
               }
           }
       }
   }
   #swagger.responses[200] = {
       description: 'Quest Added',
       schema: { $ref: '#/components/schemas/Quest'}
    }

        #swagger.responses[400] = {
                "description": "Bad Request",
                "content": {
                    "application/json": {
                    "schema": {
                        type:"object",
                        "properties": {
                            "error": {
                                "type": "string",
                                "description": "error:\n * `First Error` - File must be of type jpeg/png/mp4 \n * `Second Error` - Quest needs to have answers\n * `Third Error` - Invalid date value \n * `Fouth Error` - File is too large \n * `Fifth Error` - File limit reached",
                                "enum": [
                                "Invalid date value ",
                                "Quest needs to have answers",
                                "File must be of type jpeg/png/mp4",
                                "File limit reached",
                                "File is too large"
                                ],
                                "default": "File is too large"
                            }
                        }
                }
              }
            }
        }
        #swagger.responses[401] = {
                "description": "File not attached",
                "content": {
                    "application/json": {
                    "schema": {
                        type:"object",
                        "properties": {
                            "error": {
                                "type": "string",
                                "description": "error:\n * `First Error` -  Authorization Failed! \n * `Second Error` - Authentication required !\n",
                                "enum": [
                                " Authorization Failed!",
                                "Authentication required."
                                ],
                                "default": "File is not attached"
                            }
                        }
                }
              }
            }
        }

        #swagger.responses[402] = {
                "description": "Answers are required!",
                "content": {
                    "application/json": {
                    "schema": {
                        type:"object",
                        "properties": {
                            "error": {
                                "type": "string",
                                "default": "Answers are required!"
                            }
                        }
                }
              }
            }
        }
       */
  '/add',
  upload.single('file'),
  handleError,
  questCtrl.addQuest
);

router.get(
  '/generate-id',
  questCtrl.generateQuestKey
);

router.patch(
  /*
        #swagger.auto = false
        #swagger.tags = ['Quest']
        #swagger.summary = 'Update quest draft information'
        #swagger.parameters['quest_key'] = {
          in: 'path',
          description: 'Id of quest',
          required: true,
          type: 'string'
        }

       #swagger.requestBody = {
       required: true,
       "@content": {
           "application/json": {
               schema: {
                   type: "object",
                   properties: {
                       start_at: {
                           type: "string",
                           description: "Quest draft Start time from transaction data"
                       },
                       end_at: {
                        type: "string",
                        description: "Quest draft End time from transaction data"
                       },
                       tx: {
                           type: "string",
                           description: "transaction hash"
                       },
                       start_block: {
                            type: "integer",
                            description: "The quest start block number"
                       }
                   },
                   required: ["start_at", "end_at", "tx", "start_block"]
               }
           }
       }
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
                                  type: "string",
                                  items: {},
                                  default: "1728741093000463"
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
    */
  '/:quest_key/draft',
  questCtrl.draftQuest
);

router.get(
  /*#swagger.auto = false
     #swagger.tags = ['Quest']
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
                                default: {$ref: '#/components/examples/AllQuests/value'}
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

   */
  '/all',
  questCtrl.getPagedQuests
);

router.get(
  '/dao',
  /*  #swagger.auto = false
          #swagger.tags = ['Quest']
          #swagger.summary = 'List DAO Quests'
          #swagger.description = 'Retrieves a list of DAO quests with optional filtering and pagination'
  
         #swagger.parameters['status'] = {
            in: 'query',
            description: 'filter dao quest status : draft, success, answer',
            required: true,
            type:  'string',
            default: 'draft'
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
                    draft: {$ref: '#/components/examples/DraftQuestAtUser'},
                    success: {$ref: '#/components/examples/SuccessQuestAtUser'},
                    answer: {$ref: '#/components/examples/AnswerQuestAtUser'},
                }
              }
            }
          }
      */
  questCtrl.listQuestDao
);

router.get(
  /*#swagger.auto = false
         #swagger.tags = ['Quest']
          #swagger.summary = 'List Quests on Carousel'
          #swagger.description = 'Retrieves a list of DAO quests with quest_status is PUBLISH/FINISH and quest_hot is true.'
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
                        examples : {data : {$ref: '#/components/examples/CarouselQuests'}},
                    }
                }
            }
       */
  '/carousel',
  questCtrl.getQuestsOnCarousel
);

router.get(
  /*#swagger.auto = false
         #swagger.tags = ['Quest']
  
          #swagger.summary = 'List Quests on Popular'
          #swagger.description = 'Retrieves a list of DAO quests with quest_status is PUBLISH/FINISH and order by total amount of betting DESC.'
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
                        examples: {data : {$ref: '#/components/examples/PopularQuests'} },
                    }
                }
            }
       */
  '/popular',
  questCtrl.getQuestsOnPopular
);

router.get(
  /*#swagger.auto = false
       #swagger.tags = ['Quest']
       #swagger.parameters['category'] = {
               in: 'path',
               description: 'Category the quests belong to',
               required: true,
              type:  'string',
              default: 'all'
         }
        #swagger.parameters['status'] = {
             in: 'path',
             description: 'status of the quest',
             required: true,
             type:  'string',
             default: 'all'
          }
       #swagger.parameters['token'] = {
               in: 'query',
               description: 'Betting token',
               required: false,
              type:  'string'
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
                                  default: {$ref: '#/components/examples/AllQuests/value'}
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

     */
  '/filter/:category/:status',
  questCtrl.getQuestsByCategory
);

router.get(
  /*#swagger.auto = false
       #swagger.tags = ['Quest']
       #swagger.parameters['quest_key'] = {
               in: 'path',
               description: 'Unique identifier of quest',
               required: true,
              type:  'string',
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
                                  default: {$ref: '#/components/examples/QuestBettings/value'}
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

     */
  '/:quest_key/bettings',
  questCtrl.getQuestBettings
);
// router.put(
//     /* #swagger.auto = false
//            #swagger.tags = ['Quest']
//            #swagger.parameters['quest_key'] = {
//                in: 'path',
//                description: 'quest key',
//                required: true,
//                type: 'string'
//            }

//        #swagger.requestBody = {
//                required: true,
//                "@content": {
//                    "application/json": {
//                        schema: {
//                            type: "object",
//                            properties:{
//                                status : {
//                                      type: "string",
//                                      example: "APPROVE",
//                                      description: "Status of the quest to set"
//                                  },
//                                tx : {
//                                      type: "string",
//                                      example: "0x123456789098765...",
//                                      description: "Transaction Hash"
//                                  }
//                             }
//                        }
//                    }
//                }
//            }
//         #swagger.responses[200] = {
//                "description": "success",
//                "content": {
//                    "application/json": {
//                    "schema": {
//                        type:"object",
//                        "properties": {
//                            "success": {
//                                "type": "integer",
//                                "default": "1"
//                            },
//                            data: {
//                                 type: "integer",
//                                 default: "2",
//                                 description: "Quest key"
//                            },
//                            error: {
//                                 type: "string",
//                                 default: null
//                            },
//                            message: {
//                                 type: "string",
//                                 default: ""
//                            }
//                        }
//                }
//              }
//            }
//        }
//           #swagger.responses[401] = {
//                "description": "Quest Not Found",
//                "content": {
//                    "application/json": {
//                    "schema": {
//                        type:"object",
//                        "properties": {
//                             success: {
//                                 type: "integer",
//                                 default: 0
//                             },
//                             data: {
//                                 type: "string",
//                                 default: null
//                             },
//                            "error": {
//                                "type": "string",
//                                description: "Quest not found",
//                                default: "Quest not found"
//                            },
//                            message: {
//                                 type: "string",
//                                 description: "Quest not found",
//                                 default: "Quest not found"
//                            }
//                        }
//                }
//              }
//            }
//        }
//        */
//     '/:quest_key',
//     questCtrl.updateStatus)

router.get(
  /*
        #swagger.auto = false
        #swagger.tags = ['Quest']
        #swagger.summary = 'Get quest'
        #swagger.description = 'Fetch all data of a single quest'
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
                                  type: "array",
                                  items: {},
                                  default: {$ref: '#/components/examples/Quest/value'}
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
  '/:quest_key',
  questCtrl.getQuest
);

router.post(
  '/:quest_key/publish',
  /* #swagger.auto = false
     #swagger.tags = ['Quest', 'Solana']
     #swagger.summary = 'Publish market on Solana'
     #swagger.description = 'Create and publish a market on Solana blockchain'
     #swagger.parameters['quest_key'] = {
       in: 'path',
       description: 'Quest key',
       required: true,
       type: 'string'
     }
     #swagger.requestBody = {
       required: true,
       content: {
         "application/json": {
           schema: {
             type: "object",
             properties: {
               marketKey: { type: "string", description: "Market key" },
               creator: { type: "string", description: "Creator wallet address" },
               title: { type: "string", description: "Market title" },
               createFee: { type: "string", description: "Creation fee" },
               creatorFeePercentage: { type: "string", description: "Creator fee percentage" },
               serviceFeePercentage: { type: "string", description: "Service fee percentage" },
               charityFeePercentage: { type: "string", description: "Charity fee percentage" },
               answerKeys: { type: "array", items: { type: "string" }, description: "Answer keys" }
             },
             required: ["marketKey", "creator", "title"]
           }
         }
       }
     }
     #swagger.responses[200] = {
       description: 'Market publish transaction created',
       content: {
         "application/json": {
           schema: {
             type: "object",
             properties: {
               success: { type: "integer", example: 1 },
               data: {
                 type: "object",
                 properties: {
                   transaction: { type: "string", description: "Base64 encoded transaction" },
                   questKey: { type: "string" },
                   message: { type: "string" }
                 }
               }
             }
           }
         }
       }
     }
  */
  questCtrl.publishMarket
);

/**
 * Mark market as successful
 * POST /quests/:quest_key/success
 */
router.post(
  '/:quest_key/success',
  /* #swagger.auto = false
     #swagger.tags = ['Quest', 'Solana']
     #swagger.summary = 'Mark market as successful'
     #swagger.description = 'Mark a market as successful with correct answer'
     #swagger.parameters['quest_key'] = {
       in: 'path',
       description: 'Quest key',
       required: true,
       type: 'string'
     }
     #swagger.requestBody = {
       required: true,
       content: {
         "application/json": {
           schema: {
             type: "object",
             properties: {
               marketKey: { type: "string", description: "Market key" },
               correctAnswerKey: { type: "string", description: "Correct answer key" }
             },
             required: ["marketKey", "correctAnswerKey"]
           }
         }
       }
     }
  */
  questCtrl.successMarket
);

/**
 * Adjourn market
 * POST /quests/:quest_key/adjourn
 */
router.post(
  '/:quest_key/adjourn',
  /* #swagger.auto = false
     #swagger.tags = ['Quest', 'Solana']
     #swagger.summary = 'Adjourn market'
     #swagger.description = 'Adjourn a market on Solana blockchain'
     #swagger.parameters['quest_key'] = {
       in: 'path',
       description: 'Quest key',
       required: true,
       type: 'string'
     }
     #swagger.requestBody = {
       required: true,
       content: {
         "application/json": {
           schema: {
             type: "object",
             properties: {
               marketKey: { type: "string", description: "Market key" },
               owner: { type: "string", description: "Owner wallet address" }
             },
             required: ["marketKey", "owner"]
           }
         }
       }
     }
  */
  questCtrl.adjournMarket
);

/**
 * Retrieve tokens from market
 * POST /quests/:quest_key/retrieve
 */
router.post(
  '/:quest_key/retrieve',
  /* #swagger.auto = false
     #swagger.tags = ['Quest', 'Solana']
     #swagger.summary = 'Retrieve tokens from market'
     #swagger.description = 'Retrieve tokens from a market for a user'
     #swagger.parameters['quest_key'] = {
       in: 'path',
       description: 'Quest key',
       required: true,
       type: 'string'
     }
     #swagger.requestBody = {
       required: true,
       content: {
         "application/json": {
           schema: {
             type: "object",
             properties: {
               marketKey: { type: "string", description: "Market key" },
               user: { type: "string", description: "User wallet address" }
             },
             required: ["marketKey", "user"]
           }
         }
       }
     }
  */
  questCtrl.retrieveTokens
);

/**
 * Get market information
 * GET /quests/:quest_key/market-info
 */
router.get(
  '/:quest_key/market-info',
  /* #swagger.auto = false
     #swagger.tags = ['Quest', 'Solana']
     #swagger.summary = 'Get market information'
     #swagger.description = 'Get market information from Solana blockchain'
     #swagger.parameters['quest_key'] = {
       in: 'path',
       description: 'Quest key',
       required: true,
       type: 'string'
     }
     #swagger.parameters['marketKey'] = {
       in: 'query',
       description: 'Market key',
       required: true,
       type: 'string'
     }
  */
  questCtrl.getMarketInfo
);

/**
 * Get market status
 * GET /quests/:quest_key/market-status
 */
router.get(
  '/:quest_key/market-status',
  /* #swagger.auto = false
     #swagger.tags = ['Quest', 'Solana']
     #swagger.summary = 'Get market status'
     #swagger.description = 'Get market status from Solana blockchain'
     #swagger.parameters['quest_key'] = {
       in: 'path',
       description: 'Quest key',
       required: true,
       type: 'string'
     }
     #swagger.parameters['marketKey'] = {
       in: 'query',
       description: 'Market key',
       required: true,
       type: 'string'
     }
  */
  questCtrl.getMarketStatus
);

// Route for users to create governance item (does not require admin role)
router.patch(
  '/:quest_key/create-governance-item',
  memberAuth,
  /*  #swagger.auto = false
        #swagger.tags = ['Quest']
        #swagger.summary = 'Create governance item (PDA) for voting (User)'
        #swagger.description = 'Creates a governance item (PDA) on-chain for voting. This endpoint is for regular users (not admin). This should be called before voting starts. Does NOT publish market.'
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
        #swagger.responses[403] = {
            description: 'Forbidden - Authentication required',
        }
        #swagger.responses[404] = {
            description: 'Not Found'
        }
    */
  questDaoCtrl.createGovernanceItem
);

module.exports = router;
