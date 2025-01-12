const express = require("express");
const axios = require("axios");
const FormData = require("form-data");
const router = express.Router();
const multer = require('multer');

const storage = multer.memoryStorage();
const upload = multer({ storage });

const API_AUTH_URL = process.env.API_AUTH_URL;

// Register Handler
router.post("/register", async (req, res) => {
  try {
    const { username, email, password, role } = req.body;
    await axios.post(`${API_AUTH_URL}/register`, {
      username,
      email,
      password,
      role,
    });
    res.redirect("/login");
  } catch (error) {
    res.render("pages/register", {
      error: error.response?.data?.message || "Registration failed.",
    });
  }
});

// Login Handler
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    console.log("Received login request:", { username, password });

    // Send a login request to the authentication service
    const response = await axios.post(`${API_AUTH_URL}/login`, {
      username,
      password,
    });

    console.log("Authentication service response:", response.data);

    // Extract tokens and user details from the response
    const { accessToken, refreshToken, user } = response.data;

    // Store tokens and user details in the session
    req.session.accessToken = accessToken;
    req.session.refreshToken = refreshToken;
    req.session.user = user;

    console.log("Tokens and user details stored successfully in session.");

    // Redirect to the profile page
    res.redirect("/home");
  } catch (error) {
    console.error("Login Error:", error.response?.data || error.message);
    const errorMessage =
      error.response?.data?.error || "Login failed. Please try again.";
    res.render("pages/login", { error: errorMessage });
  }
});


// Edit Profile Handler
router.post('/edit', upload.single('profileImage'), async (req, res) => {
  try {
    const { accessToken } = req.session;

    // Debugging: Log the access token and user session
    console.log("Access Token:", accessToken);
    console.log("User Session Data:", req.session.user);

    // The profileImage file will now be attached to `req.file`
    const formData = new FormData();

    // Debugging: Log request body
    console.log("Request Body:", req.body);

    for (const key in req.body) {
      formData.append(key, req.body[key]);
    }

    // Pass the file data from req.file if provided
    if (req.file) {
      console.log("File details:", req.file); // Log file details
      formData.append('profileImage', req.file.buffer, req.file.originalname); 
    } else {
      console.log("No file uploaded.");
    }

    // Debugging: Log FormData contents
    console.log("Form Data Contents:", formData);

    // Continue with the Axios request
    const response = await axios.put(`${API_AUTH_URL}/profile/edit`, formData, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...formData.getHeaders(),
      },
    });

    // Debugging: Log response from the server
    console.log("Response from API:", response.data);

    // Update session with new user data
    req.session.user = { ...req.session.user, ...response.data.user }; 
    res.redirect('/profile');
  } catch (error) {
    // Debugging: Log error details
    console.error('Error editing profile:', error.message || error.response?.data);
    
    if (error.response) {
      console.error("Error Response Data:", error.response.data);
      console.error("Error Response Status:", error.response.status);
      console.error("Error Response Headers:", error.response.headers);
    }

    res.render('pages/editProfile', {
      user: req.session.user,
      error: 'Failed to update profile. Please try again.',
    });
  }
});



// Logout Handler
router.post("/logout", async (req, res) => {
  try {
    // Retrieve the user's ID and refresh token from session
    const refreshToken = req.session.refreshToken;
    const user = req.session.user;

    if (!user || !refreshToken) {
      console.warn("Logout attempt by unauthenticated user.");
      return res.status(401).json({ error: "User not logged in." });
    }

    console.log("Logging out user:", user.id);

    // Step 1: Send request to revoke the refresh token
    const { data } = await axios.post(`${process.env.API_AUTH_URL}/logout`, {
      userId: user.id,
    });

    if (data.error) {
      console.error("Failed to revoke refresh token:", data.error);
      return res.status(500).json({ error: "Failed to revoke token." });
    }

    console.log("Refresh token revoked successfully.");

    // Step 2: Destroy the session and clear tokens and user data
    req.session.destroy((err) => {
      if (err) {
        console.error("Error destroying session:", err);
        return res
          .status(500)
          .json({ error: "Failed to log out. Please try again." });
      }

      console.log("Session destroyed successfully.");
      res.clearCookie("connect.sid"); // Clear session cookie

      // Redirect to login or home page after logout
      res.redirect("/login");
    });
  } catch (error) {
    console.error("Logout Error:", error.message || error);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
