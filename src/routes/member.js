const express = require('express');
const router = express.Router({ strict: true });
const memberCtrl = require('../controllers/memberController');
const dailyRewardCtrl = require('../controllers/dailyRewardController');
const upload = require('../config/multer');
const handleError = require('../middlewares/multerError');
const { adminAuth, memberAuth } = require('../middlewares/authWeb3');

router.post(
  '/login/solana',
  /*  #swagger.auto = false
      #swagger.tags = ['Member']
      #swagger.summary = 'Login with Solana signature to receive JWT'
      #swagger.parameters['x-auth-message'] = { in: 'header', required: true, type: 'string' }
      #swagger.parameters['x-auth-signature'] = { in: 'header', required: true, type: 'string' }
  */
  memberCtrl.loginSolana
);

router.get(
  '/auth-check',
  adminAuth,
  /*
    #swagger.auto = false
    #swagger.tags = ['Member']
    #swagger.summary = 'Check sender is admin or not'
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
                              default: ''
                          },
                          message: {
                              type: "string",
                              default: "Checked!"
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

    #swagger.responses[403] = {
       description: 'AuthenticationInvalid',
    }
    #swagger.responses[404] = {
       description: 'Not Found',
    }
    */

  memberCtrl.authCheck
);

router.post(
  '/',
  /*  
  #swagger.auto = false
  #swagger.tags = ['Member']
  #swagger.summary = 'Create a new member'
  #swagger.description = 'Creates a new user on boomplay'
      #swagger.requestBody = {
          required: true,
          "@content": {
              "application/json": {
                  schema: {
                      required: ['wallet_address'],
                        properties: {
                          wallet_address: {
                              $ref: '#/components/schemas/Member/properties/wallet_address'
                          },
                        }
                  },
                  examples:{
                    Member :{$ref: '#/components/examples/MemberCreate'}
                }
                }
              }
          }
  #swagger.responses[200] = {
        description: 'Created Member',
  }
  #swagger.responses[405] = {
     description: 'Validation Exception',
  }
  #swagger.responses[409] = {
          "description": "Conflict",
  }
  */
  memberCtrl.createMember
);
router.post(
  '/v2',
  /*
  #swagger.auto = false
  #swagger.tags = ['Member','NEW']
  #swagger.summary = 'Create a new privy member'
  #swagger.parameters['referral'] = {
            in: 'referral',
            description: 'Referral code (if any)',
            required: false,
            type:  'string',
      }
  #swagger.description = 'Creates a new privy user on BOOM PLAY. If you have a referral code, please add it as a query parameter. When this API is called with a referral code, the referree will receive a reward.'
      #swagger.requestBody = {
          required: true,
          "@content": {
              "application/json": {
                  schema: {
                      required: ['wallet_address'],
                        properties: {
                          wallet_address: {
                              $ref: '#/components/schemas/Member/properties/wallet_address'
                          },
                          wallet_type: {
                          $ref: '#/components/schemas/Member/properties/wallet_type'
                          }
                        }
                  },
                  examples:{
                    Member :{$ref: '#/components/examples/MemberCreateV2'}
                  }
                }
              }
          }
  #swagger.responses[200] = {
        description: 'Created Member',
  }
  #swagger.responses[405] = {
     description: 'Validation Exception',
  }
  #swagger.responses[409] = {
          "description": "Conflict",
  }
  */
  memberCtrl.createMemberV2
);

router.get(
  '/',
  /*  
    #swagger.auto = false
    #swagger.tags = ['Member']
    #swagger.summary = 'Get the list of member'
    #swagger.description = 'Fetch the members information'
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
                              items: {},
                              default: {$ref: '#/components/examples/Members/value'}
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

  memberCtrl.getAllMembers
);
router.get(
  '/:wallet_address',
  /*  
  #swagger.auto = false
  #swagger.tags = ['Member']
  #swagger.summary = 'Get the member info'
  #swagger.description = 'Fetch the member information'
  #swagger.parameters['wallet_address'] = {
    in: 'path',
    description: 'The address of the member',
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
                            default: {$ref: '#/components/examples/Member/value'}
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

  memberCtrl.getMember
);

router.get(
  '/:wallet_address/votes',
  /*  
    #swagger.auto = false
    #swagger.tags = ['Member']
    #swagger.summary = 'List votings by member'
    #swagger.parameters['wallet_address'] = {
      in: 'path',
      description: 'The address of the member',
      required: true,
      type: 'string'
    }
    #swagger.description = 'List of votings by wallet_address'
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
                   examples: {data : {$ref: '#/components/examples/MyVotings'} },
               }
           }
       }
    */
  memberCtrl.listVotesByMember
);

