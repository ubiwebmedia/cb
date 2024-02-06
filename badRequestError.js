class BadRequestError extends Error {
  constructor(message) {
    super(message);
  }
}
module.exports = BadRequestError;