const heliusService = require('../src/services/helius.service');

async function main() {
  try {
    console.log('Setting up Helius webhook...');

    console.log('\nCurrent webhooks:');
    const existing = await heliusService.getWebhooks();
    console.log(existing);

    console.log('\nCreating new webhook...');
    const webhook = await heliusService.createWebhook();

    console.log('\nSetup complete!');
    console.log('Webhook ID:', webhook.webhookID);
    console.log('Save this ID for future reference');
  } catch (error) {
    console.error(' Setup failed:', error);
    process.exit(1);
  }
}

main();
