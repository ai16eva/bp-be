const setupTestDB = require('../../testHelper');
const models = require('../../../models/mysql');
const Member = require('../../../database/memberActions');

const MemberDuplicate = require('../../../exceptions/MemberDuplicate');
const MemberNotFound = require('../../../exceptions/MemberNotFound');

describe('Member Model', () => {
  setupTestDB(models);

  it('should create a user', async () => {
    const newMember = await Member.Create('0x8C05C2588196248f8B85D547C5104eaB0DE17F87');
    expect(newMember.wallet_address).toBe('0x8C05C2588196248f8B85D547C5104eaB0DE17F87');
  });

  it('should throw wallet address duplicate error', async () => {
    // First creation should succeed
    await Member.Create('0x8C05C2588196248f8B85D547C5104eaB0DE17F87');

    // Second creation with the same data should throw MemberDuplicate error
    await expect(Member.Create('0x8C05C2588196248f8B85D547C5104eaB0DE17F87')).rejects.toThrow(
      new MemberDuplicate('Wallet address duplicate')
    );
  });
  // it("should throw email duplicate error", async () => {
  //   const memberData = {
  //     wallet_address: "0x8C05C2588196248f8B85D547C5104eaB0DE17F47",
  //     email: "test@example.com",
  //   };

  //   // First creation should succeed
  //   await Member.create(memberData);

  //   // Second creation with the same data should throw MemberDuplicate error
  //   await expect(Member.create(memberData)).rejects.toThrow(new MemberDuplicate("Email duplicate"));
  // });
  describe('Update', () => {
    it('should update member information successfully', async () => {
      // Create a member
      await models.members.create({ wallet_address: '0x123' });

      const updateData = {
        name: 'NewName',
        email: 'new@example.com',
        avatar: 'new-avatar.jpg',
      };

      await Member.Update('0x123', updateData);

      // Fetch the updated member
      const updatedMember = await models.members.findOne({ where: { wallet_address: '0x123' } });

      expect(updatedMember.member_name).toBe('NewName');
      expect(updatedMember.member_email).toBe('new@example.com');
      expect(updatedMember.member_avatar).toBe('new-avatar.jpg');
    });

    it('should throw MemberNotFound if member does not exist', async () => {
      await expect(Member.Update('0x456', { name: 'NewName' })).rejects.toThrow(new MemberNotFound());
    });

    it('should only update provided fields', async () => {
      // Create a member
      await models.members.create({ wallet_address: '0x123' });

      // Only update name
      await Member.Update('0x123', { name: 'NewName' });

      const updatedMember = await models.members.findOne({ where: { wallet_address: '0x123' } });

      expect(updatedMember.member_name).toBe('NewName');
      expect(updatedMember.member_email).toBeNull();
      expect(updatedMember.member_avatar).toBeNull();
    });

    it('should not update anything if no fields are provided', async () => {
      // Create a member
      await models.members.create({ wallet_address: '0x123' });

      // Update with empty object
      await Member.Update('0x123', {});

      const updatedMember = await models.members.findOne({ where: { wallet_address: '0x123' } });

      expect(updatedMember.member_name).toBeNull();
      expect(updatedMember.member_email).toBeNull();
      expect(updatedMember.member_avatar).toBeNull();
    });

    it('should handle null values in update data', async () => {
      // Create a member
      await models.members.create({ wallet_address: '0x123' });

      const updateData = {
        name: 'newName',
        email: 'ex@email.com',
      };

      await Member.Update('0x123', updateData);

      const updatedMember = await models.members.findOne({ where: { wallet_address: '0x123' } });

      expect(updatedMember.member_name).toBe('newName');
      expect(updatedMember.member_email).toBe('ex@email.com');
      expect(updatedMember.member_avatar).toBeNull();

      const handleNullData = {
        name: null,
        email: null,
      };

      await Member.Update('0x123', handleNullData);

      const updatedMemberSecond = await models.members.findOne({ where: { wallet_address: '0x123' } });
      expect(updatedMemberSecond.member_name).toBeNull();
      expect(updatedMemberSecond.member_email).toBeNull();
      expect(updatedMemberSecond.member_avatar).toBeNull();
    });
  });

  describe('lock', () => {
    it('should lock a member successfully', async () => {
      await models.members.create({ wallet_address: '0x123' });
      const beforeLockTime = new Date();
      await new Promise((resolve) => setTimeout(resolve, 1000)); // 작은 지연 추가
      await Member.Lock('0x123');
      await new Promise((resolve) => setTimeout(resolve, 1000)); // 작은 지연 추가
      const afterLockTime = new Date();
      const lockedMember = await models.members.findOne({ where: { wallet_address: '0x123' } });

      expect(lockedMember.member_locked_at).not.toBeNull();
      expect(lockedMember.member_locked_at.getTime()).toBeGreaterThan(beforeLockTime.getTime());
      expect(lockedMember.member_locked_at.getTime()).toBeLessThan(afterLockTime.getTime());
    });

    it('should throw MemberNotFound if member does not exist', async () => {
      await expect(Member.Lock('0x456')).rejects.toThrow(new MemberNotFound());
    });
  });

  describe('unlock', () => {
    it('should unlock a member successfully', async () => {
      // 잠긴 상태의 회원 생성
      await models.members.create({
        wallet_address: '0x123',
        member_locked_at: new Date(),
      });

      await Member.Unlock('0x123');

      // 업데이트된 회원 조회
      const unlockedMember = await models.members.findOne({ where: { wallet_address: '0x123' } });

      expect(unlockedMember.member_locked_at).toBeNull();
    });

    it('should throw MemberNotFound if member does not exist', async () => {
      await expect(Member.Unlock('0x456')).rejects.toThrow(new MemberNotFound());
    });
  });
  describe('archive', () => {
    it('should archive a member successfully and update archived_at', async () => {
      const member = await models.members.create({ wallet_address: '0x123' });

      const beforeArchive = new Date();
      await new Promise((resolve) => setTimeout(resolve, 1000)); // 작은 지연 추가

      await Member.Archive('0x123');

      await new Promise((resolve) => setTimeout(resolve, 1000)); // 작은 지연 추가
      const afterArchive = new Date();

      const archivedMember = await models.members.findOne({ where: { wallet_address: '0x123' } });

      expect(archivedMember.member_archived_at).not.toBeNull();
      expect(archivedMember.member_archived_at.getTime()).toBeGreaterThan(beforeArchive.getTime());
      expect(archivedMember.member_archived_at.getTime()).toBeLessThan(afterArchive.getTime());
    });
    it('should throw MemberNotFound if member does not exist', async () => {
      await expect(Member.Archive('0x456')).rejects.toThrow(new MemberNotFound());
    });
  });

  describe('unarchive', () => {
    it('should unarchive a member successfully and set archived_at to null', async () => {
      const archiveDate = new Date();
      await models.members.create({
        wallet_address: '0x123',
        member_archived_at: archiveDate,
      });

      await Member.Unarchive('0x123');

      const unarchivedMember = await models.members.findOne({ where: { wallet_address: '0x123' } });

      expect(unarchivedMember.member_archived_at).toBeNull();
    });
    it('should throw MemberNotFound if member does not exist', async () => {
      await expect(Member.Unarchive('0x456')).rejects.toThrow(new MemberNotFound());
    });
  });

  describe('Update Role', () => {
    it('should update member role successfully', async () => {
      await Member.Create('0x1234567890');
      await Member.UpdateRole('0x1234567890', 'ADMIN');

      const updatedMember = await models.members.findOne({ where: { wallet_address: '0x1234567890' } });
      expect(updatedMember.member_role).toBe('ADMIN');
    });

    it('should throw MemberNotFound error when member does not exist', async () => {
      await expect(Member.UpdateRole('0x9876543210', 'ADMIN')).rejects.toThrow(new MemberNotFound());
    });

    it('should throw an error if update fails', async () => {
      await Member.Create('0x1234567890');
      // 이 테스트를 위해 Member 모델의 update 메소드를 일시적으로 오버라이드
      const originalUpdate = models.members.prototype.update;
      models.members.prototype.update = jest.fn().mockRejectedValue(new Error('Update failed'));

      await expect(Member.UpdateRole('0x1234567890', 'ADMIN')).rejects.toThrow('Update failed');

      // 원래의 update 메소드로 복원
      models.members.prototype.update = originalUpdate;
    });

    it('should not update if role is invalid', async () => {
      await Member.Create('0x1234567890');
      await expect(Member.UpdateRole('0x1234567890', 'INVALID_ROLE')).rejects.toThrow();

      const notUpdatedMember = await models.members.findOne({ where: { wallet_address: '0x1234567890' } });
      expect(notUpdatedMember.member_role).toBe('USER');
    });
  });
  describe('delegate', () => {
    it('should update member_delegate_tx for an existing member', async () => {
      // Arrange
      const wallet_address = '0x1234567890123456789012345678901234567890';
      const member_delegated_tx = '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';

      await Member.Create(wallet_address);

      // Act
      await Member.Delegate(wallet_address, member_delegated_tx);

      // Assert
      const updatedMember = await Member.Get(wallet_address);
      expect(updatedMember.delegatedTx).toBe(member_delegated_tx);
    });

    it('should throw MemberNotFound for non-existent member', async () => {
      // Arrange
      const wallet_address = '0x9876543210987654321098765432109876543210';
      const member_delegated_tx = '0xfedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210';

      // Act & Assert
      await expect(Member.Delegate(wallet_address, member_delegated_tx)).rejects.toThrow(new MemberNotFound());
    });
  });
  describe('get', () => {
    it('should get member data', async () => {
      // Arrange
      const wallet_address = '0x1234567890123456789012345678901234567890';

      await Member.Create(wallet_address);

      const member = await Member.Get(wallet_address);
      expect(member).toBeDefined();
      expect(member.walletAddress).toBe(wallet_address);
      expect(member.role).toBe('USER'); // Assuming default role is 'USER'
      expect(member.emailVerified).toBe('F'); // Assuming default is 'F'
      expect(member.createdAt).toBeInstanceOf(Date);
      expect(member.updatedAt).toBeInstanceOf(Date);
    });

    it('should get empty data', async () => {
      // Arrange
      const wallet_address = '0x9876543210987654321098765432109876543210';
      const member = await Member.Get(wallet_address);
      expect(member).toBeNull();
    });
  });
});
