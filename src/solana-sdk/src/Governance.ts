import * as anchor from '@coral-xyz/anchor';
import { BN, IdlAccounts } from '@coral-xyz/anchor';
import {
  PublicKey,
  SystemProgram,
  SYSVAR_CLOCK_PUBKEY,
  SYSVAR_RENT_PUBKEY,
  Transaction,
  Keypair,
  ComputeBudgetProgram,
} from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  unpackAccount,
} from '@solana/spl-token';
import { BoomplayGovernance as GovernanceProgram } from './utils/types/boomplay_governance';
import IDL from './utils/idl/boomplay_governance.json';

export type GovernanceConfig =
  IdlAccounts<GovernanceProgram>['governanceConfig'];
export type Governance = IdlAccounts<GovernanceProgram>['governance'];
export type GovernanceItem = IdlAccounts<GovernanceProgram>['governanceItem'];
export type QuestVote = IdlAccounts<GovernanceProgram>['questVote'];
export type Proposal = IdlAccounts<GovernanceProgram>['proposal'];

// Proposal Result enum
export enum ProposalResult {
  Pending = 'pending',
  Yes = 'yes',
  No = 'no',
}

export class GovernanceSDK {
  public idl = Object.assign({}, IDL as GovernanceProgram);

  // PDA seeds
  private readonly CONFIG_SEED = 'governance_config';
  private readonly GOVERNANCE_SEED = 'governance';
  private readonly GOVERNANCE_ITEM_SEED = 'governance_item';
  private readonly QUEST_VOTE_SEED = 'quest_vote';
  private readonly PROPOSAL_SEED = 'proposal';
  private readonly TREASURY_SEED = 'treasury';
  private readonly TREASURY_TOKEN_ACCOUNT_SEED = 'token_account';

  constructor(public readonly connection: anchor.web3.Connection) { }

