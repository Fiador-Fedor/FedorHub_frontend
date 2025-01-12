const ensureAuthenticated = (req, res, next) => {
  const { user, accessToken } = req.session;
  if (user && accessToken) {
    next();
  } else {
    res.redirect('/login');
  }
};

module.exports = ensureAuthenticated;
