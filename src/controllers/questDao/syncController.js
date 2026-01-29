const { err, success } = require('../../utils/responses');
const client = require('../../database/client');
const { getGovernanceSDK } = require('../../config/solana');
const { convertToBN } = require('../../utils/solanaHelpers');
const { handleSolanaError } = require('../../utils/solanaErrorHandler');

const syncController = {
  syncStatus: async (req, res) => {
    const { quest_key } = req.params;
    try {
      const governanceSDK = getGovernanceSDK();
      const questKeyBN = convertToBN(quest_key);

      const currentQuest = await client.QuestDao.getQuestWithSeason(quest_key);
      const currentStatus = currentQuest?.quest_status;
      const force = req.query.force === '1';

      let item;
      try {
        if (typeof governanceSDK.fetchGovernanceItem === 'function') {
          item = await governanceSDK.fetchGovernanceItem(questKeyBN);
        } else if (typeof governanceSDK.getGovernanceItem === 'function') {
          item = await governanceSDK.getGovernanceItem(questKeyBN);
        }
      } catch (_) {}

      try {
        const questVote = await governanceSDK.fetchQuestVote(questKeyBN);
        if (questVote) {
          const onChainApprove = questVote.countApprover?.toNumber?.() || questVote.count_approver || 0;
          const onChainReject = questVote.countRejector?.toNumber?.() || questVote.count_rejector || 0;
          const onChainTotal = questVote.totalVoted?.toNumber?.() || questVote.total_voted || 0;

          try {
            const bs58 = require('bs58');
            const questKeyLE = questKeyBN.toArrayLike(Buffer, 'le', 8);
            const memcmp = { offset: 8, bytes: bs58.encode(questKeyLE) };
            const voterAccounts = await governanceSDK.program.account.questVoterRecord.all([{ memcmp }]);

            let syncedCount = 0;
            for (const acc of voterAccounts) {
              try {
                const voterAddress = acc.account.voter?.toBase58?.() || acc.account.voter?.toString?.();
                if (!voterAddress) continue;

                const voteCount = acc.account.voteCount ?? acc.account.vote_count ?? 1;
                const choice = acc.account.voteChoice ?? acc.account.vote_choice;
                
                let option = null;
                if (typeof choice === 'number') {
                  option = choice === 1 ? 'APPROVE' : 'REJECT';
                } else if (choice?.approve !== undefined) {
                  option = 'APPROVE';
                } else if (choice?.reject !== undefined) {
                  option = 'REJECT';
                }

                if (!option) continue;

                const existingVote = await client.Vote.Get(quest_key, voterAddress);
                if (!existingVote) {
                  await client.Vote.Create(quest_key, {
                    voter: voterAddress,
                    power: Number(voteCount) || 1,
                    option,
                    tx: 'synced-from-onchain',
                  });
                  syncedCount++;
                }
              } catch (voterErr) {
                console.warn(`[syncStatus] Failed to sync voter record:`, voterErr.message);
              }
            }

            if (syncedCount > 0) {
              console.log(`[syncStatus] Synced ${syncedCount} draft votes from on-chain to DB for quest ${quest_key}`);
            }
          } catch (_) {}
        }
      } catch (_) {}

      if (currentStatus === 'DAO_SUCCESS') {
        try {
          const decisionVote = await governanceSDK.fetchDecisionVote(questKeyBN);
          if (decisionVote) {
            const onChainSuccess = decisionVote.countSuccess?.toNumber?.() || decisionVote.count_success || 0;
            const onChainAdjourn = decisionVote.countAdjourn?.toNumber?.() || decisionVote.count_adjourn || 0;

            try {
              const bs58 = require('bs58');
              const questKeyLE = questKeyBN.toArrayLike(Buffer, 'le', 8);
              const memcmp = { offset: 8, bytes: bs58.encode(questKeyLE) };
              
              // try camelCase first, fallback to PascalCase
              let decisionVoterAccounts = [];
              try {
                decisionVoterAccounts = await governanceSDK.program.account.decisionVoterRecord.all([{ memcmp }]);
              } catch (e1) {
                try {
                  decisionVoterAccounts = await governanceSDK.program.account.DecisionVoterRecord.all([{ memcmp }]);
                } catch (e2) {
                  console.warn(`[syncStatus] Could not fetch decisionVoterRecord: ${e1.message}, ${e2.message}`);
                }
              }

              let syncedDecisionCount = 0;
              const invalidDecisionVoters = [];
              
              for (const acc of decisionVoterAccounts) {
                try {
                  const voterAddress = acc.account.voter?.toBase58?.() || acc.account.voter?.toString?.();
                  const voteCount = acc.account.voteCount ?? acc.account.vote_count ?? 1;
                  const choice = acc.account.voteChoice ?? acc.account.vote_choice;
                  
                  // map decision choice: 1 = SUCCESS, 2 = ADJOURN
                  let option = null;
                  if (typeof choice === 'number') {
                    option = choice === 1 ? 'SUCCESS' : (choice === 2 ? 'ADJOURN' : null);
                  } else if (choice?.success !== undefined) {
                    option = 'SUCCESS';
                  } else if (choice?.adjourn !== undefined) {
                    option = 'ADJOURN';
                  }

                  if (voterAddress && option) {
                    const existingVote = await client.Vote.Get(quest_key, voterAddress);
                    if (!existingVote || !existingVote.vote_draft_option) {
                      invalidDecisionVoters.push(voterAddress);
                      continue;
                    }

                    if (!existingVote.vote_success_option) {
                      await client.Vote.UpdateSuccess(quest_key, voterAddress, {
                        option,
                        tx: 'synced-from-onchain',
                      });
                      syncedDecisionCount++;
                    }
                  }
                } catch (voterErr) {
                  console.warn(`[syncStatus] Failed to sync decision voter record:`, voterErr.message);
                }
              }

              if (syncedDecisionCount > 0) {
                console.log(`[syncStatus] Synced ${syncedDecisionCount} decision votes from on-chain to DB for quest ${quest_key}`);
              } else if (onChainSuccess > 0 || onChainAdjourn > 0) {
                console.warn(`[syncStatus] On-chain has ${onChainSuccess} SUCCESS and ${onChainAdjourn} ADJOURN votes but no voter records found or all already synced`);
              }

              if (invalidDecisionVoters.length > 0) {
                throw new Error(`Không thể sync decision vote: ${invalidDecisionVoters.length} voter chưa vote draft trước (phải vote vòng draft trước)`);
              }
            } catch (decisionSyncErr) {
              console.warn(`[syncStatus] Failed to sync decision votes:`, decisionSyncErr.message);
            }
        }
      } catch (_) {}
      }

      if (currentStatus === 'DAO_SUCCESS') {
        try {
          const [answerVotePDA] = governanceSDK.getAnswerVotePDA(questKeyBN);
          const answerVote = await governanceSDK.program.account.answerVote.fetch(answerVotePDA).catch(() => null);
          
          if (answerVote) {
            try {
              const bs58 = require('bs58');
              const questKeyLE = questKeyBN.toArrayLike(Buffer, 'le', 8);
              const memcmp = { offset: 8, bytes: bs58.encode(questKeyLE) };
              
              // try camelCase first, fallback to PascalCase
              let answerVoterAccounts = [];
              try {
                answerVoterAccounts = await governanceSDK.program.account.answerVoterRecord.all([{ memcmp }]);
              } catch (e1) {
                try {
                  answerVoterAccounts = await governanceSDK.program.account.AnswerVoterRecord.all([{ memcmp }]);
                } catch (e2) {
                  console.warn(`[syncStatus] Could not fetch answerVoterRecord: ${e1.message}, ${e2.message}`);
                }
              }

              let syncedAnswerCount = 0;
              const invalidAnswerVoters = [];
              
              for (const acc of answerVoterAccounts) {
                try {
                  const voterAddress = acc.account.voter?.toBase58?.() || acc.account.voter?.toString?.();
                  const answerKey = acc.account.answerKey?.toNumber?.() || acc.account.answer_key?.toNumber?.() || null;
                  
                  if (voterAddress && answerKey) {
                    const existingVote = await client.Vote.Get(quest_key, voterAddress);
                    if (!existingVote || !existingVote.vote_success_option) {
                      invalidAnswerVoters.push(voterAddress);
                      continue;
                    }

                    if (!existingVote.quest_answer_key) {
                      await client.Vote.UpdateAnswer(quest_key, voterAddress, {
                        answer_key: answerKey,
                        tx: 'synced-from-onchain',
                      });
                      syncedAnswerCount++;
                    }
                  }
                } catch (voterErr) {
                  console.warn(`[syncStatus] Failed to sync answer voter record:`, voterErr.message);
                }
              }

              if (syncedAnswerCount > 0) {
                console.log(`[syncStatus] Synced ${syncedAnswerCount} answer votes from on-chain to DB for quest ${quest_key}`);
              }

              if (invalidAnswerVoters.length > 0) {
                console.warn(`[syncStatus] ${invalidAnswerVoters.length} voters cannot sync answer vote (must vote decision first)`);
              }
            } catch (answerSyncErr) {
              console.warn(`[syncStatus] Failed to sync answer votes:`, answerSyncErr.message);
            }
          }
        } catch (_) {}
      }

      if (item || force) {
        try {
          await client.QuestDao.UpdateData(quest_key, { quest_pending: false });
        } catch (_) {}
        return res.status(200).json(success('', 'Synced'));
      }

      return res.status(200).json(success('', 'No on-chain item'));
    } catch (e) {
      const errorInfo = handleSolanaError(e);
      const errorMessage = errorInfo.message || e.message;
      const code = e?.statusCode || 400;
      return res.status(code).json(err(errorMessage));
    }
  },
};

module.exports = syncController;

