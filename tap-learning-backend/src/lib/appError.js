class AppError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = 'AppError';
    this.status = options.status || 500;
    this.code = options.code || 'internal_error';
    this.details = options.details || null;
  }
}

module.exports = {
  AppError,
};
