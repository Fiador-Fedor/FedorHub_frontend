const multer = require('multer');
const path = require('path');

// Set up storage for multer (optional for local storage, temporary processing)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, 'temp')); // Temporary storage
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname)); // Unique name
  },
});

const upload = multer({ storage }); // Configure multer with storage

module.exports = upload;
