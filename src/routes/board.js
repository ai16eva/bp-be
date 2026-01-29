const express = require('express');
const router = express.Router({strict: true});
const boardController = require('../controllers/boardController');
const {adminAuth} = require("../middlewares/authWeb3");
const upload = require("../config/multer");
const handleError = require('../middlewares/multerError');

router.post(
    /*
    #swagger.auto=true
    #swagger.tags = ['Board', 'NEW']
    #swagger.summary='Add board'
    #swagger.description='Create board. I have removed admin authentication for testing purposes. In the production version, x-auth-message and x-auth-signature will be added so that only admin can upload boards'
    #swagger.security = [{
      "bearerAuth": []
    }]

    #swagger.requestBody = {
        "@content": {
               "multipart/form-data": {
                   schema: {
                       type: "object",
                       properties: {
                           board_title: {
                               type: "string",
                               description: "Title of the quest"
                           },
                           board_description: {
                            type: "string",
                            description: "Description of associated quest"
                           },
                           file: {
                               type: "string",
                               description: "Board Image/File",
                               format: "binary"
                           }
                       },
                       required: ["board_title", "board_description", 'file']
                   }
               }
           }
       }
     */
    '/add',
    upload.single('file'),
    handleError,
    // adminAuth,
    boardController.addBoard
)


router.get(
    /*
    #swagger.tags = ['Board']
     */
    '/all',
    boardController.getPagedBoards
)
router.get(
    /*
    #swagger.tags = ['Board']
     */
    '/hot',
    boardController.getHotBoard
)

router.get(
    /*
    #swagger.tags = ['Board']
     */
    '/:board_id',
    boardController.getBoard
)
router.put(
    /*
    #swagger.tags = ['Board']
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
     */
    '/:board_id',
    adminAuth,
    boardController.updateBoard
)

router.delete(
    /*
    #swagger.tags = ['Board']
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
     */
    '/:board_id',
    adminAuth,
    boardController.deleteBoard
)


module.exports = router;



