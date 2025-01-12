const express = require('express');
const router = express.Router();
const axios = require('axios');

const API_AUTH_URL = process.env.API_AUTH_URL;

// Landing Page
router.get('/', (req, res) => {
  res.render('pages/landing', { user: req.session.user, title: "FedorHub" });
});

// Register Page
router.get('/register', (req, res) => {
  res.render('pages/register', { error: null, title: "Register - E-Commerce" });
});

// Login Page
router.get('/login', (req, res) => {
  res.render('pages/login', { 
    error: null, 
	API_AUTH_URL: process.env.API_AUTH_URL,
    title: "Login - E-Commerce" 
  });
});

// Home Page
router.get('/home', (req, res) => {
  console.log('session pro:',req.session.user);
  if (!req.session.user) return res.redirect('/login');
  res.render('pages/home', {
    user: req.session.user,
	error: null,
    title: "Home - FedorHub",
	cartCount: res.locals.cartCount,
  });
});


// Get Profile Page
router.get("/profile", async (req, res) => {
  try {
    const { accessToken } = req.session;

    // Fetch complete user profile data
    const userId = req.session.user.id;
    console.log("Fetching profile for User ID:", userId);

    const { data } = await axios.get(`${API_AUTH_URL}/profile/${userId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    console.log('data:', data);

    res.render("pages/profile", {
      user: data,
      title: "Profile - FedorHub",
    });
  } catch (error) {
    // Debugging: Log the error message and stack trace
    console.error("Error fetching profile:", error.message);
    console.error("Error stack trace:", error.stack);
    
    // Send a user-friendly error message
    res.status(500).send("Error loading profile data");
  }
});


// Edit Profile Page
router.get('/edit', (req, res) => {
  res.render('pages/editProfile', { error: null, title: "Edit Profile - FedorHub" });
});


// Logout Page
router.get("/logout", (req, res) => {
  console.log('session pro:',req.session.user);
  if (!req.session.user) {
    // If the user is not logged in, redirect them to the login page or home
    return res.redirect('/login');
  }

  res.render("pages/logout", {
    title: "Logout - FedorHub",
    user: req.session.user,
    message: "Are you sure you want to log out?",
    API_AUTH_URL: process.env.API_AUTH_URL,
  });
});


module.exports = router;
