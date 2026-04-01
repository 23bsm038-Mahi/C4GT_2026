function sendSuccess(res, data, status = 200) {
  return res.status(status).json({
    data,
    error: null,
  });
}

function sendError(res, error, status = 400) {
  return res.status(status).json({
    data: null,
    error,
  });
}

module.exports = {
  sendSuccess,
  sendError,
};
