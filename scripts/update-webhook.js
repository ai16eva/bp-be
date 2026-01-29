const heliusService = require('../src/services/helius.service');
const readline = require('readline');

async function updateWebhook() {
  try {
    console.log('Fetching existing webhooks...');
    const webhooks = await heliusService.getWebhooks();

    if (webhooks.length === 0) {
      console.log('No webhook found. Creating new one...');
      await heliusService.createWebhook();
      return;
    }

    console.log('\nExisting webhooks:');
    webhooks.forEach((wh, index) => {
      console.log(`${index + 1}. ID: ${wh.webhookID} - URL: ${wh.webhookURL}`);
    });

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question(
      '\nEnter webhook ID to update (or "new" to create): ',
      async (answer) => {
        if (answer.toLowerCase() === 'new') {
          await heliusService.createWebhook();
        } else {
          await heliusService.updateWebhook(answer);
          console.log('Webhook updated successfully!');
        }
        rl.close();
        process.exit(0);
      }
    );
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

updateWebhook();
