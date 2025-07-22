const swaggerJsdoc = require('swagger-jsdoc');
const packageJson = require('../../package.json');

const options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Web-Blog API Documentation',
            version: packageJson.version,
            description: 'API documentation for the Web-Blog application, built with Express.js and Prisma.',
        },
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                },
            },
        },
        security: [
            {
                bearerAuth: [],
            },
        ],
    },
    // Path to the API docs
    apis: ['./src/routes/*.js'],
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;