router.get(
  /*
    #swagger.auto = false
    #swagger.tags = ['Member']
    #swagger.summary = 'List of member bettings'
    #swagger.parameters['wallet_address'] = {
      in: 'path',
      description: 'The address of the member',
      required: true,
      type: 'string'
    }
    #swagger.description = 'List of member bettings'
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
  '/:wallet_address/bettings',
  memberCtrl.getMyBettings
);

router.put(
  '/:wallet_address',
  upload.single('avatar'),
  handleError,
  /*
  #swagger.auto = false
  #swagger.tags = ['Member']
  #swagger.summary = 'Modify member information'
  #swagger.parameters['wallet_address'] = {
    in: 'path',
    description: 'The address of the member',
    required: true,
    type: 'string'
  }
  #swagger.requestBody = {
  description: 'If send empty value, data will be removed',
   "@content": {
       "multipart/form-data": {
           schema: {
               type: "object",
               properties: {
                   avatar: {
                       type: "string",
                       format: 'binary',
                       description: 'Avatar image file'
                   },
                    name: {
                        type: 'string',
                        description: 'Member name'
                    },
                    email: {
                        type: 'string',
                        description: 'Member email address'
                    }
               },
           }
       }
    }
  }
  #swagger.responses[200] = {
            description: 'Ok',
  }
  #swagger.responses[404] = {
     description: 'Not Found',
  }
  #swagger.responses[405] = {
     description: 'Validation Exception',
  }
  */
  memberCtrl.updateMember
);
router.patch(
  '/:wallet_address/delegate',
  /*  
  #swagger.auto = false
  #swagger.tags = ['Member']
  #swagger.summary = 'Update the member delegate tx'
  #swagger.parameters['wallet_address'] = {
    in: 'path',
    description: 'The address of the member',
    required: true,
    type: 'string'
  }
  #swagger.description = 'After smart contract call, transaction hash update to our db'
      #swagger.requestBody = {
          required: true,
          "@content": {
              "application/json": {
                  schema: {
                      required: ['delegated_tx'],
                        properties: {
                          wallet_address: {
                              $ref: '#/components/schemas/Member/properties/member_delegated_tx'
                          },
                        }
                  },
                  examples:{
                    Member :{$ref: '#/components/examples/MemberUpdateDelegate'}
                }
                }
              }
          }
  #swagger.responses[200] = {
        description: 'Ok',
  }
  #swagger.responses[404] = {
     description: 'Not Found',
  }
  #swagger.responses[405] = {
     description: 'Validation Exception',
  }
  */
  memberCtrl.updateMemberDelegate
);

