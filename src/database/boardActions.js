const models = require('../models/mysql');
const { modules } = require("web3");
const Boards = models.boards;

const BoardActions = {
    /**
     * @param title title of the board
     * @param description detailed description of the board
     * @param image_url url of board image, if any. default: null
     * @param link external link of board, if any. default: null
     * @param isHot true if board is hot. default: false
     * @returns {Promise<*>}
     * @constructor
     */
    CreateBoard: async (title, description, image_url, link, isHot) => {
        let newBoard = {
            board_title: title,
            board_description: description,
            board_image_url: image_url,
            board_link: link,
            board_hot: isHot
        }
        let board = await Boards.create(newBoard);
        return board;
    },

    /**
     * @param board_id
     * @param data
     * @returns {Promise<void>}
     * @constructor
     */
    UpdateBoard: async (board_id, data) => {
        await Boards.update(data, { where: { board_id } });
    },

    /**
     * @param page
     * @param size
     * @returns {Promise<Model[]>}
     * @constructor
     */
    GetPagedBoards: async (page, size) => {
        let offset = (page >= 1) ? (page - 1) * size : 0;
        let pagedBoards = await Boards.findAll({
            where: { board_status: 1 },
            offset: offset,
            limit: size,
            order: [['board_created_at', 'DESC']]
        })
        return pagedBoards;
    },

    /**
     * @returns {Promise<Model[]>}
     * @constructor
     */
    GetHotBoards: async () => {
        let hotBoards = await Boards.findAll({
            where: { board_hot: true },
            order: [['board_order', 'ASC']]
        })
        return hotBoards;
    },
    /**
     * @param board_id
     * @returns {Promise<Model|null>}
     * @constructor
     */
    GetBoard: async (board_id) => {
        let board = await Boards.findOne({
            where: { board_id }
        })
        return board;
    }
}

module.exports = BoardActions;
