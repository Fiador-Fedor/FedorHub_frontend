const express = require("express");
const axios = require("axios");

const router = express.Router();
const API_CATEGORY_URL = process.env.API_CATEGORY_URL;

// Middleware to ensure user authentication using session
const ensureAuthenticated = (req, res, next) => {
  const { user, accessToken } = req.session;
  if (user && accessToken) {
    next();
  } else {
    res.redirect("/login");
  }
};

// Display all categories
router.get("/", ensureAuthenticated, async (req, res) => {
  try {
    const { accessToken } = req.session;
    const response = await axios.get(`${API_CATEGORY_URL}/`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
	
    res.render("pages/categories/index", { categories: response.data.data });
  } catch (error) {
    console.error("Error fetching categories:", error.message);
    res.render("pages/categories/index", { categories: [], error: error.message });
  }
});

// Add a category page
router.get("/add", ensureAuthenticated, (req, res) => {
  res.render("pages/categories/add");
});

// Add a new category
router.post("/add", ensureAuthenticated, async (req, res) => {
  try {
    const { accessToken } = req.session;
    const { name } = req.body;

    const response = await axios.post(
      `${API_CATEGORY_URL}/`,
      { name },
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    res.redirect("/categories");
  } catch (error) {
    console.error("Error adding category:", error.message);
    res.render("pages/categories/add", { error: error.message });
  }
});

// Edit category page
router.get("/:id/edit", ensureAuthenticated, async (req, res) => {
  try {
    const { accessToken } = req.session;
    const { id } = req.params;

    const response = await axios.get(`${API_CATEGORY_URL}/${id}/edit`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    res.render("pages/categories/edit", { category: response.data.data });
  } catch (error) {
    console.error("Error fetching category for edit:", error.message);
    res.redirect("/categories");
  }
});

// Update category
router.post("/:id/edit", ensureAuthenticated, async (req, res) => {
  try {
    const { accessToken } = req.session;
    const { id } = req.params;
    const { name } = req.body;

    await axios.post(
      `${API_CATEGORY_URL}/${id}`,
      { name },
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    res.redirect("/categories");
  } catch (error) {
    console.error("Error updating category:", error.message);
    res.redirect("/categories");
  }
});

// Delete category
router.post("/:id/delete", ensureAuthenticated, async (req, res) => {
  try {
    const { accessToken } = req.session;
    const { id } = req.params;

    const response = await axios.post(
      `${API_CATEGORY_URL}/${id}/delete`,
      {},
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (response.status === 200) {
      res.redirect("/categories");
    } else {
      res.redirect("/categories");
    }
  } catch (error) {
    console.error("Error deleting category:", error.message);
    res.redirect("/categories");
  }
});

module.exports = router;
