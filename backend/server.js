require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');




const app = express();
app.set('trust proxy', 1); // Trust reverse proxy (Render) to allow secure cookies

const allowedOrigins = ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:3000'];
if (process.env.FRONTEND_URL) {
  allowedOrigins.push(process.env.FRONTEND_URL);
}

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true
  }
});

app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));

app.use(express.json({ limit: '10kb' })); // Body parser with size limit
app.use(express.urlencoded({ extended: true, limit: '10kb' })); // URL encoded parser
app.use(cookieParser());

// SECURITY MIDDLEWARE
app.use(helmet()); // Set security HTTP headers




const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 mins
  max: 300, // limit each IP to 300 requests per window
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api', limiter);

// Set up a public namespace for unauthenticated clients (QR Menu)
const publicIo = io.of('/public');

// Expose io and publicIo to routes
app.use((req, res, next) => {
  req.io = io;
  req.publicIo = publicIo;
  next();
});

// Simple test route
app.get('/api/internal/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// Import and mount routers
const authRoutes = require('./routes/auth');
const menuRoutes = require('./routes/menu');
const inventoryRoutes = require('./routes/inventory');
const orderRoutes = require('./routes/orders');
const recipeRoutes = require('./routes/recipes');
const userRoutes = require('./routes/users');
const shiftRoutes = require('./routes/shifts');
const analyticsRoutes = require('./routes/analytics');
const bookingRoutes = require('./routes/bookings');

// Mount routes under /api (removed /internal per spec)
app.use('/api/auth', authRoutes);
app.use('/api/menu', menuRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/recipes', recipeRoutes);
app.use('/api/users', userRoutes);
app.use('/api/shifts', shiftRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/bookings', bookingRoutes);

const PORT = process.env.PORT || 5001;
const MONGO_URI = process.env.MONGO_URI;

// Socket.io Authentication Middleware
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) {
    return next(new Error('Authentication error: No token'));
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.user = decoded;
    next();
  } catch (err) {
    next(new Error('Authentication error: Invalid token'));
  }
});

// Global Error Handler — prevent stack trace leaks in production
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    message: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message
  });
});

mongoose.connect(MONGO_URI)
  .then(() => {
    console.log('Connected to MongoDB');
    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch(err => {
    console.error('MongoDB connection error:', err);
  });

io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id} (User: ${socket.user.id})`);
  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
  });
});

publicIo.on('connection', (socket) => {
  console.log(`Public client connected: ${socket.id}`);
  socket.on('disconnect', () => {
    console.log(`Public client disconnected: ${socket.id}`);
  });
});
