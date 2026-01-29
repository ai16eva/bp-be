const models = require('../../src/models/mysql');


async function updateCategories() {
    try {
        console.log('Starting to update categories...');

        const cultureArt = await models.quest_categories.findOne({
            where: { quest_category_title: 'Culture & Art' },
        });

        if (cultureArt) {
            await cultureArt.update({ quest_category_title: 'Contents' });
            console.log('✓ Updated "Culture & Art" → "Contents"');
        } else {
            console.log('- "Culture & Art" not found, skipping...');
        }

        const science = await models.quest_categories.findOne({
            where: { quest_category_title: 'Science' },
        });

        if (science) {
            await science.update({ quest_category_title: 'Technology' });
            console.log('✓ Updated "Science" → "Technology"');
        } else {
            console.log('- "Science" not found, skipping...');
        }

        const orderMapping = {
            'Sports': 1,
            'Politics': 2,
            'Economy': 3,
            'Contents': 4,
            'Crypto': 5,
            'Technology': 6,
            'Society': 7,
        };

        for (const [title, order] of Object.entries(orderMapping)) {
            const category = await models.quest_categories.findOne({
                where: { quest_category_title: title },
            });

            if (category) {
                await category.update({ quest_category_order: order });
                console.log(`✓ Updated order for "${title}" → ${order}`);
            }
        }

        console.log('✓ Categories update completed!');
        process.exit(0);
    } catch (error) {
        console.error('✗ Error updating categories:', error);
        process.exit(1);
    }
}

updateCategories();
