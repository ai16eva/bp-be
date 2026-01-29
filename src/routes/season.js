const express = require('express');
const router = express.Router({ strict: true });
const seasonCtrl = require('../controllers/seasonController');
const { adminAuth } = require('../middlewares/authWeb3');

router.post(
  '/',
  adminAuth,
  /*  #swagger.auto = false
      #swagger.tags = ['Season']
      #swagger.summary = 'Create a new season for a quest'
      #swagger.description = 'Creates a new season for the project'
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
                      required: ['title', 'description', 'start_date', 'end_date', 'min_pay', 'max_pay', 'service_fee', 'charity_fee', 'creator_fee'],
                      properties: {
                          title: {
                              type: 'string',
                              description: 'Title of the season'
                          },
                          description: {
                              type: 'string',
                              description: 'Description of the season'
                          },
                          start_date: {
                              type: 'string',
                              format: 'date-time',
                              description: 'Start date of the season'
                          },
                          end_date: {
                              type: 'string',
                              format: 'date-time',
                              description: 'End date of the season'
                          },
                          min_pay: {
                              type: 'number',
                              description: 'Minimum payment for the season'
                          },
                          max_pay: {
                              type: 'number',
                              description: 'Maximum payment for the season'
                          },
                          service_fee: {
                              type: 'number',
                              description: 'Service fee for the season'
                          },
                          charity_fee: {
                              type: 'number',
                              description: 'Charity fee for the season'
                          },
                          creator_fee: {
                              type: 'number',
                              description: 'Creator fee for the season'
                          }
                      }
                  },
                  examples: {
                      Season:{$ref: '#/components/examples/SeasonCreate'}
                  }
              }
          }
      }
    #swagger.responses[200] = {
            description: 'Created',
    }
    #swagger.responses[405] = {
        description: 'Validation Exception',
    }
*/
  seasonCtrl.createSeason
);

router.get(
  '/',
  /*  #swagger.auto = false
        #swagger.tags = ['Season']
        #swagger.summary = 'List of season with quest count by category'

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
                        examples: {data : {$ref: '#/components/examples/SeasonList'} },
                    }
                }
            }
  */
  seasonCtrl.listSeasonWithQuestCount
);

router.get(
  '/active',
  /*  #swagger.auto = false
        #swagger.tags = ['Season']
        #swagger.summary = 'Get details of the active season'
        #swagger.description = 'Retrieves the details of the currently active season'
      #swagger.responses[200] = {
          description: 'Successful operation - Active season found',
          content: {
              "application/json": {
                  schema: {
                      type: 'object',
                      properties: {
                          success: {
                              type: 'boolean',
                              example: true
                          },
                          data: {
                              type: 'object',
                              properties: {
                                id: {
                                    type: 'string',
                                    example: '123e4567-e89b-12d3-a456-426614174000'
                                },
                                title: {
                                    type: 'string',
                                    example: 'Summer 2023'
                                },
                                description: {
                                    type: 'string',
                                    example: 'Exciting quests for summer 2023'
                                },
                                startDate: {
                                    type: 'string',
                                    format: 'date-time',
                                    example: '2023-06-01T00:00:00Z'
                                },
                                endDate: {
                                    type: 'string',
                                    format: 'date-time',
                                    example: '2023-08-31T23:59:59Z'
                                },
                                minPay: {
                                    type: 'number',
                                    example: 100
                                },
                                maxPay: {
                                    type: 'number',
                                    example: 1000
                                },
                                serviceFee: {
                                    type: 'number',
                                    example: 5
                                },
                                charityFee: {
                                    type: 'number',
                                    example: 2
                                },
                                creatorFee: {
                                    type: 'number',
                                    example: 1
                                },
                                active: {
                                    type: 'boolean',
                                    example: true
                                }
                              }
                          }
                      }
                  }
              }
          }
      }
      #swagger.responses[202] = {
          description: 'Successful operation - Multiple active seasons',
          content: {
              "application/json": {
                  schema: {
                      type: 'object',
                      properties: {
                          success: {
                              type: 'number',
                              example: 1
                          },
                          data: {
                              type: 'null',
                              example: null
                          },
                          message: {
                              type: 'string',
                              example: 'Active season is multiple'
                          }
                      }
                  }
              }
          }
      }
      #swagger.responses[400] = {
         description: 'Bad Request',
      }
  */
  seasonCtrl.getActiveSeason
);