router.patch(
  '/role',
  adminAuth,
  /*  
#swagger.auto = false
#swagger.tags = ['Member']
#swagger.deprecated = true
#swagger.summary = 'Update the member role'
#swagger.description = 'Admin can update the role of a member'
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
#swagger.requestBody = {
    required: true,
    "@content": {
        "application/json": {
            schema: {
                type: 'object',
                required: ['wallet_address', 'role'],
                properties: {
                    wallet_address: {
                        type: 'string',
                        description: 'The wallet address of the member'
                    },
                    role: {
                        type: 'string',
                        enum: ['USER', 'ADMIN'],
                        description: 'The new role for the member'
                    }
                }
            },
            examples: {
                Member : {$ref: '#/components/examples/UpdateMemberRole'}
            }
        }
    }
}
#swagger.responses[200] = {
    description: 'Role updated successfully',
}
#swagger.responses[403] = {
    description: 'Unauthorized',
}
#swagger.responses[404] = {
    description: 'Not Found',
}
*/
  memberCtrl.updateMemberRole
);
router.patch(
  '/archive',
  adminAuth,
  /*  
#swagger.auto = false
#swagger.tags = ['Member']
#swagger.summary = 'Archive a member'
#swagger.description = 'Admin can archive a member by their wallet address. Requires admin authentication.'
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
#swagger.requestBody = {
    required: true,
    "@content": {
        "application/json": {
            schema: {
                type: 'object',
                required: ['wallet_address'],
                properties: {
                    wallet_address: {
                        type: 'string',
                        description: 'The wallet address of the member to be archived'
                    }
                }
            },
            examples: {
                Member :{$ref: '#/components/examples/MemberCreate'}
            }
        }
    }
}
#swagger.responses[200] = {
    description: 'Ok'
}
#swagger.responses[403] = {
    description: 'Unauthorized'
}
#swagger.responses[404] = {
    description: 'Not Found'
}
*/
  memberCtrl.archiveMember
);
router.patch(
  '/unarchive',
  adminAuth,
  /*  
#swagger.auto = false
#swagger.tags = ['Member']
#swagger.summary = 'Unarchive a member'
#swagger.description = 'Admin can unarchive a previously archived member by their wallet address. Requires admin authentication.'
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
#swagger.requestBody = {
    required: true,
    "@content": {
        "application/json": {
            schema: {
                type: 'object',
                required: ['wallet_address'],
                properties: {
                    wallet_address: {
                        type: 'string',
                        description: 'The wallet address of the member to be unarchived'
                    }
                }
            },
            examples: {
                Member: {$ref: '#/components/examples/MemberCreate'}
            }
        }
    }
}
#swagger.responses[200] = {
    description: 'Ok'
}
#swagger.responses[403] = {
    description: 'Unauthorized'
}
#swagger.responses[404] = {
    description: 'Not Found'
}
*/
  memberCtrl.unArchiveMember
);
router.patch(
  '/lock',
  adminAuth,
  /*  
#swagger.auto = false
#swagger.tags = ['Member']
#swagger.summary = 'Lock a member'
#swagger.description = 'Admin can lock a member by their wallet address. This involves a smart contract call and a database update. Requires admin authentication.'
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
#swagger.requestBody = {
    required: true,
    "@content": {
        "application/json": {
            schema: {
                type: 'object',
                required: ['wallet_address'],
                properties: {
                    wallet_address: {
                        type: 'string',
                        description: 'The wallet address of the member to be locked'
                    }
                }
            },
            examples: {
                Member: {$ref: '#/components/examples/MemberCreate'}
            }
        }
    }
}
#swagger.responses[200] = {
    description: 'Ok',
}
#swagger.responses[202] = {
    description: 'Transaction success but DB Update Failed',
}
#swagger.responses[400] = {
    description: 'ContractInteractionError'
}
#swagger.responses[403] = {
    description: 'Unauthorized'
}
#swagger.responses[404] = {
    description: 'Not Found'
}
#swagger.responses[405] = {
    description: 'Validation Exception',
}
*/
  memberCtrl.lockMember
);
router.patch(
  '/unlock',
  adminAuth,
  /*  
#swagger.auto = false
#swagger.tags = ['Member']
#swagger.summary = 'unLock a member'
#swagger.description = 'Admin can unlock a member by their wallet address. This involves a smart contract call and a database update. Requires admin authentication.'
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
#swagger.requestBody = {
    required: true,
    "@content": {
        "application/json": {
            schema: {
                type: 'object',
                required: ['wallet_address'],
                properties: {
                    wallet_address: {
                        type: 'string',
                        description: 'The wallet address of the member to be unlocked'
                    }
                }
            },
            examples: {
                Member: {$ref: '#/components/examples/MemberCreate'}
            }
        }
    }
}
#swagger.responses[200] = {
    description: 'Ok',
}
#swagger.responses[202] = {
    description: 'Transaction success but DB Update Failed',
}
#swagger.responses[400] = {
    description: 'ContractInteractionError'
}
#swagger.responses[403] = {
    description: 'Unauthorized'
}
#swagger.responses[404] = {
    description: 'Not Found'
}
#swagger.responses[405] = {
    description: 'Validation Exception',
}
*/
  memberCtrl.unLockMember
);

