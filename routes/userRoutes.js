const express = require('express');
const User = require('../Models/User');
const jwt = require('jsonwebtoken');
const router = express.Router();

// Register route
router.post('/register', async (req, res) => {
  const { name, email, password } = req.body;
  try {
    // Check if user already exists
    console.log( req.body)
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }
    
    // Create new user
    const user = new User({ name, email, password });
    await user.save();
    res.status(201).json({ message: 'User registered successfully' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Login route
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    // Create JWT token
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: '1h',
    });

    const cookieOptions = {
      httpOnly: true,  // Prevents JavaScript access to cookies
      secure: process.env.NODE_ENV === 'production', // Only set the secure flag in production with HTTPS
      sameSite: 'Strict', // Adjust based on your needs
      maxAge: 3600000, // 1 hour
    };

    // Log the cookie options for debugging
    console.log("Setting cookie with options:", cookieOptions);

    // Set token as a cookie
    res.cookie('token', token, cookieOptions).json({ message: 'Login successful' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/logout', (req, res) => {
  // Clear the token cookie
  res.cookie('token', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production', // Only set the secure flag in production with HTTPS
    sameSite: 'Strict', // Adjust based on your needs
    expires: new Date(0), // Set the expiration date to the past
  }).json({ message: 'Logout successful' });
});


module.exports = router;
