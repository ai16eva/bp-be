
const models = require('../models/mysql');
const Checkin = models.checkins
const NotFound = require("../exceptions/NotFoundException");
const DuplicateException = require("../exceptions/DuplicateException");
const moment = require("moment");
const {Sequelize, Op} = require("sequelize");
const client = require("./client");
class CheckinActions  {
    constructor() {}
    /**
     *
     * @param wallet_address
     * @returns {Promise<void>}
     */
    createCheckin = async (wallet_address) => {
        const checkin = await this.getCheckinOrNull(wallet_address);
        if (checkin) {
            throw new DuplicateException('Checkin')
        }
        await Checkin.create({
            wallet_address,
            last_checkin_date: moment().toDate(),
            checkin_streak: 1,
            checkin_total: 1,
            checkin_created_at: moment().toDate()
        })
        return checkin;

    }
    /**
     *
     * @param wallet_address
     * @returns {Promise<Model|null>}
     */
    getCheckin = async (wallet_address) => {
        const checkin = await Checkin.findOne({where: { wallet_address }})
        if (!checkin) {
            throw new NotFound('Checkin')
        }
        return checkin
    }
    /**
     *
     * @param wallet_address
     * @returns {Promise<Model|null>}
     */
    getCheckinOrNull = async (wallet_address) => {
        const checkin = await Checkin.findOne({
            where: Sequelize.where(
                Sequelize.fn('LOWER', Sequelize.col('wallet_address')),
                Sequelize.fn('LOWER', wallet_address),
            )
        })
        return checkin
    }
    /**
     *
     * @param wallet_address
     * @returns {Promise<Model|null>}
     */
    updateLastCheck = async (wallet_address) => {
        const checkin = await this.getCheckin(wallet_address);
        const today = moment().startOf('day')
        const lastCheckinDate = moment(checkin.last_checkin_date).startOf('day')
        // 1. If last_checkin_date is today, return AlreadyCheckedIn exception
        if (today.isSame(lastCheckinDate, 'day')) {
            throw new Error('Already Checked In'); // Custom exception (assuming you defined it)
        }

        // 2. If last_checkin_date is yesterday (one day ago), increment streak and total
        if (today.diff(lastCheckinDate, 'day') === 1) {
            await Checkin.update(
                {
                   checkin_streak: checkin.checkin_streak + 1,
                   checkin_total: checkin.checkin_total + 1,
                   last_checkin_date: moment().toDate(),
                },
                {
                    where: Sequelize.where(
                        Sequelize.fn('LOWER', Sequelize.col('wallet_address')),
                        Sequelize.fn('LOWER', wallet_address),
                    )
                }
            )
        }
        // 3. If last_checkin_date is 2 or more days ago, reset checkin_streak to 1
        else if (today.diff(lastCheckinDate, 'day') > 1) {
            await Checkin.update(
                {
                    checkin_streak: 1,
                    checkin_total: checkin.checkin_total + 1,
                    last_checkin_date: moment().toDate(),
                },
                {
                    where: Sequelize.where(
                        Sequelize.fn('LOWER', Sequelize.col('wallet_address')),
                        Sequelize.fn('LOWER', wallet_address),
                    )
                }
            )
        }
        const newCheckin = await this.getCheckin(wallet_address);
        return newCheckin
    }
    deleteCheckin = async (wallet_address) => {
        await this.getCheckin(wallet_address);
        await Checkin.destroy({
            where: Sequelize.where(
                Sequelize.fn('LOWER', Sequelize.col('wallet_address')),
                Sequelize.fn('LOWER', wallet_address),
            )
        })
    }
    resetCheckinStreak = async (wallet_address) => {
        await this.getCheckin(wallet_address);
        await Checkin.update(
            {
                checkin_streak: 0,
            },
            {
                where: Sequelize.where(
                    Sequelize.fn('LOWER', Sequelize.col('wallet_address')),
                    Sequelize.fn('LOWER', wallet_address),
                )
            }
        )
    }
    resetCheckinTotal = async (wallet_address) => {
        await this.getCheckin(wallet_address);
        await Checkin.update(
            {
                checkin_total: 0,
            },
            {
                where: Sequelize.where(
                    Sequelize.fn('LOWER', Sequelize.col('wallet_address')),
                    Sequelize.fn('LOWER', wallet_address),
                )
            }
        )
    }

    getCheckins = async (count = 5) => {
        let checkins = await Checkin.findAll({
            where: {
                checkin_streak: {
                    [Op.gte]: count
                }
            }
        })
        return checkins
    }
}

module.exports = CheckinActions;