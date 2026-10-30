const { v4: uuidv4 } = require('uuid');

function errorHandler(err, req, res, next) {
  const correlationId = uuidv4();
  console.error(`[Error ${correlationId}]`, err);

  const status = err.status || err.statusCode || 500;
  const code = err.code || (status === 500 ? 'INTERNAL_SERVER_ERROR' : 'REQUEST_ERROR');
  const message = status === 500
    ? 'An unexpected error occurred. Please try again later.'
    : (err.message || 'Operation failed.');

  res.status(status).json({
    error: {
      code,
      message,
      correlationId: status === 500 ? correlationId : undefined,
      details: err.details || undefined
    }
  });
}

function notFoundHandler(req, res, next) {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: `Endpoint ${req.method} ${req.originalUrl} not found.`
    }
  });
}

module.exports = {
  errorHandler,
  notFoundHandler
};
