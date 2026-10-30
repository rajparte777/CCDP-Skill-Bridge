function validate(fields) {
  return (req, res, next) => {
    const missing = [];
    for (const field of fields) {
      if (req.body[field] === undefined || req.body[field] === null || req.body[field] === '') {
        missing.push(field);
      }
    }
    if (missing.length > 0) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: `Missing required field(s): ${missing.join(', ')}`,
          fields: missing
        }
      });
    }
    next();
  };
}

module.exports = {
  validate
};
