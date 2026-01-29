const models = require('../../src/models/mysql');

const categories = [
  { title: 'Sports', order: 1 },
  { title: 'Politics', order: 2 },
  { title: 'Economy', order: 3 },
  { title: 'Contents', order: 4 },
  { title: 'Crypto', order: 5 },
  { title: 'Technology', order: 6 },
  { title: 'Society', order: 7 },
];

async function seedCategories() {
  try {
    console.log('Starting to seed categories...');

    for (const category of categories) {
      const existing = await models.quest_categories.findOne({
        where: { quest_category_title: category.title },
      });

      if (existing) {
        console.log(`✓ Category "${category.title}" already exists, skipping...`);
      } else {
        await models.quest_categories.create({
          quest_category_title: category.title,
          quest_category_order: category.order,
        });
        console.log(`✓ Created category: ${category.title}`);
      }
    }

    console.log('✓ Categories seeding completed!');
    process.exit(0);
  } catch (error) {
    console.error('✗ Error seeding categories:', error);
    process.exit(1);
  }
}

seedCategories();

