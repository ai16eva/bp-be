const axios = require('axios');
const db = require('../src/models/mysql');
require('dotenv').config();

// Mock req/res for direct controller testing since we can't easily rely on running server
const questController = require('../src/controllers/questController');

async function testTxFirstFlow() {
    try {
        console.log("Starting Transaction-First Flow Test...");

        // 1. Generate ID
        console.log("Step 1: Generating Quest ID...");
        let generatedKey;
        const resGen = {
            status: (code) => ({
                json: (data) => {
                    if (code === 200) {
                        generatedKey = data.data.quest_key;
                        console.log("  -> Generated Key:", generatedKey);
                    } else {
                        console.error("  -> Generation failed:", data);
                    }
                }
            })
        };
        await questController.generateQuestKey({}, resGen);

        if (!generatedKey) {
            console.error("Failed to generate key. Aborting.");
            process.exit(1);
        }

        // 2. Fetch dependencies for Add Quest
        const category = await db.quest_categories.findOne();
        const season = await db.seasons.findOne();

        if (!category || !season) {
            console.error("No category or season found for test!");
            process.exit(1);
        }

        // 3. Add Quest using the Generated Key
        console.log("Step 2: Adding Quest with Pre-generated Key...");

        const questData = {
            quest_key: generatedKey, // PASSING THE KEY HERE
            quest_title: "Test Tx Flow " + Date.now(),
            quest_description: "Testing tx first flow",
            quest_end_date: new Date(Date.now() + 86400000).toISOString(),
            quest_category_id: category.quest_category_id,
            season_id: season.season_id,
            quest_creator: "H5fPaWET2QnU2wMZMLg1UcZ1CCSSvoE6Vsf2jXRWEdyc",
            quest_betting_token: "BOOM",
            quest_image_link: "http://example.com/image.png",
            answers: ["Option A", "Option B"]
        };

        const reqAdd = {
            body: questData,
            file: null
        };

        const resAdd = {
            status: (code) => {
                return {
                    json: async (data) => { // async to allow DB check inside
                        if (code === 200) {
                            const createdKey = data.data.quest_key;
                            console.log("  -> Created Quest Key:", createdKey);

                            if (createdKey.toString() === generatedKey.toString()) {
                                console.log("SUCCESS: Created key matches generated key!");

                                // Cleanup
                                await db.answers.destroy({ where: { quest_key: createdKey } });
                                await db.quests.destroy({ where: { quest_key: createdKey } });
                                console.log("  -> Cleanup done.");
                            } else {
                                console.error(`FAILURE: Keys mismatch! Generated: ${generatedKey}, Created: ${createdKey}`);
                            }
                        } else {
                            console.error("  -> Creation failed:", data);
                        }
                    }
                }
            }
        };

        await questController.addQuest(reqAdd, resAdd);

    } catch (error) {
        console.error("Test Error:", error);
    } finally {
        // Force exit after a small delay to allow async ops to finish
        setTimeout(() => process.exit(), 1000);
    }
}

testTxFirstFlow();