router.post(
  '/:wallet_address/daily-reward',
  memberAuth,
  /*  
#swagger.auto = false
#swagger.tags = ['Member']
#swagger.summary = 'Request daily reward'
#swagger.description = 'Member can require daily reward once a day(UTC).'
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
#swagger.parameters['wallet_address'] = {
      in: 'path',
      description: 'The address of the member',
      required: true,
      type: 'string'
}
#swagger.requestBody = {
    required: true,
    "@content": {
        "application/json": {
            schema: {
                type: 'object',
                required: ['claimed_at'],
                properties: {
                    claimed_at: {
                        type: 'string',
                        description: 'Format has to be YYYY-MM'
                    }
                }
            },
            examples: {
                DailyReward: {$ref: '#/components/examples/DailyRewardCreate'}
            }
        }
    }
}
#swagger.responses[200] = {
    description: 'Ok',
}
    */
  dailyRewardCtrl.createDailyReward
);

router.get(
  '/:wallet_address/daily-reward/claim',
  /*  
  #swagger.auto = false
  #swagger.tags = ['Member']
  #swagger.summary = 'Get reward by wallet address and claimed date'
  
  #swagger.parameters['wallet_address'] = {
        in: 'path',
        description: 'The address of the member',
        required: true,
        type: 'string'
      }
  #swagger.parameters['claimed_at'] = {
        in: 'query',
        description: 'The claimed datetime (ISO8601 format) UTC time',
        required: true,
        type: 'string',
        example: '2024-03-21T09:00:00Z'
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
                                    default: {$ref: '#/components/examples/DailyReward'}
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
  dailyRewardCtrl.getDailyReward
);

router.get(
  '/:wallet_address/daily-reward',
  /*  
#swagger.auto = false
#swagger.tags = ['Member']
#swagger.summary = 'Get List of reward history by wallet address '

#swagger.parameters['wallet_address'] = {
      in: 'path',
      description: 'The address of the member',
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
                                  default: {$ref: '#/components/examples/DailyRewards'}
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
  dailyRewardCtrl.listDailyReward
);

router.get(
    '/:wallet_address/referral',
    /*
    #swagger.auto=true
    #swagger.tags=['Member','NEW']
    #swagger.summary='Get referral code of user(wallet address)'
    #swagger.description='This API returns referral code of a given user. If you want to create a referral code a user, call this api and create a link like https://boom-play.com?referral_code=[The referral_code returned by this API]'
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
                                  default: {$ref: '#/components/examples/ReferralCode'}
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
        content: {
                  "application/json": {
                      schema: {
                          type: "object",
                          properties: {
                              success: {
                                  type: "integer",
                                  example: 0
                              },
                              data: {
                                  type: "null",
                                  example: null,
                              },
                              message: {
                                  type: "string",
                                  default: "Referral code of 'wallet_address'  not found"
                              },
                              error: {
                                  type: "string",
                                  default: "NotFoundException"
                              }
                          }
                      }
                  }
              }
    }
    */
    memberCtrl.getReferralCode
);

router.get(
    '/:wallet_address/creator-status',
    /*
    #swagger.auto=false
    #swagger.tags=['Member','NEW']
    #swagger.summary='Check if wallet is a creator'
    #swagger.description='Check if the given wallet address is in the creator list (managed via Google Sheet)'
    #swagger.parameters['wallet_address'] = {
      in: 'path',
      description: 'The wallet address to check',
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
              success: { type: "integer", example: 1 },
              data: {
                type: "object",
                properties: {
                  is_creator: { type: "boolean", example: true },
                  creator_info: {
                    type: "object",
                    properties: {
                      wallet_address: { type: "string" },
                      name: { type: "string" },
                      created_at: { type: "string" }
                    }
                  }
                }
              },
              message: { type: "string", default: "" },
              error: { type: "null", default: null }
            }
          }
        }
      }
    }
    */
    memberCtrl.getCreatorStatus
);

module.exports = router;
