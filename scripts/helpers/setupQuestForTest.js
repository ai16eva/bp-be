
const models = require('../../src/models/mysql');

/**
 * Ensure quest exists in database (for initial setup)
 * @param {string} questKeyStr - Quest key
 * @param {object} options - Quest data options
 * @returns {Promise<object>} Quest object
 */
async function ensureQuestExists(questKeyStr, options = {}) {
  try {
    let season = await models.seasons.findOne({ 
      where: { season_active: true }, 
      order: [['season_created_at', 'DESC']] 
    });
    
    if (!season) {
      season = await models.seasons.create({
        season_title: `Auto Season ${(new Date()).toISOString().slice(0, 10)}`,
        season_description: 'Auto for api test',
        service_fee: 0,
        charity_fee: 0,
        creator_fee: 0,
        season_min_pay: 0,
        season_max_pay: 1000000,
        season_active: true,
        season_start_date: new Date(Date.now() - 3600 * 1000),
        season_end_date: new Date(Date.now() + 7 * 24 * 3600 * 1000),
      });
    }
    
    let category = await models.quest_categories.findOne({ 
      order: [['quest_category_created_at', 'DESC']] 
    });
    
    if (!category) {
      category = await models.quest_categories.create({ 
        quest_category_title: 'Auto Category', 
        quest_category_order: 1 
      });
    }
    
    const exist = await models.quests.findOne({ 
      where: { quest_key: questKeyStr } 
    });
    
    if (!exist) {
      const now = new Date();
      const quest = await models.quests.create({
        quest_key: questKeyStr,
        quest_title: options.quest_title || `Test Quest ${questKeyStr}`,
        quest_description: options.quest_description || 'Auto quest for api test',
        season_id: season.season_id,
        quest_category_id: category.quest_category_id,
        quest_creator: options.quest_creator || process.env.SOLANA_MASTER_WALLET_DEV,
        quest_betting_token: options.quest_betting_token || 'BOOM',
        quest_image_url: options.quest_image_url || 'https://example.com/auto.png',
        quest_image_link: options.quest_image_link || 'https://example.com/auto',
        quest_start_date: options.quest_start_date || now,
        quest_end_date: options.quest_end_date || new Date(now.getTime() + 3600 * 1000),
        quest_start_date_utc: options.quest_start_date_utc || now,
        quest_end_date_utc: options.quest_end_date_utc || new Date(now.getTime() + 3600 * 1000),
        quest_status: options.quest_status || 'DRAFT',
      });
      
      console.log('  ✓ DB quest created for key:', questKeyStr);
      return quest;
    } else {
      // Update quest_creator if it's missing or if provided in options
      const updateData = {};
      if (!exist.quest_creator || options.quest_creator) {
        updateData.quest_creator = options.quest_creator || exist.quest_creator || process.env.SOLANA_MASTER_WALLET_DEV;
      }
      if (options.quest_title && exist.quest_title !== options.quest_title) {
        updateData.quest_title = options.quest_title;
      }
      if (options.quest_status && exist.quest_status !== options.quest_status) {
        updateData.quest_status = options.quest_status;
      }
      
      if (Object.keys(updateData).length > 0) {
        await exist.update(updateData);
        console.log('  ✓ DB quest updated for key:', questKeyStr, 'fields:', Object.keys(updateData));
        await exist.reload();
      } else {
      console.log('  ✓ DB quest already exists for key:', questKeyStr);
      }
      return exist;
    }
  } catch (e) {
    console.warn('  Setup quest warn:', e.message);
    throw e;
  }
}

/**
 * Ensure answers exist for quest
 * @param {string} questKeyStr - Quest key
 * @param {number} [count=3] - Number of answers to create
 * @returns {Promise<Array>} Answers array
 */
async function ensureAnswersExist(questKeyStr, count = 3) {
  try {
    const existing = await models.answers.findAll({ 
      where: { quest_key: questKeyStr } 
    });
    
    if (existing.length < count) {
      const base = Number.parseInt(questKeyStr, 10) * 10;
      const rows = [];
      for (let i = 0; i < count - existing.length; i++) {
        rows.push({
          quest_key: questKeyStr,
          answer_key: base + existing.length + i + 1,
          answer_title: `Answer ${existing.length + i + 1} ${questKeyStr}`,
        });
      }
      await models.answers.bulkCreate(rows, { ignoreDuplicates: true });
      console.log(`  ✓ Seeded ${rows.length} answers for quest: ${questKeyStr}`);
    }
    
    const final = await models.answers.findAll({ where: { quest_key: questKeyStr } });
    return final;
  } catch (e) {
    console.warn('  Ensure answers warn:', e.message);
    return [];
  }
}

/**
 * Setup quest to DRAFT status via API
 * @param {function} callApi - API call function
 * @param {string} questKeyStr - Quest key
 * @param {object} questOptions - Quest data options
 * @returns {Promise<void>}
 */
async function setupQuestToDraft(callApi, questKeyStr, questOptions = {}) {
  await ensureQuestExists(questKeyStr, { quest_status: 'DRAFT', ...questOptions });
  await ensureAnswersExist(questKeyStr);
  await callApi('patch', `/quest-dao/${questKeyStr}/draft/set`, undefined, 'setup-draft');
}

/**
 * Setup quest to PUBLISH status via API
 * @param {function} callApi - API call function
 * @param {string} questKeyStr - Quest key
 * @param {object} questOptions - Quest data options
 * @returns {Promise<void>}
 */
async function setupQuestToPublish(callApi, questKeyStr, questOptions = {}) {
  await setupQuestToDraft(callApi, questKeyStr, questOptions);
  await callApi('patch', `/quest-dao/${questKeyStr}/publish`, undefined, 'setup-publish');
  await new Promise(r => setTimeout(r, 2000));
}

/**
 * Setup quest to FINISH status via API (requires voting first)
 * @param {function} callApi - API call function
 * @param {object} gov - Governance SDK
 * @param {Connection} connection - Solana connection
 * @param {string} questKeyStr - Quest key
 * @param {object} voters - Voters array from setupVoters
 * @param {object} questOptions - Quest data options
 * @returns {Promise<void>}
 */
async function setupQuestToFinish(callApi, gov, connection, questKeyStr, voters, questOptions = {}) {
  const { BN } = require('@coral-xyz/anchor');
  const questKeyBN = new BN(questKeyStr);
  
  await setupQuestToPublish(callApi, questKeyStr, questOptions);
  
  for (const voter of voters.slice(0, 2)) {
    const voteTx = await gov.voteQuest(questKeyBN, 1, voter.keypair.publicKey, voter.nftAccount);
    const { blockhash } = await connection.getLatestBlockhash('confirmed');
    voteTx.feePayer = voter.keypair.publicKey;
    voteTx.recentBlockhash = blockhash;
    voteTx.partialSign(voter.keypair);
    const sig = await connection.sendRawTransaction(voteTx.serialize(), { skipPreflight: true, maxRetries: 2 });
    await connection.confirmTransaction(sig, 'finalized');
    await new Promise(r => setTimeout(r, 1000));
  }
  
  await callApi('patch', `/quest-dao/${questKeyStr}/draft-end`, undefined, 'setup-draft-end');
  await new Promise(r => setTimeout(r, 12000));
  await callApi('patch', `/quest-dao/${questKeyStr}/draft/make`, undefined, 'setup-draft-make');
  await callApi('patch', `/quest-dao/${questKeyStr}/finish`, undefined, 'setup-finish');
}

module.exports = {
  ensureQuestExists,
  ensureAnswersExist,
  setupQuestToDraft,
  setupQuestToPublish,
  setupQuestToFinish
};

