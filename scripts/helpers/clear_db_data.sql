-- Script để xóa hết dữ liệu cũ, chỉ giữ lại members (ADMIN users)
-- Chạy: mysql -h 127.0.0.1 -u root -ptaiqui12 boomplay_db < scripts/helpers/clear_db_data.sql

-- Tắt foreign key checks tạm thời
SET FOREIGN_KEY_CHECKS = 0;

-- Xóa dữ liệu từ các bảng (không xóa cấu trúc bảng)
TRUNCATE TABLE rewards;
TRUNCATE TABLE votes;
TRUNCATE TABLE bettings;
TRUNCATE TABLE answers;
TRUNCATE TABLE quests;
TRUNCATE TABLE activity_rewards;
TRUNCATE TABLE daily_rewards;
TRUNCATE TABLE referrals;
TRUNCATE TABLE checkins;
TRUNCATE TABLE boards;

-- Xóa dữ liệu NFT cache (sẽ re-index lại với token accounts đúng)
TRUNCATE TABLE governance_nft_owners;
TRUNCATE TABLE governance_nfts;

-- Xóa members nhưng giữ lại ADMIN users
DELETE FROM members WHERE member_role != 'ADMIN';

-- Giữ lại quest_categories và seasons (dữ liệu cấu trúc)
-- (Không xóa các bảng này)

-- Bật lại foreign key checks
SET FOREIGN_KEY_CHECKS = 1;

-- Hiển thị kết quả
SELECT '  Đã xóa hết dữ liệu cũ, chỉ giữ lại ADMIN users' AS Status;
SELECT COUNT(*) AS 'Số ADMIN users còn lại' FROM members WHERE member_role = 'ADMIN';

