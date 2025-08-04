const express = require('express');
const crypto = require('crypto');
const User = require('../models/User');
const { generateToken, authenticate, authLimiter, passwordResetLimiter } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');
const nodemailer = require('nodemailer');

const router = express.Router();

// Email transporter setup (configure based on your email provider)
const createEmailTransporter = () => {
  // For development, you can use services like Gmail or SendGrid
  return nodemailer.createTransporter({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: process.env.EMAIL_PORT || 587,
    secure: false,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
};

// Validation rules
const registerValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long')
];

const loginValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
];

const forgotPasswordValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address')
];

const resetPasswordValidation = [
  body('token')
    .notEmpty()
    .withMessage('Reset token is required'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long')
];

// Register route
router.post('/register', authLimiter, registerValidation, async (req, res) => {
  try {
    // Check validation results
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { email, password } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({
        status: 'error',
        message: 'User with this email already exists'
      });
    }

    // Create new user
    const user = new User({
      email,
      password
    });

    await user.save();

    // Generate token
    const token = generateToken(user._id);

    // Remove password from response
    const userResponse = user.toObject();
    delete userResponse.password;

    res.status(201).json({
      status: 'success',
      message: 'User registered successfully',
      data: {
        user: userResponse,
        token
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Registration failed. Please try again.'
    });
  }
});

// Login route
router.post('/login', authLimiter, loginValidation, async (req, res) => {
  try {
    // Check validation results
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { email, password } = req.body;

    // Find user and include password for comparison
    const user = await User.findOne({ email }).select('+password +loginAttempts +lockUntil');
    
    if (!user) {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid email or password'
      });
    }

    // Check if account is locked
    if (user.isLocked) {
      return res.status(423).json({
        status: 'error',
        message: 'Account is temporarily locked due to too many failed login attempts. Please try again later.'
      });
    }

    // Compare password
    const isPasswordCorrect = await user.comparePassword(password);
    
    if (!isPasswordCorrect) {
      // Increment login attempts
      await user.incLoginAttempts();
      return res.status(401).json({
        status: 'error',
        message: 'Invalid email or password'
      });
    }

    // Reset login attempts on successful login
    if (user.loginAttempts > 0) {
      await user.resetLoginAttempts();
    }

    // Generate token
    const token = generateToken(user._id);

    // Remove sensitive data from response
    const userResponse = user.toObject();
    delete userResponse.password;
    delete userResponse.loginAttempts;
    delete userResponse.lockUntil;

    res.json({
      status: 'success',
      message: 'Login successful',
      data: {
        user: userResponse,
        token
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Login failed. Please try again.'
    });
  }
});

// Forgot password route
router.post('/forgot-password', passwordResetLimiter, forgotPasswordValidation, async (req, res) => {
  try {
    // Check validation results
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { email } = req.body;

    // Find user
    const user = await User.findOne({ email });
    
    // Always return success message for security (don't reveal if email exists)
    const successMessage = 'If an account with that email exists, a password reset link has been sent.';
    
    if (!user) {
      return res.json({
        status: 'success',
        message: successMessage
      });
    }

    // Generate reset token
    const resetToken = user.createPasswordResetToken();
    await user.save({ validateBeforeSave: false });

    // Send email (only if email configuration is available)
    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      try {
        const transporter = createEmailTransporter();
        
        const resetURL = `${process.env.CLIENT_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;
        
        const mailOptions = {
          from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
          to: user.email,
          subject: 'Password Reset - Taskify It',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #3182ce;">Password Reset Request</h2>
              <p>You requested a password reset for your Taskify It account.</p>
              <p>Click the button below to reset your password:</p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${resetURL}" style="background-color: #3182ce; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Reset Password</a>
              </div>
              <p style="color: #666; font-size: 14px;">This link will expire in 10 minutes.</p>
              <p style="color: #666; font-size: 14px;">If you didn't request this reset, please ignore this email.</p>
            </div>
          `
        };

        await transporter.sendMail(mailOptions);
      } catch (emailError) {
        console.error('Email sending failed:', emailError);
        // Reset the token if email fails
        user.passwordResetToken = undefined;
        user.passwordResetExpires = undefined;
        await user.save({ validateBeforeSave: false });
        
        return res.status(500).json({
          status: 'error',
          message: 'Failed to send reset email. Please try again.'
        });
      }
    }

    res.json({
      status: 'success',
      message: successMessage
    });

  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Password reset request failed. Please try again.'
    });
  }
});

// Reset password route
router.post('/reset-password', authLimiter, resetPasswordValidation, async (req, res) => {
  try {
    // Check validation results
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { token, password } = req.body;

    // Hash the token to compare with stored hash
    const hashedToken = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    // Find user with valid reset token
    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() }
    }).select('+passwordResetToken +passwordResetExpires');

    if (!user) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid or expired reset token'
      });
    }

    // Update password and clear reset token
    user.password = password;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    
    // Reset any login attempts
    user.loginAttempts = undefined;
    user.lockUntil = undefined;

    await user.save();

    res.json({
      status: 'success',
      message: 'Password reset successful. You can now login with your new password.'
    });

  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Password reset failed. Please try again.'
    });
  }
});

// Get current user (protected route)
router.get('/me', authenticate, async (req, res) => {
  res.json({
    status: 'success',
    data: {
      user: req.user
    }
  });
});

// Logout route (client-side handles token removal)
router.post('/logout', authenticate, (req, res) => {
  res.json({
    status: 'success',
    message: 'Logged out successfully'
  });
});

module.exports = router;