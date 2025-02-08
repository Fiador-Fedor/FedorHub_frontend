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

// Payment Details Page
router.get("/payment", ensureAuthenticated, (req, res) => {
  const cart = req.session.cart || [];
  if (!cart.length) {
    return res.redirect("/order/cart");
  }
  res.render("pages/orders/payment", { cart });
});

// Handle form submission from cart page
router.post("/payment", ensureAuthenticated, (req, res) => {
  const cart = req.session.cart || [];
  if (!cart.length) {
    return res.redirect("/order/cart");
  }
  
  // Update cart quantities if needed
  if (req.body.products) {
    cart.forEach(item => {
      const newQuantity = parseInt(req.body.products[item._id]?.quantity, 10);
      if (!isNaN(newQuantity) && newQuantity > 0) {
        item.quantity = newQuantity;
      }
    });
    req.session.cart = cart;
  }
  
  res.redirect("/order/payment");
});

// Handle checkout from payment page
router.post("/checkout", ensureAuthenticated, async (req, res) => {
  try {
    const cart = req.session.cart || [];
    const { accessToken } = req.session;
    const { cardNumber, expiry, cvv, cardholderName } = req.body;

    // Validate payment details
    if (!cardNumber || !expiry || !cvv || !cardholderName) {
      throw new Error("Missing payment details");
    }

    console.log("Processing checkout with payment details and cart items:", cart);

    const response = await axios.post(
      `${API_ORDER_URL}/orders`,
      { 
        products: cart,
        paymentDetails: {
          cardNumber: cardNumber.replace(/\s/g, ''),
          expiry,
          cardholderName
        }
      },
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    console.log("Checkout successful:", response.data);
    req.session.cart = []; // Clear cart after successful order
    res.redirect("/order/orders");
  } catch (error) {
    console.error("Checkout failed:", error.message);
    res.redirect("/order/payment?error=Payment failed");
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

// Admin Orders Page
router.get("/admin/orders", ensureAuthenticated, async (req, res) => {
  try {
    const { accessToken, user } = req.session;
    
    // Check if user is admin
    if (user.role !== 'ADMIN') {
      return res.status(403).send('Access denied');
    }

    // Fetch all orders using the admin endpoint
    const ordersResponse = await axios.get(`${API_ORDER_URL}/orders/all`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const orders = ordersResponse.data;

    // Fetch detailed information for each order
    const enrichedOrders = await Promise.all(orders.map(async (order) => {
      try {
        // Get user (customer) details
        const userResponse = await axios.get(`${process.env.API_AUTH_URL}/users/${order.userId}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        // Get product details for each product in the order
        const productsWithDetails = await Promise.all(order.products.map(async (product) => {
          try {
            const productResponse = await axios.get(`${API_ORDER_URL}/products/${product.productId}`, {
              headers: { Authorization: `Bearer ${accessToken}` },
            });
            return {
              ...product,
              details: productResponse.data
            };
          } catch (error) {
            console.error(`Error fetching product ${product.productId}:`, error.message);
            return {
              ...product,
              details: { title: "Unknown Product" }
            };
          }
        }));

        return {
          ...order,
          customer: userResponse.data,
          products: productsWithDetails,
          productNames: productsWithDetails.map(p => p.details.title)
        };
      } catch (error) {
        console.error(`Error enriching order ${order._id}:`, error.message);
        return {
          ...order,
          customer: { name: "Unknown Customer" },
          productNames: order.products.map(() => "Unknown Product")
        };
      }
    }));

    res.render("pages/orders/adminOrders", { orders: enrichedOrders });
  } catch (error) {
    console.error("Failed to fetch orders:", error.message);
    res.status(500).render("pages/orders/adminOrders", { 
      orders: [], 
      error: "Failed to fetch orders" 
    });
  }
});

// Update Order Status
router.patch("/:id", ensureAuthenticated, async (req, res) => {
  try {
    const { accessToken, user } = req.session;
    
    // Check if user is admin
    if (user.role !== 'ADMIN') {
      return res.status(403).json({ message: 'Access denied' });
    }

    const orderId = req.params.id;
    const { status } = req.body;

    console.log(`Updating status for order ID: ${orderId} to ${status}`);

    // Call the API to update the order status
    const response = await axios.patch(
      `${API_ORDER_URL}/orders/${orderId}`,
      { status },
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    res.json(response.data);
  } catch (error) {
    console.error("Error updating order status:", error);
    res.status(error.response?.status || 500).json({
      success: false,
      message: error.response?.data?.message || "Failed to update order status"
    });
  }
});

// Seller Orders Page
router.get("/seller/orders", ensureAuthenticated, async (req, res) => {
  try {
    const { accessToken, user } = req.session;
    
    // Validate user role
    if (user.role !== 'SHOP_OWNER') {
      return res.status(403).send('Access denied');
    }

    // Fetch orders from API
    const ordersResponse = await axios.get(
      `${API_ORDER_URL}/orders/seller/orders`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    ).catch(error => {
      // Handle API errors
      console.error("API Error:", error.response?.data || error.message);
      throw new Error("Failed to fetch orders from server");
    });

    const orders = ordersResponse.data;

    // Process orders only if data exists
    if (!orders || !Array.isArray(orders)) {
      throw new Error("Invalid orders data received");
    }

    // Enrich orders with product details
    const enrichedOrders = await Promise.all(
      orders.map(async (order) => {
        try {
          const sellerProducts = order.products.filter(p => 
            p.sellerId === user.user_id.toString()
          );

          const productsWithDetails = await Promise.all(
            sellerProducts.map(async (product) => {
              try {
                const productResponse = await axios.get(
                  `${API_ORDER_URL}/products/${product.productId}`,
                  { headers: { Authorization: `Bearer ${accessToken}` } }
                );
                return { ...product, details: productResponse.data };
              } catch (productError) {
                console.error(`Product fetch error: ${product.productId}`, productError.message);
                return { ...product, details: { title: "Unknown Product" } };
              }
            })
          );

          return {
            ...order,
            products: productsWithDetails,
            totalAmount: productsWithDetails.reduce(
              (sum, p) => sum + (p.details.price * p.quantity), 
              0
            )
          };
        } catch (orderError) {
          console.error(`Order processing error: ${order._id}`, orderError.message);
          return null; // Skip faulty orders
        }
      })
    );

    // Filter out null values from failed order processing
    const validOrders = enrichedOrders.filter(order => order !== null);

    res.render("pages/orders/sellerOrders", { 
      orders: validOrders,
      sellerId: user.user_id 
    });

  } catch (error) {
    console.error("Critical error in seller orders route:", error.message);
    res.status(500).render("pages/orders/sellerOrders", { 
      orders: [], 
      error: error.message || "Failed to load orders" 
    });
  }
});
module.exports = router;
