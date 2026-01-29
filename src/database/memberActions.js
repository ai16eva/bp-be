const MemberDuplicate = require('../exceptions/MemberDuplicate');
const MemberNotFound = require('../exceptions/MemberNotFound');

const models = require('../models/mysql');// Adjust the path as needed
const {Op, fn, col, where} = require("sequelize");
const generateRandomString = require("../utils/generate_referral_code");
const Member = models.members;

class MemberTransformer {
  static transform(member) {
    if (!member) return null;
    return {
      id: member.member_id,
      walletAddress: member.wallet_address,
      walletType: member.wallet_type,
      role: member.member_role,
      email: member.member_email,
      name: member.member_name,
      avatar: member.member_avatar,
      emailVerified: member.member_email_verified,
      lockedAt: member.member_locked_at,
      lockedTx: member.member_locked_tx,
      delegatedTx: member.member_delegated_tx,
      createdAt: member.member_created_at,
      updatedAt: member.member_updated_at,
      archivedAt: member.member_archived_at,
    };
  }

  static transformList(members) {
    return members.map(this.transform);
  }
}

// 사용 예시:
// const transformedMember = MemberTransformer.transform(member);
// const transformedMembers = MemberTransformer.transformList(members);

const memberActions = {
  /**
   * Create a new member
   * @param {Object} member - The data for the new member
   * @returns {Promise<Object>} The created member object
   */
  Create: async (wallet_address) => {
    const duplicateWalletAddress = await Member.findOne({ where: { wallet_address } });
    if (duplicateWalletAddress) throw new MemberDuplicate('Wallet address duplicate');
    const dto = {
      wallet_address,
      wallet_type: 'UNKNOWN',
    };
    const newMember = await Member.create(dto);

    return newMember;
  },
  /**
   * Create a new privy member
   * @param {Object} member - The data for the new member
   * @returns {Promise<Object>} The created member object
   */
  CreateV2: async (wallet_address, wallet_type) => {
    const duplicateWalletAddress = await Member.findOne({ where: { wallet_address } });
    if (duplicateWalletAddress) throw new MemberDuplicate('Wallet address duplicate');
    const normalizedType = typeof wallet_type === 'string' && wallet_type.trim()
      ? wallet_type.trim().toUpperCase()
      : 'UNKNOWN';
    const dto = {
      wallet_address,
      wallet_type: normalizedType,
    };
    const newMember = await Member.create(dto);

    return newMember;
  },

  Get: async (wallet_address) => {
    const member = await Member.findOne({
      where: where(
          fn('LOWER', col('wallet_address')),
          Op.eq,
          fn('LOWER', wallet_address)
      )
    });
    return MemberTransformer.transform(member);
  },
  MustGet: async (wallet_address) => {
    const member = await Member.findOne({
      where: where(
          fn('LOWER', col('wallet_address')),
          Op.eq,
          fn('LOWER', wallet_address)
      )
    });
    if (!member) throw new MemberNotFound();
    return MemberTransformer.transform(member);
  },
  GetInstance: async (wallet_address) => {
    return await Member.findOne({
      where: where(
          fn('LOWER', col('wallet_address')),
          Op.eq,
          fn('LOWER', wallet_address)
      )
    });
  },
  /**
   * Get List of member by admin
   * @param {int} offset - Offset value
   * @param {int} limit - Limit value
   */
  List: async (limit, offset) => {
    const { count, rows } = await Member.findAndCountAll({
      order: [['member_created_at', 'DESC']],
      limit,
      offset: (offset - 1) * limit,
    });
    const transformedMembers = MemberTransformer.transformList(rows);
    return {
      total: count,
      members: transformedMembers,
    };
  },

  /**
   * Update member information
   * @param {string} wallet_address - The wallet address of the member to update (required)
   * @param {Object} data - The data to update (optional fields: name, email, avatar)
   * @throws {MemberNotFound} If the member is not found
   */
  Update: async (wallet_address, data) => {
    const member = await Member.findOne({
      where: where(
          fn('LOWER', col('wallet_address')),
          Op.eq,
          fn('LOWER', wallet_address)
      )
    });

    if (!member) {
      throw new MemberNotFound();
    }

    const updateFields = {};

    if (data.name !== undefined) {
      updateFields.member_name = data.name;
    }

    if (data.email !== undefined) {
      updateFields.member_email = data.email;
    }

    if (data.avatar !== undefined) {
      updateFields.member_avatar = data.avatar;
    }

    // Only update if there are fields to update
    if (Object.keys(updateFields).length > 0) {
      await member.update(updateFields);
    }
  },
  /**
   * Update member role
   * @param {string} wallet_address - The wallet address of the member to update (required)
   * @param {Object} data - The data to update (optional fields: toWalletAddress, role)
   * @throws {MemberNotFound} If the member or admin is not found
   * @throws {MemberRoleInvalid} If role value is not 'USER' OR 'ADMIN'
   */
  UpdateRole: async (wallet_address, member_role) => {
    const newAdmin = await Member.findOne({
      where: where(
          fn('LOWER', col('wallet_address')),
          Op.eq,
          fn('LOWER', wallet_address)
      )
    });

    if (!newAdmin) throw new MemberNotFound();

    await newAdmin.update({ member_role });
  },
  Delegate: async (wallet_address, member_delegated_tx) => {
    const newAdmin = await Member.findOne({
      where: where(
          fn('LOWER', col('wallet_address')),
          Op.eq,
          fn('LOWER', wallet_address)
      )
    });

    if (!newAdmin) throw new MemberNotFound();

    await newAdmin.update({ member_delegated_tx });
  },
  /**
   * Update member_locked_at as datetime
   * @param {string} wallet_address - The wallet address of the member to update (required)
   */

  Lock: async (wallet_address) => {
    await Member.update({ member_locked_at: new Date() }, {
      where: where(
          fn('LOWER', col('wallet_address')),
          Op.eq,
          fn('LOWER', wallet_address)
      )
    });
  },

  /**
   * Update member_locked_at as null
   * @param {string} wallet_address - The wallet address of the member to update (required)
   */
  Unlock: async (wallet_address) => {
    await Member.update({ member_locked_at: null }, {
      where: where(
          fn('LOWER', col('wallet_address')),
          Op.eq,
          fn('LOWER', wallet_address)
      )
    });
  },

  /**
   * Update member archived_at
   * @param {string} wallet_address - The wallet address of the member to update (required)
   * @throws {MemberNotFound} If the member not found
   */
  Archive: async (wallet_address) => {
    const member = await Member.findOne({
      where: where(
          fn('LOWER', col('wallet_address')),
          Op.eq,
          fn('LOWER', wallet_address)
      )
    });

    if (!member) {
      throw new MemberNotFound();
    }

    await member.update({ member_archived_at: new Date() });
  },

  /**
   * Update member archived_at as null
   * @param {string} wallet_address - The wallet address of the member to update (required)
   * @throws {MemberNotFound} If the member not found
   */
  Unarchive: async (wallet_address) => {
    const member = await Member.findOne({
      where: where(
          fn('LOWER', col('wallet_address')),
          Op.eq,
          fn('LOWER', wallet_address)
      )
    });

    if (!member) {
      throw new MemberNotFound();
    }

    await member.update({ member_archived_at: null });
  },
  /**
   * Delete a member from the database
   * @param {string} wallet_address - The wallet address of the member to delete
   * @throws {MemberNotFound} If the member is not found
   * @returns {Object} An object containing the number of deleted rows
   */
  Delete: async (wallet_address) => {
    await Member.destroy({
      where: where(
          fn('LOWER', col('wallet_address')),
          Op.eq,
          fn('LOWER', wallet_address)
      )
    });
  }
};

module.exports = memberActions;