router.get(
  '/:season_id',
  /*  #swagger.auto = false
      #swagger.tags = ['Season']
      #swagger.summary = 'Get details of a specific season'
      #swagger.description = 'Retrieves the details of a specific season by its ID'
      #swagger.parameters['season_id'] = {
          in: 'path',
          description: 'ID of the season to retrieve',
          required: true,
          type: 'string'
      }
    #swagger.responses[200] = {
        description: 'Successful operation',
        content: {
            "application/json": {
                schema: {
                    type: 'object',
                    properties: {
                        id: {
                            type: 'string',
                            example: '123e4567-e89b-12d3-a456-426614174000'
                        },
                        title: {
                            type: 'string',
                            example: 'Summer 2023'
                        },
                        description: {
                            type: 'string',
                            example: 'Exciting quests for summer 2023'
                        },
                        startDate: {
                            type: 'string',
                            format: 'date-time',
                            example: '2023-06-01T00:00:00Z'
                        },
                        endDate: {
                            type: 'string',
                            format: 'date-time',
                            example: '2023-08-31T23:59:59Z'
                        },
                        minPay: {
                            type: 'number',
                            example: 100
                        },
                        maxPay: {
                            type: 'number',
                            example: 1000
                        },
                        serviceFee: {
                            type: 'number',
                            example: 5
                        },
                        charityFee: {
                            type: 'number',
                            example: 2
                        },
                        creatorFee: {
                            type: 'number',
                            example: 1
                        },
                        active: {
                            type: 'boolean',
                            example: true
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
  seasonCtrl.getSeason
);

router.patch(
  '/:season_id',
  adminAuth,
  /*  #swagger.auto = false
      #swagger.tags = ['Season']
      #swagger.summary = 'Update an existing season'
      #swagger.description = 'Updates an existing season with the provided data. All fields are optional.'
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
      #swagger.parameters['season_id'] = {
          in: 'path',
          description: 'ID of the season to update',
          required: true,
          type: 'string'
      }

      #swagger.requestBody = {
          required: true,
          "@content": {
              "application/json": {
                  schema: {
                      type: 'object',
                      properties: {
                          title: {
                              type: 'string',
                              description: 'Updated title of the season'
                          },
                          description: {
                              type: 'string',
                              description: 'Updated description of the season'
                          },
                          start_date: {
                              type: 'string',
                              format: 'date-time',
                              description: 'Updated start date of the season'
                          },
                          end_date: {
                              type: 'string',
                              format: 'date-time',
                              description: 'Updated end date of the season'
                          },
                          min_pay: {
                              type: 'number',
                              description: 'Updated minimum payment for the season'
                          },
                          max_pay: {
                              type: 'number',
                              description: 'Updated maximum payment for the season'
                          },
                          service_fee: {
                              type: 'number',
                              description: 'Updated service fee for the season'
                          },
                          charity_fee: {
                              type: 'number',
                              description: 'Updated charity fee for the season'
                          },
                          creator_fee: {
                              type: 'number',
                              description: 'Updated creator fee for the season'
                          }
                      }
                  },
                  examples: {
                    Season:{$ref: '#/components/examples/SeasonCreate'}
                  }
              }
          }
      }
    #swagger.responses[200] = {
        description: 'Season updated successfully',
    }
    #swagger.responses[400] = {
       description: 'Bad Request',
    }
    #swagger.responses[404] = {
       description: 'Not Found'
    }
    #swagger.responses[405] = {
        description: 'Validation Exception',
    }
*/
  seasonCtrl.updateSeason
);

router.patch(
  '/:season_id/active',
  adminAuth,
  /*  #swagger.auto = false
      #swagger.tags = ['Season']
      #swagger.summary = 'Toggle active status of a season'
      #swagger.description = 'Toggles the active status of a specific season. If it was active, it becomes inactive and vice versa.'
      #swagger.security = [{
         "bearerAuth": []
      }]
      #swagger.parameters['season_id'] = {
          in: 'path',
          description: 'ID of the season to update',
          required: true,
          type: 'string'
      }
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
    }
    #swagger.responses[400] = {
       description: 'Bad Request',
    }
    #swagger.responses[404] = {
       description: 'Not Found',
    }
*/
  seasonCtrl.updateSeasonActive
);

router.patch(
  '/:season_id/archive',
  adminAuth,
  /*  #swagger.auto = false
      #swagger.tags = ['Season']
      #swagger.summary = 'Archive the season'
      #swagger.description = 'If admin want to hide season from public'
      #swagger.security = [{
         "bearerAuth": []
      }]
      #swagger.parameters['season_id'] = {
          in: 'path',
          description: 'ID of the season to update',
          required: true,
          type: 'string'
      }
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
    }
    #swagger.responses[400] = {
       description: 'Bad Request',
    }
    #swagger.responses[404] = {
       description: 'Not Found',
    }
*/
  seasonCtrl.archiveSeason
);
router.patch(
  '/:season_id/unarchive',
  adminAuth,
  /*  #swagger.auto = false
      #swagger.tags = ['Season']
      #swagger.summary = 'Unarachive the season'
      #swagger.description = 'If admin want to show the hide season in public'
      #swagger.security = [{
         "bearerAuth": []
      }]
      #swagger.parameters['season_id'] = {
          in: 'path',
          description: 'ID of the season to update',
          required: true,
          type: 'string'
      }
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
    }
    #swagger.responses[400] = {
       description: 'Bad Request',
    }
    #swagger.responses[404] = {
       description: 'Not Found',
    }
*/
  seasonCtrl.unarchiveSeason
);

module.exports = router;
