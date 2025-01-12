const express = require("express");
const axios = require("axios");

const router = express.Router();
const API_ORDER_URL = process.env.API_ORDER_URL;

// Middleware to ensure user authentication using session
const ensureAuthenticated = (req, res, next) => {
  const { user, accessToken } = req.session;
  if (user && accessToken) {
    console.log("User is authenticated:", user);
    next();
  } else {
    console.log("User not authenticated, redirecting to login.");
    res.redirect("/login");
  }
};


// Home Page - List all products or search based on query params
router.get("/", ensureAuthenticated, async (req, res) => {
  try {
    const { accessToken } = req.session;
    const { title, description, category, price } = req.query; // Get search filters from query params

    // Prepare search query including price range
    const searchQuery = {
      title: title || '', // Default to an empty string if undefined
      description: description || '',
      category: category || '',
      price: {
        min: price?.min ? parseFloat(price.min) : 0,
        max: price?.max ? parseFloat(price.max) : 10000,
      }
    };

    console.log("Fetching products with search criteria:", searchQuery);

    let response;

    if (title || description || category || price) {
      // If there are search filters, perform a search
      response = await axios.get(`${API_ORDER_URL}/products/search`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: searchQuery, // Pass query params to search endpoint
      });
    } else {
      // If no search filters, fetch all products
      response = await axios.get(`${API_ORDER_URL}/products/`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
    }

    const cartCount = req.session.cart ? req.session.cart.length : 0;
    console.log("Cart count:", cartCount);

    // Render the products page with all or searched products
    res.render("pages/orders/index", { 
      products: response.data, 
      cartCount, 
      searchQuery  // Pass the search query, including price range, to the view
    });

  } catch (error) {
    console.error("Error fetching products:", error.message);
    res.render("pages/orders/index", { products: [], cartCount: 0, error: error.message });
  }
});






