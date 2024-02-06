var BadRequestError = require('./badRequestError.js');

module.exports.getAsResponse = async function (status, message, code) {
  return {
    statusCode: code,
    body: {
      'status': status,
      'message': message
    }
  };
}

module.exports.strTo250 = async function (str) {
  if (str.length > 250) {
    str = str.substring(0, 250);
  }
  return str;
}