  get program(): anchor.Program<GovernanceProgram> {
    return new anchor.Program(this.idl, {
      connection: this.connection,
    }) as anchor.Program<GovernanceProgram>;
  }
  // PDA derivation functions
  getConfigPDA(): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from(this.CONFIG_SEED)],
      this.program.programId
    );
  }

  getGovernancePDA(): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('governance')],
      this.program.programId
    );
  }

  getGovernanceItemPDA(questKey: BN): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('governance_item'), questKey.toArrayLike(Buffer, 'le', 8)],
      this.program.programId
    );
  }

  getTreasuryPDA(): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from(this.TREASURY_SEED)],
      this.program.programId
    );
  }

  getTreasuryTokenAccountPDA(): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [
        Buffer.from(this.TREASURY_SEED),
        Buffer.from(this.TREASURY_TOKEN_ACCOUNT_SEED),
      ],
      this.program.programId
    );
  }

  getQuestVotePDA(questKey: BN): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('quest_vote'), questKey.toArrayLike(Buffer, 'le', 8)],
      this.program.programId
    );
  }

  getProposalPDA(proposalKey: BN): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from(this.PROPOSAL_SEED), proposalKey.toArrayLike(Buffer, 'le', 8)],
      this.program.programId
    );
  }

  getQuestVoterPDA(questKey: BN, voter: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [
        Buffer.from('quest_voter'),
        questKey.toArrayLike(Buffer, 'le', 8),
        voter.toBuffer()
      ],
      this.program.programId
    );
  }

  /**
   * Creates a new governance item (quest/proposal)
   * Requires the creator to own minimum NFTs from the governance collection
   * @param questKey - Unique identifier for the quest
   * @param question - The question/proposal text (max 280 characters)
   * @param creatorNftAccount - Creator's NFT token account(s) for validation (can be single PublicKey or array)
   * @param creator - The creator's public key
   * @returns Transaction
   */
  async createGovernanceItem(
    questKey: BN,
    question: string,
    creatorNftAccount: PublicKey | PublicKey[],
    creator: PublicKey
  ): Promise<Transaction> {
    const [governanceItemPDA] = this.getGovernanceItemPDA(questKey);
    const [governancePDA] = this.getGovernancePDA();
    const [configPDA] = this.getConfigPDA();
    const [questVotePDA] = this.getQuestVotePDA(questKey);

    const nftTokenAccounts = Array.isArray(creatorNftAccount) ? creatorNftAccount : [creatorNftAccount];
    const remainingAccounts: Array<{ pubkey: PublicKey; isWritable: boolean; isSigner: boolean }> = [];

    for (const tokenAccount of nftTokenAccounts) {
      remainingAccounts.push({
        pubkey: tokenAccount,
        isWritable: false,
        isSigner: false,
      });

      try {
        const accountInfo = await this.connection.getAccountInfo(tokenAccount, 'confirmed');
        if (!accountInfo) {
          throw new Error(`Token account ${tokenAccount.toBase58()} not found`);
        }

        if (!accountInfo.owner.equals(TOKEN_PROGRAM_ID)) {
          throw new Error(`Account ${tokenAccount.toBase58()} is not a token account (owner: ${accountInfo.owner.toBase58()})`);
        }

        if (accountInfo.data.length === 0) {
          throw new Error(`Token account ${tokenAccount.toBase58()} is closed`);
        }

        const tokenAccountData = unpackAccount(tokenAccount, accountInfo);
        const nftMint = tokenAccountData.mint;
        const [metadataPDA] = this.getMetadataAccountPDA(nftMint);

        remainingAccounts.push({
          pubkey: metadataPDA,
          isWritable: false,
          isSigner: false,
        });
      } catch (error: any) {
        throw new Error(`Failed to get metadata account for token account ${tokenAccount.toBase58()}: ${error?.message || String(error)}`);
      }
    }

    return await this.program.methods
      .createGovernanceItem(questKey, question)
      .accountsPartial({
        config: configPDA,
        governance: governancePDA,
        governanceItem: governanceItemPDA,
        questVote: questVotePDA,
        creator: creator,
        systemProgram: SystemProgram.programId,
        clock: SYSVAR_CLOCK_PUBKEY,
      })
      .remainingAccounts(remainingAccounts)
      .transaction();
  }

  /**
   * Fetches a governance item by quest key
   * @param questKey - The quest key to fetch
   * @returns The governance item account data
   */
  async fetchGovernanceItem(questKey: BN) {
    const [governanceItemPDA] = this.getGovernanceItemPDA(questKey);
    try {
      return await this.program.account.governanceItem.fetch(governanceItemPDA);
    } catch (error) {
      console.error(
        `Failed to fetch governance item for quest key ${questKey.toString()}:`,
        error
      );
      return null;
    }
  }

  /**
   * Fetches the governance config account
   * @returns The governance config account data
   */
  async fetchConfig() {
    const [configPDA] = this.getConfigPDA();
    try {
      return await this.program.account.governanceConfig.fetch(configPDA);
    } catch (error) {
      console.error('Failed to fetch governance config:', error);
      return null;
    }
  }

  /**
   * Fetches voter checkpoints account
   * @param voter - The voter's public key
   * @returns The voter checkpoints account data
   */
  async fetchVoterCheckpoints(voter: PublicKey) {
    const [voterCheckpointsPDA] = this.getVoterCheckpointsPDA(voter);
    try {
      return await this.program.account.voterCheckpoints.fetch(voterCheckpointsPDA);
    } catch (error) {
      console.error(`Failed to fetch voter checkpoints for ${voter.toBase58()}:`, error);
      return null;
    }
  }

  /**
   * Fetches decision vote account
   * @param questKey - The quest key
   * @returns The decision vote account data
   */
  async fetchDecisionVote(questKey: BN) {
    const [decisionVotePDA] = this.getDecisionVotePDA(questKey);
    try {
      return await this.program.account.decisionVote.fetch(decisionVotePDA);
    } catch (error) {
      console.error(`Failed to fetch decision vote for quest ${questKey.toString()}:`, error);
      return null;
    }
  }

  /**
   * Fetches the main governance account
   * @returns The governance account data
   */
  async fetchGovernance() {
    const [governancePDA] = this.getGovernancePDA();
    try {
      return await this.program.account.governance.fetch(governancePDA);
    } catch (error) {
      console.error('Failed to fetch governance:', error);
      return null;
    }
  }

  /**
   * Fetches quest vote data
   * @param questKey - The quest key
   * @returns The quest vote account data
   */
  async fetchQuestVote(questKey: BN) {
    const [questVotePDA] = this.getQuestVotePDA(questKey);
    try {
      return await this.program.account.questVote.fetch(questVotePDA);
    } catch (error) {
      console.error(
        `Failed to fetch quest vote for quest key ${questKey.toString()}:`,
        error
      );
      return null;
    }
  }

  /**
   * Fetches proposal data
   * @param proposalKey - The proposal key
   * @returns The proposal account data
   */
  async fetchProposal(proposalKey: BN) {
    const [proposalPDA] = this.getProposalPDA(proposalKey);
    try {
      return await this.program.account.proposal.fetch(proposalPDA);
    } catch (error) {
      console.error(
        `Failed to fetch proposal for key ${proposalKey.toString()}:`,
        error
      );
      return null;
    }
  }

  /**
   * Initialize governance config (admin only)
   * @param minTotalVote - Minimum total votes required
   * @param maxTotalVote - Maximum total votes allowed
   * @param minRequiredNft - Minimum NFTs required to participate
   * @param maxVotableNft - Maximum NFTs allowed for voting
   * @param durationHours - Duration of voting in hours
   * @param constantRewardToken - Constant reward token amount
   * @param baseTokenMint - Base token mint address
   * @param baseNftCollection - NFT collection address
   * @param authority - Authority public key
   * @returns Transaction
   */
  async initialize(
    minTotalVote: BN,
    maxTotalVote: BN,
    minRequiredNft: number,
    maxVotableNft: number,
    durationHours: BN,
    constantRewardToken: BN,
    baseTokenMint: PublicKey,
    baseNftCollection: PublicKey,
    authority: PublicKey
  ): Promise<Transaction> {
    const [configPDA] = this.getConfigPDA();
    const [governancePDA] = this.getGovernancePDA();
    const [treasuryPda] = this.getTreasuryPDA();
    const [treasuryTokenAccount] = this.getTreasuryTokenAccountPDA();
    const initializeIx = await this.program.methods
      .initialize(
        minTotalVote,
        maxTotalVote,
        minRequiredNft,
        maxVotableNft,
        durationHours,
        constantRewardToken
      )
      .accountsPartial({
        authority: authority,
        config: configPDA,
        governance: governancePDA,
        baseTokenMint: baseTokenMint,
        baseNftCollection: baseNftCollection,
        treasuryPda,
        treasuryTokenAccount,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .instruction();

    const tx = new Transaction();
    tx.add(initializeIx);
    return tx;
  }

  /**
   * Creates a new proposal
   * @param proposalKey - Unique identifier for the proposal
   * @param title - The proposal title (max 200 characters)
   * @param creator - The creator's public key
   * @returns Transaction
   */
  async createProposal(
    proposalKey: BN,
    title: string,
    creator: PublicKey
  ): Promise<Transaction> {
    const [proposalPDA] = this.getProposalPDA(proposalKey);
    const [governancePDA] = this.getGovernancePDA();
    const [configPDA] = this.getConfigPDA();

    return await this.program.methods
      .createProposal(proposalKey, title)
      .accountsPartial({
        config: configPDA,
        governance: governancePDA,
        proposal: proposalPDA,
        creator: creator,
        systemProgram: SystemProgram.programId,
        clock: SYSVAR_CLOCK_PUBKEY,
      })
      .transaction();
  }

  /**
   * Vote on a quest/governance item
   * @param questKey - The quest key to vote on
   * @param voteChoice - The vote choice (0 = Against, 1 = For, 2 = Abstain)
   * @param voter - The voter's public key
   * @param voterNftAccount - The voter's NFT token account
   * @returns Transaction
   */
  async voteQuest(
    questKey: BN,
    voteChoice: number,
    voter: PublicKey,
    voterNftAccount: PublicKey
  ): Promise<Transaction> {
    const [governanceItemPDA] = this.getGovernanceItemPDA(questKey);
    const [questVotePDA] = this.getQuestVotePDA(questKey);
    const [questVoterPDA] = this.getQuestVoterPDA(questKey, voter);
    const [configPDA] = this.getConfigPDA();
    const [voterCheckpointsPDA] = this.getVoterCheckpointsPDA(voter);

    const voteArg = voteChoice === 1 ? { approve: {} } : { reject: {} };

    return await this.program.methods
      .voteQuest(questKey, voteArg as any)
      .accountsPartial({
        config: configPDA,
        governanceItem: governanceItemPDA,
        questVote: questVotePDA,
        voterRecord: questVoterPDA,
        voter: voter,
        voterCheckpoints: voterCheckpointsPDA, // PATCHED: passed correctly according to contract
        systemProgram: SystemProgram.programId,
        clock: SYSVAR_CLOCK_PUBKEY,
      })
      .remainingAccounts([
        { pubkey: voterNftAccount, isWritable: false, isSigner: false }
      ])
      .transaction();
  }

  /**
   * Set the result of a quest (admin only)
   * @param questKey - The quest key
   * @param authority - The authority's public key
   * @returns Transaction
   */
  async setQuestResult(
    questKey: BN,
    authority: PublicKey
  ): Promise<Transaction> {
    const [governanceItemPDA] = this.getGovernanceItemPDA(questKey);
    const [questVotePDA] = this.getQuestVotePDA(questKey);
    const [configPDA] = this.getConfigPDA();

    return await this.program.methods
      .setQuestResult(questKey)
      .accountsPartial({
        config: configPDA,
        governanceItem: governanceItemPDA,
        questVote: questVotePDA,
        authority: authority,
      })
      .transaction();
  }

  /**
   * Make quest result approved when votes are equal (admin only)
   * @param questKey - The quest key
   * @param authority - The authority's public key
   * @returns Transaction
   */
  async makeQuestResult(
    questKey: BN,
    authority: PublicKey
  ): Promise<Transaction> {
    const [governanceItemPDA] = this.getGovernanceItemPDA(questKey);
    const [questVotePDA] = this.getQuestVotePDA(questKey);
    const [configPDA] = this.getConfigPDA();

    return await this.program.methods
      .makeQuestResult(questKey)
      .accountsPartial({
        config: configPDA,
        governanceItem: governanceItemPDA,
        questVote: questVotePDA,
        authority: authority,
      })
      .transaction();
  }

  /**
   * Pause the governance system (admin only)
   * @param pause - true to pause, false to unpause
   * @param authority - The authority's public key
   * @returns Transaction
   */
  async pauseGovernance(
    pause: boolean,
    authority: PublicKey
  ): Promise<Transaction> {
    return await this.program.methods
      .pause(pause)
      .accountsPartial({
        authority: authority,
      })
      .transaction();
  }

  /**
   * Set minimum required NFTs for participation
   * @param minNfts - Minimum number of NFTs required
   * @param authority - The authority's public key
   * @returns Transaction
   */
  async setMinimumNfts(
    minNfts: number,
    authority: PublicKey
  ): Promise<Transaction> {
    return await this.program.methods
      .setMinimumRequiredNfts(minNfts)
      .accountsPartial({
        authority: authority,
      })
      .transaction();
  }

  /**
   * Set maximum votes per voter
   * @param maxVotes - Maximum votes allowed per voter
   * @param authority - The authority's public key
   * @returns Transaction
   */
  async setMaxVotesPerVoter(
    maxVotes: number,
    authority: PublicKey
  ): Promise<Transaction> {
    return await this.program.methods
      .setMaxVotesPerVoter(maxVotes)
      .accountsPartial({
        authority: authority,
      })
      .transaction();
  }

  /**
   * Set quest duration in hours
   * @param durationHours - Duration in hours
   * @param authority - The authority's public key
   * @returns Transaction
   */
  async setQuestDurationHours(
    durationHours: BN,
    authority: PublicKey
  ): Promise<Transaction> {
    return await this.program.methods
      .setQuestDurationHours(durationHours)
      .accountsPartial({
        authority: authority,
      })
      .transaction();
  }

  /**
   * Set reward amount
   * @param rewardAmount - Reward amount in tokens
   * @param authority - The authority's public key
   * @returns Transaction
   */
  async setRewardAmount(
    rewardAmount: BN,
    authority: PublicKey
  ): Promise<Transaction> {
    return await this.program.methods
      .setRewardAmount(rewardAmount)
      .accountsPartial({
        authority: authority,
      })
      .transaction();
  }



  /**
   * Set minimum and maximum total votes
   * @param minTotalVote - Minimum total votes required
   * @param maxTotalVote - Maximum total votes allowed
   * @param authority - The authority's public key
   * @returns Transaction
   */
  async setTotalVote(
    minTotalVote: BN,
    maxTotalVote: BN,
    authority: PublicKey
  ): Promise<Transaction> {
    // The setTotalVote instruction takes a string ("min" or "max") and a value
    // We'll need to make two separate calls
    const tx1 = await this.program.methods
      .setTotalVote("min", minTotalVote)
      .accountsPartial({
        authority: authority,
      })
      .transaction();

    const tx2 = await this.program.methods
      .setTotalVote("max", maxTotalVote)
      .accountsPartial({
        authority: authority,
      })
      .transaction();

    // Combine transactions
    tx1.add(tx2);
    return tx1;
  }

  /**
   * Cancel a quest (admin only)
   * @param questKey - The quest key
   * @param authority - The authority's public key
   * @returns Transaction
   */
  async cancelQuest(
    questKey: BN,
    authority: PublicKey
  ): Promise<Transaction> {
    const [governanceItemPDA] = this.getGovernanceItemPDA(questKey);
    const [questVotePDA] = this.getQuestVotePDA(questKey);
    const [configPDA] = this.getConfigPDA();

    return await this.program.methods
      .cancelQuest(questKey)
      .accountsPartial({
        config: configPDA,
        governanceItem: governanceItemPDA,
        questVote: questVotePDA,
        authority: authority,
      })
      .transaction();
  }

  /**
   * Set the result of a proposal (admin only)
   * @param proposalKey - The proposal key
   * @param result - The result (yes/no)
   * @param resultVote - Number of votes for this result
   * @param authority - The authority's public key
   * @returns Transaction
   */
  async setProposalResult(
    proposalKey: BN,
    result: 'yes' | 'no',
    resultVote: number,
    authority: PublicKey
  ): Promise<Transaction> {
    const [proposalPDA] = this.getProposalPDA(proposalKey);
    const [configPDA] = this.getConfigPDA();
    const [governancePDA] = this.getGovernancePDA();

    const resultArg = result === 'yes' ? { yes: {} } : { no: {} };

    return await this.program.methods
      .setProposalResult(proposalKey, resultArg as any, resultVote)
      .accountsPartial({
        config: configPDA,
        governance: governancePDA,
        proposal: proposalPDA,
        authority: authority,
        clock: SYSVAR_CLOCK_PUBKEY,
      })
      .transaction();
  }

  // Decision Phase PDAs
  getDecisionVotePDA(questKey: BN): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('decision_vote'), questKey.toArrayLike(Buffer, 'le', 8)],
      this.program.programId
    );
  }

  getDecisionVoterPDA(questKey: BN, voter: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [
        Buffer.from('decision_voter'),
        questKey.toArrayLike(Buffer, 'le', 8),
        voter.toBuffer()
      ],
      this.program.programId
    );
  }

  /**
   * Start decision phase for a quest
   * @param questKey - The quest key
   * @param authority - The authority's public key
   * @returns Transaction
   */
  async startDecision(
    questKey: BN,
    authority: PublicKey
  ): Promise<Transaction> {
    const [governanceItemPDA] = this.getGovernanceItemPDA(questKey);
    const [decisionVotePDA] = this.getDecisionVotePDA(questKey);
    const [configPDA] = this.getConfigPDA();

    return await this.program.methods
      .startDecision(questKey)
      .accountsPartial({
        config: configPDA,
        governanceItem: governanceItemPDA,
        decisionVote: decisionVotePDA,
        authority: authority,
        systemProgram: SystemProgram.programId,
        clock: SYSVAR_CLOCK_PUBKEY,
      })
      .transaction();
  }

  /**
   * Vote in decision phase
   * @param questKey - The quest key
   * @param voteChoice - The vote choice (success or adjourn)
   * @param voter - The voter's public key
   * @returns Transaction
   */
  async voteDecision(
    questKey: BN,
    voteChoice: 'success' | 'adjourn',
    voter: PublicKey
  ): Promise<Transaction> {
    const [governanceItemPDA] = this.getGovernanceItemPDA(questKey);
    const [decisionVotePDA] = this.getDecisionVotePDA(questKey);
    const [decisionVoterPDA] = this.getDecisionVoterPDA(questKey, voter);
    const [questVoterPDA] = this.getQuestVoterPDA(questKey, voter);
    const [configPDA] = this.getConfigPDA();

    const voteArg = voteChoice === 'success' ? { success: {} } : { adjourn: {} };

    return await this.program.methods
      .voteDecision(questKey, voteArg as any)
      .accountsPartial({
        config: configPDA,
        governanceItem: governanceItemPDA,
        decisionVote: decisionVotePDA,
        voterRecord: decisionVoterPDA,
        questVoterRecord: questVoterPDA,
        voter: voter,
        systemProgram: SystemProgram.programId,
        clock: SYSVAR_CLOCK_PUBKEY,
      })
      .transaction();
  }

  /**
   * Cancel decision phase
   * @param questKey - The quest key
   * @param authority - The authority's public key
   * @returns Transaction
   */
  async cancelDecision(
    questKey: BN,
    authority: PublicKey
  ): Promise<Transaction> {
    const [governanceItemPDA] = this.getGovernanceItemPDA(questKey);
    const [decisionVotePDA] = this.getDecisionVotePDA(questKey);
    const [configPDA] = this.getConfigPDA();

    return await this.program.methods
      .cancelDecision(questKey)
      .accountsPartial({
        config: configPDA,
        governanceItem: governanceItemPDA,
        decisionVote: decisionVotePDA,
        authority: authority,
      })
      .transaction();
  }

  /**
   * Set decision result and execute answer phase (admin only)
   * @param questKey - The quest key
   * @param answerKeys - Array of answer keys for the answer phase
   * @param authority - The authority's public key
   * @returns Transaction
   */
  async setDecisionAndExecuteAnswer(
    questKey: BN,
    answerKeys: BN[],
    authority: PublicKey
  ): Promise<Transaction> {
    const [governanceItemPDA] = this.getGovernanceItemPDA(questKey);
    const [decisionVotePDA] = this.getDecisionVotePDA(questKey);
    const [answerVotePDA] = this.getAnswerVotePDA(questKey);
    const [configPDA] = this.getConfigPDA();

    return await this.program.methods
      .setDecisionAndExecuteAnswer(questKey, answerKeys)
      .accountsPartial({
        config: configPDA,
        governanceItem: governanceItemPDA,
        decisionVote: decisionVotePDA,
        answerVote: answerVotePDA,
        authority: authority,
      })
      .transaction();
  }

  /**
   * Make decision result approved when votes are equal and execute answer phase (admin only)
   * @param questKey - The quest key
   * @param answerKeys - Array of answer keys for the answer phase
   * @param authority - The authority's public key
   * @returns Transaction
   */
  async makeDecisionAndExecuteAnswer(
    questKey: BN,
    answerKeys: BN[],
    authority: PublicKey
  ): Promise<Transaction> {
    const [governanceItemPDA] = this.getGovernanceItemPDA(questKey);
    const [decisionVotePDA] = this.getDecisionVotePDA(questKey);
    const [answerVotePDA] = this.getAnswerVotePDA(questKey);
    const [configPDA] = this.getConfigPDA();

    return await this.program.methods
      .makeDecisionAndExecuteAnswer(questKey, answerKeys)
      .accountsPartial({
        config: configPDA,
        governanceItem: governanceItemPDA,
        decisionVote: decisionVotePDA,
        answerVote: answerVotePDA,
        authority: authority,
      })
      .transaction();
  }

  // NFT Collection PDAs
  getCollectionMintPDA(): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('collection-mint')],
      this.program.programId
    );
  }

  getCollectionAuthorityPDA(): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('collection-authority')],
      this.program.programId
    );
  }

  // NFT Minting PDAs and methods
  getNftAuthorityPDA(): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('nft-authority')],
      this.program.programId
    );
  }



  /**
   * Get the Metaplex Token Metadata program ID
   */
  getMetaplexProgramId(): PublicKey {
    return new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');
  }

  /**
   * Get metadata account PDA for an NFT mint
   */
  getMetadataAccountPDA(mint: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [
        Buffer.from('metadata'),
        this.getMetaplexProgramId().toBuffer(),
        mint.toBuffer(),
      ],
      this.getMetaplexProgramId()
    );
  }

  /**
   * Get master edition account PDA for an NFT mint
   */
  getMasterEditionPDA(mint: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [
        Buffer.from('metadata'),
        this.getMetaplexProgramId().toBuffer(),
        mint.toBuffer(),
        Buffer.from('edition'),
      ],
      this.getMetaplexProgramId()
    );
  }

  /**
   * Create the governance NFT collection
   * @param name - Collection name (max 32 characters)
   * @param symbol - Collection symbol (max 10 characters)
   * @param uri - Collection metadata URI (max 200 characters)
   * @param authority - The authority's public key
   * @returns Transaction
   */
  async createCollection(
    name: string,
    symbol: string,
    uri: string,
    authority: PublicKey
  ): Promise<Transaction> {
    const [configPDA] = this.getConfigPDA();
    const [governancePDA] = this.getGovernancePDA();
    const [collectionMintPDA] = this.getCollectionMintPDA();
    const [collectionAuthorityPDA] = this.getCollectionAuthorityPDA();

    // Get collection token account
    const collectionTokenAccount = await getAssociatedTokenAddress(
      collectionMintPDA,
      collectionAuthorityPDA,
      true // allowOwnerOffCurve
    );

    // Get metadata PDAs
    const [collectionMetadataPDA] = this.getMetadataAccountPDA(collectionMintPDA);
    const [collectionMasterEditionPDA] = this.getMasterEditionPDA(collectionMintPDA);

    const instruction = await this.program.methods
      .createCollection(name, symbol, uri)
      .accountsPartial({
        config: configPDA,
        governance: governancePDA,
        collectionMint: collectionMintPDA,
        collectionAuthority: collectionAuthorityPDA,
        collectionTokenAccount: collectionTokenAccount,
        collectionMetadata: collectionMetadataPDA,
        collectionMasterEdition: collectionMasterEditionPDA,
        authority: authority,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        metadataProgram: this.getMetaplexProgramId(),
        rent: SYSVAR_RENT_PUBKEY,
      })
      .instruction();

    const transaction = new Transaction();
    transaction.add(
      ComputeBudgetProgram.setComputeUnitLimit({ units: 400000 })
    );
    transaction.add(instruction);

    return transaction;
  }

  /**
   * Updates an existing governance collection metadata
   * @param name - New collection name
   * @param symbol - New collection symbol
   * @param uri - New collection metadata URI
   * @param authority - The authority's public key
   * @returns Transaction
   */
  async updateCollection(
    name: string,
    symbol: string,
    uri: string,
    authority: PublicKey
  ): Promise<Transaction> {
    const [configPDA] = this.getConfigPDA();
    const [governancePDA] = this.getGovernancePDA();
    const [collectionMintPDA] = this.getCollectionMintPDA();
    const [collectionAuthorityPDA] = this.getCollectionAuthorityPDA();
    const [collectionMetadataPDA] = this.getMetadataAccountPDA(collectionMintPDA);

    return await this.program.methods
      .updateCollection(name, symbol, uri)
      .accountsPartial({
        config: configPDA,
        governance: governancePDA,
        collectionMint: collectionMintPDA,
        collectionAuthority: collectionAuthorityPDA,
        collectionMetadata: collectionMetadataPDA,
        authority: authority,
        metadataProgram: this.getMetaplexProgramId(),
      })
      .transaction();
  }

  /**
   * Mint a governance NFT directly to a receiver (Authority only)
   * @param name - NFT name (max 32 characters)
   * @param symbol - NFT symbol (max 10 characters)
   * @param uri - NFT metadata URI (max 200 characters)
   * @param receiver - The public key of the user receiving the NFT
   * @param authority - The authority's public key (must be signer)
   * @returns Transaction and the NFT mint keypair
   */
  async mintGovernanceNft(
    name: string,
    symbol: string,
    uri: string,
    receiver: PublicKey,
    authority: PublicKey
  ): Promise<{ transaction: Transaction; nftMint: Keypair }> {
    const [configPDA] = this.getConfigPDA();
    const [governancePDA] = this.getGovernancePDA();
    const [nftAuthorityPDA] = this.getNftAuthorityPDA();


    // Generate a new mint keypair
    const nftMint = Keypair.generate();

    // Get associated token address for the RECEIVER
    const receiverNftAccount = await getAssociatedTokenAddress(
      nftMint.publicKey,
      receiver
    );

    // Get metadata PDAs
    const [metadataAccountPDA] = this.getMetadataAccountPDA(nftMint.publicKey);
    const [masterEditionPDA] = this.getMasterEditionPDA(nftMint.publicKey);

    // Get collection PDAs
    const [collectionMintPDA] = this.getCollectionMintPDA();
    const [collectionAuthorityPDA] = this.getCollectionAuthorityPDA();
    const [collectionMetadataPDA] = this.getMetadataAccountPDA(collectionMintPDA);
    const [collectionMasterEditionPDA] = this.getMasterEditionPDA(collectionMintPDA);

    const instruction = await this.program.methods
      .mintGovernanceNft(name, symbol, uri)
      .accountsPartial({
        config: configPDA,
        governance: governancePDA,
        nftMint: nftMint.publicKey,
        nftAuthority: nftAuthorityPDA,
        receiverNftAccount: receiverNftAccount, // Updated account name
        metadataAccount: metadataAccountPDA,
        masterEdition: masterEditionPDA,
        collectionMint: collectionMintPDA,
        collectionMetadata: collectionMetadataPDA,
        collectionMasterEdition: collectionMasterEditionPDA,
        collectionAuthority: collectionAuthorityPDA,
        authority: authority,
        receiver: receiver,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        metadataProgram: this.getMetaplexProgramId(),
        rent: SYSVAR_RENT_PUBKEY,
      })
      .instruction();

    const transaction = new Transaction();
    transaction.add(
      ComputeBudgetProgram.setComputeUnitLimit({ units: 400000 })
    );

    // Add the mint instruction
    transaction.add(instruction);

    return { transaction, nftMint };
  }


  /**
   * Check if a user can create governance items
   * @param user - The user's public key
   * @returns Boolean indicating if user has minimum NFTs required
   */
  async canCreateGovernanceItem(_user: PublicKey): Promise<boolean> {
    try {
      const config = await this.fetchConfig();
      if (!config) {
        return false;
      }
      // Since UserProfile is removed, we'll need a different way to check NFT ownership
      // For now, returning true as the check will be done on-chain
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Set quest end time (admin only)
   * @param questKey - The quest key
   * @param newEndTime - The new end time timestamp
   * @param authority - The authority's public key
   * @returns Transaction
   */
  async setQuestEndTime(
    questKey: BN,
    newEndTime: BN,
    authority: PublicKey
  ): Promise<Transaction> {
    const [configPDA] = this.getConfigPDA();
    const [governanceItemPDA] = this.getGovernanceItemPDA(questKey);

    return await this.program.methods
      .setQuestEndTime(questKey, newEndTime)
      .accountsPartial({
        config: configPDA,
        governanceItem: governanceItemPDA,
        authority: authority,
        clock: SYSVAR_CLOCK_PUBKEY,
      })
      .transaction();
  }

  /**
   * Set decision end time (admin only)
   * @param questKey - The quest key
   * @param newEndTime - The new end time timestamp
   * @param authority - The authority's public key
   * @returns Transaction
   */
  async setDecisionEndTime(
    questKey: BN,
    newEndTime: BN,
    authority: PublicKey
  ): Promise<Transaction> {
    const [configPDA] = this.getConfigPDA();
    const [governanceItemPDA] = this.getGovernanceItemPDA(questKey);

    return await this.program.methods
      .setDecisionEndTime(questKey, newEndTime)
      .accountsPartial({
        config: configPDA,
        governanceItem: governanceItemPDA,
        authority: authority,
        clock: SYSVAR_CLOCK_PUBKEY,
      })
      .transaction();
  }

  /**
   * Set answer end time (admin only)
   * @param questKey - The quest key
   * @param newEndTime - The new end time timestamp
   * @param authority - The authority's public key
   * @returns Transaction
   */
  async setAnswerEndTime(
    questKey: BN,
    newEndTime: BN,
    authority: PublicKey
  ): Promise<Transaction> {
    const [configPDA] = this.getConfigPDA();
    const [governanceItemPDA] = this.getGovernanceItemPDA(questKey);
    const [answerVotePDA] = this.getAnswerVotePDA(questKey);

    return await this.program.methods
      .setAnswerEndTime(questKey, newEndTime)
      .accountsPartial({
        config: configPDA,
        governanceItem: governanceItemPDA,
        answerVote: answerVotePDA,
        authority: authority,
        clock: SYSVAR_CLOCK_PUBKEY,
      })
      .transaction();
  }

  /**
   * Get answer vote PDA
   */
  getAnswerVotePDA(questKey: BN): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('answer_vote'), questKey.toArrayLike(Buffer, 'le', 8)],
      this.program.programId
    );
  }

  /**
   * Get answer voter record PDA
   */
  getAnswerVoterPDA(questKey: BN, voter: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [
        Buffer.from('answer_voter'),
        questKey.toArrayLike(Buffer, 'le', 8),
        voter.toBuffer()
      ],
      this.program.programId
    );
  }

  /**
   * Get voter checkpoints PDA
   */
  getVoterCheckpointsPDA(voter: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [
        Buffer.from('voter_checkpoints'),
        voter.toBuffer()
      ],
      this.program.programId
    );
  }

  /**
   * Update voter checkpoint with current NFT holdings
   * @param voter - The voter's public key
   * @param nftTokenAccounts - Array of NFT token accounts owned by the voter
   * @returns Transaction
   */
  async updateVoterCheckpoint(
    voter: PublicKey,
    nftTokenAccounts: PublicKey[] = []
  ): Promise<Transaction> {
    const [configPDA] = this.getConfigPDA();
    const [governancePDA] = this.getGovernancePDA();
    const [voterCheckpointsPDA] = this.getVoterCheckpointsPDA(voter);

    const remainingAccounts: Array<{
      pubkey: PublicKey;
      isWritable: boolean;
      isSigner: boolean;
    }> = [];

    for (const tokenAccount of nftTokenAccounts) {
      remainingAccounts.push({
        pubkey: tokenAccount,
        isWritable: false,
        isSigner: false,
      });

      try {
        const accountInfo = await this.connection.getAccountInfo(
          tokenAccount,
          'confirmed'
        );
        if (!accountInfo) {
          console.warn(`Token account ${tokenAccount.toBase58()} not found`);
          continue;
        }

        if (!accountInfo.owner.equals(TOKEN_PROGRAM_ID)) {
          console.warn(
            `Account ${tokenAccount.toBase58()} is not a token account`
          );
          continue;
        }

        if (accountInfo.data.length === 0) {
          console.warn(`Token account ${tokenAccount.toBase58()} is closed`);
          continue;
        }

        const tokenAccountData = unpackAccount(tokenAccount, accountInfo);
        const nftMint = tokenAccountData.mint;
        const [metadataPDA] = this.getMetadataAccountPDA(nftMint);

        remainingAccounts.push({
          pubkey: metadataPDA,
          isWritable: false,
          isSigner: false,
        });
      } catch (error: any) {
        console.warn(
          `Failed to get metadata account for token account ${tokenAccount.toBase58()}: ${error?.message || String(error)
          }`
        );
      }
    }

    const instruction = await this.program.methods
      .updateVoterCheckpoint()
      .accountsPartial({
        config: configPDA,
        governance: governancePDA,
        voter: voter,
        voterCheckpoints: voterCheckpointsPDA,
        systemProgram: SystemProgram.programId,
        clock: SYSVAR_CLOCK_PUBKEY,
      })
      .remainingAccounts(remainingAccounts)
      .instruction();

    const transaction = new Transaction();
    transaction.add(instruction);
    return transaction;
  }

  /**
   * Vote on an answer option for a quest
   * @param questKey - The quest key
   * @param answerKey - The answer option key
   * @param voter - The voter's public key
   * @returns Transaction
   */
  async voteAnswer(
    questKey: BN,
    answerKey: BN,
    voter: PublicKey
  ): Promise<Transaction> {
    const [configPDA] = this.getConfigPDA();
    const [governancePDA] = this.getGovernancePDA();
    const [governanceItemPDA] = this.getGovernanceItemPDA(questKey);
    const [answerVotePDA] = this.getAnswerVotePDA(questKey);
    const [answerOptionPDA] = this.getAnswerOptionPDA(questKey, answerKey);
    const [answerVoterPDA] = this.getAnswerVoterPDA(questKey, voter);

    const instruction = await this.program.methods
      .voteAnswer(questKey, answerKey)
      .accountsPartial({
        governance: governancePDA,
        config: configPDA,
        voter: voter,
        governanceItem: governanceItemPDA,
        answerVote: answerVotePDA,
        answerOption: answerOptionPDA,
        answerVoterRecord: answerVoterPDA,
        systemProgram: SystemProgram.programId,
      })
      .instruction();

    const transaction = new Transaction();
    transaction.add(instruction);

    return transaction;
  }

  /**
   * Set the answer result and initialize answer voting phase (admin only)
   * @param questKey - The quest key
   * @param answerKeys - Array of answer keys to initialize
   * @param authority - The authority's public key
   * @returns Transaction
   */
  async setAnswer(
    questKey: BN,
    answerKeys: BN[],
    authority: PublicKey
  ): Promise<Transaction> {
    const [configPDA] = this.getConfigPDA();
    const [governanceItemPDA] = this.getGovernanceItemPDA(questKey);
    const [answerVotePDA] = this.getAnswerVotePDA(questKey);

    return await this.program.methods
      .setAnswer(questKey, answerKeys)
      .accountsPartial({
        authority: authority,
        config: configPDA,
        governanceItem: governanceItemPDA,
        answerVote: answerVotePDA,
        systemProgram: SystemProgram.programId,
      })
      .transaction();
  }

  /**
   * Cancel answer vote phase (admin only)
   * @param questKey - The quest key
   * @param reason - Reason for canceling
   * @param authority - The authority's public key
   * @returns Transaction
   */
  async cancelAnswer(
    questKey: BN,
    reason: string,
    authority: PublicKey
  ): Promise<Transaction> {
    const [configPDA] = this.getConfigPDA();
    const [governanceItemPDA] = this.getGovernanceItemPDA(questKey);
    const [answerVotePDA] = this.getAnswerVotePDA(questKey);

    return await this.program.methods
      .cancelAnswer(questKey, reason)
      .accountsPartial({
        authority: authority,
        config: configPDA,
        governanceItem: governanceItemPDA,
        answerVote: answerVotePDA,
      })
      .transaction();
  }

  /**
   * Get answer option PDA
   */
  getAnswerOptionPDA(questKey: BN, answerKey: BN): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [
        Buffer.from('answer_option'),
        questKey.toArrayLike(Buffer, 'le', 8),
        answerKey.toArrayLike(Buffer, 'le', 8),
      ],
      this.program.programId
    );
  }

  /**
   * Distribute reward to voter for correct answer vote
   * @param questKey - The quest key
   * @param voter - The voter's public key
   * @param voterTokenAccount - The voter's token account
   * @param treasuryTokenAccount - The treasury's token account
   * @param treasuryAuthority - The treasury authority (usually the treasury wallet)
   * @returns Transaction
   */
  async distributeReward(
    questKey: BN,
    voter: PublicKey,
    voterTokenAccount: PublicKey,
    treasuryPda: PublicKey
  ): Promise<Transaction> {
    const [configPDA] = this.getConfigPDA();
    const [governancePDA] = this.getGovernancePDA();
    const [governanceItemPDA] = this.getGovernanceItemPDA(questKey);
    const [answerVotePDA] = this.getAnswerVotePDA(questKey);
    const [answerVoterPDA] = this.getAnswerVoterPDA(questKey, voter);
    const [treasuryTokenAccount] = this.getTreasuryTokenAccountPDA();

    return await this.program.methods
      .distributeDaoReward(questKey)
      .accountsPartial({
        config: configPDA,
        governance: governancePDA,
        governanceItem: governanceItemPDA,
        answerVote: answerVotePDA,
        voterRecord: answerVoterPDA,
        voter: voter,
        voterTokenAccount: voterTokenAccount,
        treasuryTokenAccount,
        treasuryPda: treasuryPda,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .transaction();
  }

  /**
   * Get selected answer key for a quest
   * @param questKey - The quest key
   * @returns The selected answer key as BN
   */
  async getSelectedAnswerKey(questKey: BN): Promise<BN> {
    const [governanceItemPDA] = this.getGovernanceItemPDA(questKey);

    try {
      const governanceItem = await this.program.account.governanceItem.fetch(
        governanceItemPDA
      );

      // Return the answer_result field as BN
      return governanceItem.answerResult as BN;
    } catch (error) {
      throw new Error(`Failed to get selected answer key: ${error}`);
    }
  }


  /**
   * Withdraw tokens from treasury (admin only)
   * @param amount - Amount of tokens to withdraw
   * @param destinationTokenAccount - The destination token account
   * @param authority - The authority's public key
   * @returns Transaction
   */
  async withdrawTokens(
    amount: BN,
    destinationTokenAccount: PublicKey,
    authority: PublicKey
  ): Promise<Transaction> {
    const [configPDA] = this.getConfigPDA();
    const [treasuryPDA] = this.getTreasuryPDA();
    const [treasuryTokenAccount] = this.getTreasuryTokenAccountPDA();

    return await this.program.methods
      .withdrawTokens(amount)
      .accountsPartial({
        authority,
        config: configPDA,
        treasuryPda: treasuryPDA,
        treasuryTokenAccount,
        destinationTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .transaction();
  }
}
