const express = require("express");
const router = express.Router();
const API_ORDER_URL = process.env.API_ORDER_URL;

// Redirect from homepage to order page (use absolute paths)
router.get("/", (req, res) => {
  res.redirect("/order");
});

// Orders Page - This route will now be managed by 'orderRoutes.js'
router.get("/order", (req, res) => {
  res.redirect("/order/orders");
});

// Product Page - This route will redirect to the product details page
router.get("/product/:id", (req, res) => {
  const { id } = req.params;
  res.redirect(`/order/product/${id}`);
});

// Cart Page - Redirecting to cart if someone tries to access directly
router.get("/cart", (req, res) => {
  res.redirect("/order/cart");
});

module.exports = router;
