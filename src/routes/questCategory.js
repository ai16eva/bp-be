const express = require('express');
const router = express.Router({ strict: true });
const categoryCtrl = require('../controllers/questCategoryController');
const { adminAuth } = require('../middlewares/authWeb3');

router.post(
  '/',
  adminAuth,
  /*  #swagger.auto = false
      #swagger.tags = ['Quest-category']
      #swagger.summary = 'Create a new category for quests'
      #swagger.description = 'Creates a new category for quests in the project'
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
                      required: ['title'],
                      properties: {
                          title: {
                              type: 'string',
                              description: 'Title of the category'
                          },
                          order: {
                              type: 'integer',
                              description: 'Order of the category (optional)'
                          }
                      }
                  },
                  examples: {
                    Category : {$ref: '#/components/examples/QuestCategory'}
                  }
              }
          }
      }
    #swagger.responses[200] = {
        description: 'Category created successfully',
    }
    #swagger.responses[400] = {
       description: 'Bad Request',
    }
    #swagger.responses[405] = {
        description: 'Validation Exception',
    }
*/
  categoryCtrl.createCategory
);
router.get(
  '/',
  /*  #swagger.auto = false
      #swagger.tags = ['Quest-category']
      #swagger.summary = 'List all categories'
      #swagger.description = 'Retrieves a list of all quest categories'
    #swagger.parameters['include_archived'] = {
            in: 'query',
            description: 'condition for fetching all categories or unArchived categories',
            required: false,
            type:  'bool',
      }
    #swagger.responses[200] = {
        description: 'Successful operation',
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
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    id: {
                                        type: 'string',
                                        description: 'Unique identifier for the category',
                                        example: '123e4567-e89b-12d3-a456-426614174000'
                                    },
                                    title: {
                                        type: 'string',
                                        description: 'Title of the category',
                                        example: 'Adventure'
                                    },
                                    order: {
                                        type: 'integer',
                                        description: 'Order of the category',
                                        example: 1
                                    },
                                    createdAt: {
                                        type: 'string',
                                        format: 'date-time',
                                        description: 'Creation date and time of the category',
                                        example: '2023-06-01T00:00:00Z'
                                    },
                                    archivedAt: {
                                        type: 'string',
                                        format: 'date-time',
                                        description: 'Archival date and time of the category, if archived',
                                        example: null
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
*/
  categoryCtrl.listCategory
);
router.get(
  '/:quest_category_id',
  /*  #swagger.auto = false
      #swagger.deprecated = true
      #swagger.tags = ['Quest-category']
      #swagger.summary = 'Get the category'
      #swagger.description = 'Retrieves a single category'
*/
  categoryCtrl.getCategory
);

router.patch(
  '/:quest_category_id',
  adminAuth,
  /*  #swagger.auto = false
      #swagger.tags = ['Quest-category']
      #swagger.summary = 'Update a specific category'
      #swagger.description = 'Updates the details of a specific quest category'
      #swagger.security = [{
         "bearerAuth": []
      }]
      #swagger.parameters['quest_category_id'] = {
          in: 'path',
          description: 'ID of the category to update',
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
      #swagger.requestBody = {
          required: true,
          "@content": {
              "application/json": {
                  schema: {
                      type: 'object',
                      properties: {
                          title: {
                              type: 'string',
                              description: 'New title for the category'
                          },
                          order: {
                              type: 'integer',
                              description: 'New order for the category'
                          }
                      }
                  },
                  examples: {
                      Category: {
                          order: 2
                      }
                  }
              }
          }
      }
    #swagger.responses[200] = {
        description: 'Category updated successfully',
    }
    #swagger.responses[400] = {
       description: 'Bad Request',
    }
    #swagger.responses[404] = {
       description: 'Not Found',
    }
*/
  categoryCtrl.updateCategory
);
router.patch(
  '/:quest_category_id/archive',
  adminAuth,
  /*  #swagger.auto = false
      #swagger.tags = ['Quest-category']
      #swagger.summary = 'Archive a specific category'
      #swagger.description = 'Archives a specific quest category. This operation marks the category as archived, typically hiding it from active use.'
      #swagger.security = [{
         "bearerAuth": []
      }]
      #swagger.parameters['quest_category_id'] = {
          in: 'path',
          description: 'ID of the category to archive',
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
    #swagger.responses[404] = {
       description: 'Not Found',
    }
*/
  categoryCtrl.archiveCategory
);
router.patch(
  '/:quest_category_id/unarchive',
  adminAuth,
  /*  #swagger.auto = false
      #swagger.tags = ['Quest-category']
      #swagger.summary = 'unArchive a specific category'
      #swagger.description = 'unArchives a specific quest category.'
      #swagger.security = [{
         "bearerAuth": []
      }]
      #swagger.parameters['quest_category_id'] = {
          in: 'path',
          description: 'ID of the category to archive',
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
    #swagger.responses[404] = {
       description: 'Not Found',
    }
*/
  categoryCtrl.unarchiveCategory
);

module.exports = router;
