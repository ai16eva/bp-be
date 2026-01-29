const swaggerAutogen = require('swagger-autogen')({ openapi: '3.0.0' });
const schemas = require('./schema');
const examples = require('./example');
const doc = {
  info: {
    version: '', // by default: '1.0.0'
    title: 'Boomplay Rest API', // by default: 'REST API'
    description:
      'This is documentation for boomplay REST API\n\n' +
      '- For information about flow, visit [BoomPlay_flow](https://excalidraw.com/%C3%82%C2%A0%C3%AB%C2%9D%C2%BC%C3%AB%C2%8A%C2%94%C3%AA%C2%B2%C2%8C#json=feQ5K88tvJa7R40UufSaN,y3R-7LsdmSCE4EfmL5L4UQ).\n' +
      '- Check out our [Docs](https://justdoju.notion.site/BoomPlay-docs-d209fb5dade24e7f926772c067aaa020?pvs=4).',
  },

  host: 'http://localhost:3000', // by default: 'localhost:3000'
  basePath: '', // by default: '/'
  schemes: ['http', 'https'], // by default: ['http']
  consumes: [], // by default: ['application/json']
  produces: [], // by default: ['application/json']
  tags: [
    {
      name: 'Member',
      description: 'service users related endpoints',
    },
    {
      name: 'Quest',
      description: ' Quest related endpoints',
    },
    {
      name: 'Betting',
      description: ' Betting related endpoints',
    },
    { name: 'Quest-dao', description: 'service quest-dao related endpoints' },
    { name: 'Quest-category', description: 'service quest-category related endpoints' },
    { name: 'Season', description: 'service season related endpoints' },
    { name: 'Vote', description: 'service dao vote related endpoints' },
    { name: 'Board', description: 'service board related endpoints' },
    { name: 'Checkin', description: 'service checkin related endpoints' },
    { name: 'NEW', description: 'newly added/updated endpoints' },
  ],
  securityDefinitions: {}, // by default: empty object
  definitions: {}, // by default: empty object (Swagger 2.0)
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
      },
    },
    schemas: schemas,
    examples: examples
  },
  security: [
    {
      bearerAuth: [],
    },
  ],
};
const outputFile = './swagger_output.json';
const endpointsFiles = ['../app.js'];

swaggerAutogen(outputFile, endpointsFiles, doc);
