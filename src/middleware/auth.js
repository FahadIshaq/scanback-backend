const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Authentication middleware
 */
const auth = async (req, res, next) => {
  try {
    const authHeader = req.header('Authorization');
    console.log('Auth header:', authHeader);
    
    const token = authHeader?.replace('Bearer ', '');
    console.log('Extracted token:', token ? 'Present' : 'Missing');
    
    if (!token) {
      console.log('No token provided');
      return res.status(401).json({
        success: false,
        message: 'No token provided, access denied'
      });
    }

    console.log('Verifying token with secret:', process.env.JWT_SECRET ? 'Present' : 'Missing');
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret');
    console.log('Decoded token:', decoded);
    
    const user = await User.findById(decoded.userId).select('-password');
    console.log('Found user:', user ? user.email : 'Not found');
    
    if (!user) {
      console.log('User not found for token');
      return res.status(401).json({
        success: false,
        message: 'Token is not valid'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(401).json({
      success: false,
      message: 'Token is not valid'
    });
  }
};

module.exports = auth;
