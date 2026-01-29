const client = require('../database/client');
const {err, success} = require("../utils/responses");
const {s3Upload} = require("../utils/upload/uploadToAws");
const Board = client.Board

module.exports = {
    addBoard: async (req, res) => {
        try {
            let {
                board_title,
                board_description,
            } = req.body;

            if (!board_title || !board_description) {
                return res.status(400).json(err({
                    name: 'ValidationError',
                    message: 'board_title and board_description are required'
                }))
            }

            let image_url = null;
            if(req.file) {
                const url = await s3Upload(req.file);
                if (url) {
                    image_url = url;
                }
            }
            let board = await Board.CreateBoard(
                board_title,
                board_description,
                image_url,
                null,
                false
            )
            res.status(200).json(success(board))
        } catch (e) {
            console.error('Error in addBoard:', e);
            res.status(400).json(err(e))
        }
    },
    getBoard: async (req, res) => {
        try {
            let board_id = req.params.board_id;
            const board = await Board.GetBoard(board_id);
            res.status(200).json(success(board));
        } catch (e) {
            res.status(400).json(err(e))
        }

    },
    getPagedBoards: async (req, res) => {
        try {
            let page = parseInt(req.query.page, 10) || 1;
            let pageSize = parseInt(req.query.size, 10) || 10;
            const boards = await Board.GetPagedBoards(page, pageSize);
            res.status(200).json(success(boards));
        } catch (e) {
            res.status(400).json(err(e));
        }
    },
    updateBoard: async (req, res) => {
        try {
            let board_id = req.params.board_id;
            let updateData = req.body;
            const updateResult = await Board.UpdateBoard(board_id, updateData);
            const board = await Board.GetBoard(board_id);
            res.status(200).json(success(board));
        } catch (e) {
            res.status(400).json(err(e));
        }
    },
    getHotBoard: async (req, res) => {
        try {
            const hotBoards = await Board.GetHotBoards();
            res.status(200).json(success(hotBoards));
        } catch (e) {
            res.status(400).json(err(e))
        }
    },
    deleteBoard: async (req, res) => {
        try {
            let board_id = req.params.board_id;
            const deletedBoard = await Board.UpdateBoard(board_id, {board_status: 0});
            const board = await Board.GetBoard(board_id);
            res.status(200).json(success(board));
        } catch (e) {
            res.status(400).json(err(e))
        }
    }
}