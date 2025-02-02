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

    const response = await axios.post(`${API_AUTH_URL}/login`, {
      username,
      password,
    });

    console.log("Authentication service response:", response.data);

    const { accessToken, refreshToken, user } = response.data;

    req.session.accessToken = accessToken;
    req.session.refreshToken = refreshToken;
    req.session.user = user;

    console.log("Tokens and user details stored successfully in session.");

    res.redirect("/home");
  } catch (error) {
    console.error("Login Error:", error.response?.data || error.message);
    const errorMessage =  error.response?.data?.error || "Login failed. Please try again.";
    res.render("pages/login", { error: errorMessage });
  }
});

// Add this new route handler for displaying the forgot password page
router.get("/forgot-password", (req, res) => {
  res.render("pages/forgot-password", { error: null, success: null });
});


// Forgot Password Handler
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    console.log("Received forgot password request for email:", email);

    const response = await axios.post(`${API_AUTH_URL}/forgot-password`, {
      email,
    });

    console.log("Password reset email sent successfully");
    res.render("pages/forgot-password", {
      success: "Password reset instructions have been sent to your email.",
    });
  } catch (error) {
    console.error("Forgot Password Error:", error.response?.data || error.message);
    const errorMessage =
      error.response?.data?.error || "Failed to process password reset request.";
    res.render("pages/forgot-password", { error: errorMessage });
  }
});
// Reset Password Page Display - Single handler for GET
router.get("/reset-password", (req, res) => {
  const { token } = req.query;
  
  if (!token) {
    return res.redirect('/login?message=Invalid password reset link');
  }

  res.render("pages/reset-password", { 
    token,
    error: null,
    message: req.query.message 
  });
});

// Reset Password Submit Handler - Single handler for POST
router.post("/reset-password", async (req, res) => {
  try {
    const { token, newPassword, confirmPassword } = req.body;
    
    if (!token) {
      return res.redirect('/login?message=Invalid password reset request');
    }

    if (!newPassword || !confirmPassword) {
      return res.render("pages/reset-password", {
        token,
        error: "Both password fields are required"
      });
    }
    
    if (newPassword !== confirmPassword) {
      return res.render("pages/reset-password", {
        token,
        error: "Passwords do not match"
      });
    }

    await axios.post(`${API_AUTH_URL}/reset-password`, {
      token,
      newPassword
    });

    res.redirect("/login?message=Password reset successful. Please login with your new password.");

  } catch (error) {
    console.error("Reset Password Error:", error.response?.data || error.message);
    res.render("pages/reset-password", {
      token,
      error: error.response?.data?.error || "Failed to reset password. Please try again."
    });
  }
});



// Edit Profile Handler
router.post('/edit', upload.single('profileImage'), async (req, res) => {
  try {
    const { accessToken } = req.session;

    console.log("Access Token:", accessToken);
    console.log("User Session Data:", req.session.user);

    const formData = new FormData();

    console.log("Request Body:", req.body);

    for (const key in req.body) {
      formData.append(key, req.body[key]);
    }

    if (req.file) {
      console.log("File details:", req.file);
      formData.append('profileImage', req.file.buffer, req.file.originalname); 
    } else {
      console.log("No file uploaded.");
    }

    console.log("Form Data Contents:", formData);

    const response = await axios.put(`${API_AUTH_URL}/profile/edit`, formData, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...formData.getHeaders(),
      },
    });

    console.log("Response from API:", response.data);

    req.session.user = { ...req.session.user, ...response.data.user }; 
    res.redirect('/profile');
  } catch (error) {
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
    const refreshToken = req.session.refreshToken;
    const user = req.session.user;

    if (!user || !refreshToken) {
      console.warn("Logout attempt by unauthenticated user.");
      return res.status(401).json({ error: "User not logged in." });
    }

    console.log("Logging out user:", user.id);

    const { data } = await axios.post(`${process.env.API_AUTH_URL}/logout`, {
      userId: user.id,
    });

    if (data.error) {
      console.error("Failed to revoke refresh token:", data.error);
      return res.status(500).json({ error: "Failed to revoke token." });
    }

    console.log("Refresh token revoked successfully.");

    req.session.destroy((err) => {
      if (err) {
        console.error("Error destroying session:", err);
        return res
          .status(500)
          .json({ error: "Failed to log out. Please try again." });
      }

      console.log("Session destroyed successfully.");
      res.clearCookie("connect.sid");
      res.redirect("/login");
    });
  } catch (error) {
    console.error("Logout Error:", error.message || error);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;