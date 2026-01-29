const models = require('../../models/mysql')
const { where, Op } = require('sequelize')
const Quest = models.quests
module.exports = {
    setQuestFinish: async (req, res)=>{
        
        const now = (new Date()).toISOString()

            const quests = await Quest.findAll({
                attributes:['quest_id'],
                where:{
                    quest_status: 'APPROVED',
                    quest_end_date: {
                        [Op.lt]: now
                    }
                }
            })
        
            if(quests){
                for (const quest of quests) {
                    await Quest.update(
                        {quest_status: 'FINISHED'},
                        {
                            where: {
                                quest_id: quest.quest_id
                            }
                        });
                }
            }
    }
}