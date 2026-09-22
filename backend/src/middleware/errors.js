const notFound = (req, res) => res.status(404).json({ error: 'Route not found' });

const errorHandler = (error, req, res, next) => {
  if (res.headersSent) return next(error);
  if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
  if (error instanceof Error && error.name === 'MulterError') return res.status(400).json({ error: 'Invalid upload or file exceeds the 5 MB limit' });
  if (error.code === 11000) return res.status(409).json({ error: 'A record with those details already exists' });
  if (error.name === 'ValidationError') return res.status(400).json({ error: 'Validation failed', details: Object.values(error.errors).map((item) => item.message) });
  if (error.name === 'CastError') return res.status(400).json({ error: 'Invalid resource identifier' });
  console.error(error);
  return res.status(500).json({ error: 'Internal server error' });
};

module.exports = { notFound, errorHandler };
