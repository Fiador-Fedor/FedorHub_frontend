require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const { createClient } = require('redis'); // Import Redis client
const {RedisStore} = require("connect-redis");
const favicon = require("serve-favicon");
const path = require('path');
const cors = require('cors');
const axios = require('axios');


const indexRoutes = require('./routes/indexRoutes');
const userRoutes = require('./routes/userRoutes');
const orderRoutes = require('./routes/orders/orderRoutes');
const productRoutes = require('./routes/products/productRoutes');
const categoryRoutes = require('./routes/products/categoryRoutes');
const cartCountMiddleware = require("./middleware/cartCount");
const methodOverride = require('method-override');

axios.defaults.withCredentials = true;

const app = express();

// Create a Redis client
const redisClient = createClient({
  url: process.env.REDIS_URL // Use your Redis URL or connection string
});

redisClient.on('error', (err) => console.error('Redis Client Error:', err));

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(methodOverride('_method'));
app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));


// Configure session to use Redis
app.use(
  session({
    store: new RedisStore({ client: redisClient }), // Correct use of RedisStore
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: {
      secure: false,  // Set to true if using HTTPS in production
      httpOnly: true,
      maxAge: 30 * 60 * 1000 // 30 minutes
    },
  })
);

app.use((req, res, next) => {
  res.locals.user = req.session.user || null; // Attach user to res.locals
  next();
});

app.use('*',cartCountMiddleware);

app.locals.env = process.env;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/', indexRoutes);
app.use('/user', userRoutes);
app.use('/order', orderRoutes);
app.use('/categories', categoryRoutes);
app.use('/products', productRoutes);

// Set default app locals
app.locals.title = "FedorHub";

// Connect to Redis and start the server
redisClient.connect()
  .then(() => {
    console.log("Connected to Redis");
    if (require.main === module) {
      app.listen(process.env.PORT || 4444, () => {
        console.log(`Frontend server is running on http://localhost:${process.env.PORT || 4444}`);
      });
    }
  })
  .catch(err => {
    console.error("Error connecting to Redis:", err);
  });

module.exports = app;
