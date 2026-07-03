const { z } = require('zod');

const validateZod = (schema) => (req, res, next) => {
  try {
    schema.parse({
      body: req.body,
      query: req.query,
      params: req.params,
    });
    next();
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: err.errors
      });
    }
    return res.status(400).json({ message: 'Invalid data' });
  }
};

module.exports = { validateZod };