// Product Details Page
router.get("/product/:id", ensureAuthenticated, async (req, res) => {  // Ensure authentication here
  try {
    const { accessToken } = req.session;
    console.log(`Fetching details for product ID: ${req.params.id} with access token:`, accessToken);

    const response = await axios.get(`${API_ORDER_URL}/products/${req.params.id}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    res.render("pages/orders/productDetails", { product: response.data });
  } catch (error) {
    console.error("Error fetching product details:", error.message);
    res.status(500).send("Product not found");
  }
});

// Cart Page
router.get("/cart", ensureAuthenticated, (req, res) => {
  const cart = req.session.cart || [];
  const cartCount = cart.length;  // Count of items in cart
  console.log("Rendering cart page with items:", cart);
  res.render("pages/orders/cart", { cart, cartCount });
});



// Add to Cart
router.post("/cart", ensureAuthenticated, (req, res) => {
  const { productId, title, quantity, price } = req.body;
  const cart = req.session.cart || [];
  
  // Check if the item is already in the cart
  const existingItemIndex = cart.findIndex(item => item.productId === productId);
  
  if (existingItemIndex !== -1) {
    // Update quantity if the item is already in the cart
    cart[existingItemIndex].quantity += parseInt(quantity, 10); // Parse both quantities as integers
  } else {
    // Otherwise, add a new item
    cart.push({ productId, title, quantity: parseInt(quantity, 10), price });
  }

  req.session.cart = cart; // Update the session cart
  console.log("Updated cart:", cart);
  res.redirect("/order/");
});




// Remove from Cart
router.post("/cart/remove", ensureAuthenticated, (req, res) => {
  const { productId } = req.body;
  const cart = req.session.cart || [];
  
  // Remove the item from the cart
  const updatedCart = cart.filter(item => item.productId !== productId);
  req.session.cart = updatedCart; // Update cart in session
  console.log("Removed from cart:", productId);

  res.redirect("/order/cart");
});

// Checkout
router.post("/checkout", ensureAuthenticated, async (req, res) => {  // Ensure authentication here
  try {
    const cart = req.session.cart || [];
    const { accessToken } = req.session;

    console.log("Checking out with cart items:", cart);

    const response = await axios.post(
      `${API_ORDER_URL}/orders`,
      { products: cart },
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    console.log("Checkout successful:", response.data);
    req.session.cart = []; // Clear cart after successful order
    res.redirect("/order/orders");
  } catch (error) {
    console.error("Checkout failed:", error.message);
    res.status(500).send("Checkout failed");
  }
});

// Orders Page
router.get("/orders", ensureAuthenticated, async (req, res) => {
  try {
    const { accessToken } = req.session;

    console.log("Fetching orders with access token:", accessToken);

    // Fetch orders
    const response = await axios.get(`${API_ORDER_URL}/orders`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const orders = response.data;

    // Fetch product titles for each order
    for (const order of orders) {
      const productNames = [];

      // Fetch details for each product in the order
      for (const product of order.products) {
        try {
          const productResponse = await axios.get(`${API_ORDER_URL}/products/${product.productId}`, {
            headers: { Authorization: `Bearer ${accessToken}` },
          });

          productNames.push(productResponse.data.title);
        } catch (productError) {
          console.error(`Failed to fetch product ${product.productId}:`, productError.message);
          productNames.push("Unknown Product"); // Handle missing product gracefully
        }
      }

      // Add product names to the order
      order.productNames = productNames;
    }

    res.render("pages/orders/orders", { orders });
  } catch (error) {
    console.error("Failed to fetch orders:", error.message);
    res.status(500).send("Failed to fetch orders");
  }
});


// Order Details Page
router.get("/order/:id", ensureAuthenticated, async (req, res) => {
  try {
    const { accessToken } = req.session;
    const orderId = req.params.id;  // Capture the order ID from the URL
    console.log(`Fetching details for order ID: ${orderId} with access token:`, accessToken);

    // Fetch the order details from the API
    const orderResponse = await axios.get(`${API_ORDER_URL}/orders/${orderId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    
    const order = orderResponse.data;
    
    // Fetch details for each product in the order
    const productPromises = order.products.map(async (product) => {
      const productResponse = await axios.get(`${API_ORDER_URL}/products/${product.productId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      // Return merged data, ensuring `quantity` comes from `order.products`
      return {
        ...productResponse.data,  // Product details
        quantity: product.quantity,  // Ordered quantity
      };
    });

    // Wait for all the product details to be fetched
    const productsWithDetails = await Promise.all(productPromises);

    // Update the order object with the full product details
    order.products = productsWithDetails;

    // Render the order details page with the order information and product details
    res.render("pages/orders/orderDetails", { order });
  } catch (error) {
    console.error("Error fetching order details:", error.message);
    res.status(500).send("Order not found");
  }
});



// Order Update Route
router.get("/order/:id/edit", ensureAuthenticated, async (req, res) => {
  try {
    const { accessToken } = req.session;
    const orderId = req.params.id;

    console.log(`Fetching order data for edit, Order ID: ${orderId}`);

    // Fetch the order details
    const orderResponse = await axios.get(`${API_ORDER_URL}/orders/${orderId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const order = orderResponse.data;

    // Fetch product details for each product in the order
    const productPromises = order.products.map(async (product) => {
      const productResponse = await axios.get(`${API_ORDER_URL}/products/${product.productId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      return {
        ...productResponse.data, // Product details
        quantity: product.quantity, // Ordered quantity
      };
    });

    const productsWithDetails = await Promise.all(productPromises);

    // Render the edit page with order and product details
    res.render("pages/orders/editOrder", {
      orderId,
      products: productsWithDetails,
    });
  } catch (error) {
    console.error("Error fetching order data for edit:", error.message);
    res.status(500).send("Failed to load order update page");
  }
});


router.post("/order/:id/update", ensureAuthenticated, async (req, res) => {
  try {
    const { accessToken } = req.session;
    const orderId = req.params.id;

    console.log(`Updating order ID: ${orderId} with data:`, req.body.products);

    // Transform the products data from the nested format
    const updatedProducts = Object.values(req.body.products).map(product => ({
      productId: product.productId?.trim(),
      quantity: parseInt(product.quantity, 10),
    }));

    // Filter out invalid products
    const validProducts = updatedProducts.filter(
      p => p.productId && !isNaN(p.quantity) && p.quantity > 0
    );

    if (!validProducts.length) {
      throw new Error("No valid products to update");
    }

    // Send the update request to the API
    const payload = { products: validProducts };
    const response = await axios.put(
      `${API_ORDER_URL}/orders/${orderId}`,
      payload,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    console.log("Order updated successfully:", response.data);

    // Redirect back to the order details page
    res.redirect(`/order/order/${orderId}`);
  } catch (error) {
    console.error("Error updating order:", error.message);
    res.status(500).send("Failed to update order");
  }
});



router.post("/order/:id/delete", ensureAuthenticated, async (req, res) => {
  try {
    const { accessToken } = req.session;
    const orderId = req.params.id;

    console.log(`Deleting order ID: ${orderId}`);

    // Send the delete request to the API
    await axios.delete(`${API_ORDER_URL}/orders/${orderId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    console.log(`Order ${orderId} deleted successfully.`);
     res.redirect('/order/orders');
  } catch (error) {
    console.error("Error deleting order:", error.message);
    res.status(500).json({ success: false, message: "Failed to delete order." });
  }
});


router.delete("/order/:id/delete", ensureAuthenticated, async (req, res) => {
  try {
    const { accessToken } = req.session;
    const orderId = req.params.id;

    console.log(`Deleting order ID: ${orderId}`);

    // Send the delete request to the API
    await axios.delete(`${API_ORDER_URL}/orders/${orderId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    console.log(`Order ${orderId} deleted successfully.`);
     res.redirect('/order/orders');
  } catch (error) {
    console.error("Error deleting order:", error.message);
    res.status(500).json({ success: false, message: "Failed to delete order." });
  }
});



module.exports = router;
