const { Prisma } = require('@prisma/client');

const errorHandler = (err, req, res, next) => {
    
    if (process.env.NODE_ENV !== 'production') {
        console.error('💥 AN ERROR OCCURRED 💥:', err);
    }

    let statusCode = err.statusCode || 500;
    let message = err.message || 'Internal Server Error';

    // Handle Prisma Errors
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
        switch (err.code) {
            case 'P2002':
                statusCode = 409; // Conflict
                message = `The ${err.meta.target[0]} is already taken.`;
                break;
            case 'P2025':
                statusCode = 404; // Not Found
                message = `Record not found.`;
                break;
            default:
                message = `Database Error: ${err.code}`;
                break;
        }
    }

    res.status(statusCode).json({
        success: false,
        message,
        data: null,
        stack: process.env.NODE_ENV === 'production' ? null : err.stack,
    });
};

module.exports = { errorHandler };