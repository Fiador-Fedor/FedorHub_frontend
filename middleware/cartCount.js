const cartCountMiddleware = (req, res, next) => {
    // Calculate cart count from session
    res.locals.cartCount = req.session.cart ? req.session.cart.length : 0;
    next(); // Call the next middleware or route handler
  };
  
  module.exports = cartCountMiddleware;
  