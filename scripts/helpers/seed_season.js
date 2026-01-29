const models = require('../../src/models/mysql');

async function seedSeason() {
  try {
    console.log('Checking for active season...');

    // Check if there's already an active season
    const existingActive = await models.seasons.findOne({
      where: { season_active: true },
    });

    if (existingActive) {
      console.log(`✓ Active season already exists: "${existingActive.season_title}" (ID: ${existingActive.season_id})`);
      process.exit(0);
    }

    // Create a new active season
    const now = new Date();
    const startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 1 day ago
    const endDate = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000); // 1 year from now

    const season = await models.seasons.create({
      season_title: `Season ${now.getFullYear()}`,
      season_description: 'Default active season for production',
      service_fee: 3,
      charity_fee: 1,
      creator_fee: 1,
      season_min_pay: 0,
      season_max_pay: 1000000,
      season_max_vote: 5,
      season_dao_reward: 5,
      season_active: true,
      season_start_date: startDate,
      season_end_date: endDate,
    });

    console.log(`✓ Created active season: "${season.season_title}" (ID: ${season.season_id})`);
    console.log(`  Start: ${startDate.toISOString()}`);
    console.log(`  End: ${endDate.toISOString()}`);
    console.log('✓ Season seeding completed!');
    process.exit(0);
  } catch (error) {
    console.error('✗ Error seeding season:', error);
    process.exit(1);
  }
}

seedSeason();

