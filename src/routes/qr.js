const express = require('express');
const { body, validationResult } = require('express-validator');
const QRService = require('../services/qrService');
const auth = require('../middleware/auth');
const router = express.Router();

/**
 * @route   POST /api/qr/generate
 * @desc    Generate a new QR code
 * @access  Private
 */
router.post('/generate', auth, [
  body('type').isIn(['item', 'pet']).withMessage('Type must be either item or pet'),
  body('details.name').notEmpty().withMessage('Name is required'),
  body('contact.phone').isMobilePhone().withMessage('Valid phone number is required'),
  body('contact.email').isEmail().withMessage('Valid email is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { type, details, contact } = req.body;
    const ownerId = req.user.id;

    const result = await QRService.createQRCode(ownerId, type, details, contact);

    res.status(201).json({
      success: true,
      message: 'QR code generated successfully',
      data: {
        qrCode: result.qrCode,
        qrImageDataURL: result.qrImageDataURL,
        qrUrl: result.qrUrl
      }
    });
  } catch (error) {
    console.error('QR generation error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * @route   GET /api/qr/user
 * @desc    Get user's QR codes
 * @access  Private
 */
router.get('/user', auth, async (req, res) => {
  try {
    const qrCodes = await QRService.getUserQRCodes(req.user.id);
    
    res.json({
      success: true,
      data: qrCodes
    });
  } catch (error) {
    console.error('Get user QR codes error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * @route   GET /api/qr/:code
 * @desc    Get QR code details by code
 * @access  Public
 */
router.get('/:code', async (req, res) => {
  try {
    const { code } = req.params;
    const qrCode = await QRService.getQRCodeByCodePublic(code);

    // Check if QR code is inactive
    if (qrCode.status === 'inactive') {
      return res.status(403).json({
        success: false,
        message: 'This QR code is currently inactive. The owner has temporarily disabled it.',
        status: 'inactive'
      });
    }

    res.json({
      success: true,
      data: {
        code: qrCode.code,
        type: qrCode.type,
        isActivated: qrCode.isActivated,
        status: qrCode.status,
        details: qrCode.details,
        contact: qrCode.contact,
        settings: qrCode.settings,
        qrUrl: qrCode.qrUrl
      }
    });
  } catch (error) {
    console.error('Get QR code error:', error);
    res.status(404).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * @route   POST /api/qr/:code/activate
 * @desc    Activate QR code with details
 * @access  Public
 */
router.post('/:code/activate', [
  body('contact.name').notEmpty().withMessage('Full name is required'),
  body('contact.phone').notEmpty().withMessage('Phone number is required'),
  body('contact.email').isEmail().withMessage('Valid email is required'),
  body('details.name').notEmpty().withMessage('Item/Pet name is required')
], async (req, res) => {
  try {
    console.log('Activation request received:', {
      code: req.params.code,
      body: req.body,
      headers: req.headers
    });
    
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('Validation errors:', errors.array());
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { code } = req.params;
    const activationData = req.body;

    // Find or create user account first
    const User = require('../models/User');
    let user = await User.findOne({ email: activationData.contact.email });
    let tempPassword = null;
    
    if (!user) {
      console.log('Creating new user for email:', activationData.contact.email);
      
      // Generate temporary password first
      tempPassword = Math.random().toString(36).slice(-8).toUpperCase();
      console.log('Generated temp password for new user:', tempPassword);
      
      // Create new user with the temporary password (pre-save hook will hash it)
      user = new User({
        name: activationData.contact.name || activationData.details.name,
        email: activationData.contact.email,
        phone: activationData.contact.phone,
        password: tempPassword, // Will be hashed by pre-save hook
        isEmailVerified: true,
        role: 'user'
      });
      
      // Set temp password fields
      user.tempPassword = tempPassword;
      user.tempPasswordExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
      
      await user.save();
      console.log('New user created:', user.email, user.name);
      console.log('Final hashed password:', user.password);
      
      // Send welcome email with temporary password
      try {
        const emailService = require('../services/emailService');
        await emailService.sendTempPasswordEmail(
          activationData.contact.email,
          activationData.contact.name || activationData.details.name,
          tempPassword
        );
        console.log('Welcome email sent to new user');
      } catch (emailError) {
        console.error('Failed to send welcome email:', emailError);
      }
    } else {
      console.log('User already exists:', user.email, user.name);
      // Don't change password for existing users
      
      // Send email with existing credentials to existing user
      try {
        const emailService = require('../services/emailService');
        await emailService.sendExistingUserQRActivationEmail(
          user.email,
          user.name,
          activationData.details.name,
          activationData.contact.email // This is the same as user.email, but keeping for clarity
        );
        console.log('Existing user QR activation email sent');
      } catch (emailError) {
        console.error('Failed to send existing user email:', emailError);
      }
    }

    // Check if QR code is already activated (use fast method)
    const existingQRCode = await QRService.getQRCodeByCodeForOwnership(code);
    
    if (existingQRCode.isActivated) {
      // Check if it's activated by the same user
      if (existingQRCode.owner && existingQRCode.owner.toString() === user._id.toString()) {
        console.log('QR code already activated by same user:', user.email);
        return res.json({
          success: true,
          message: 'QR code is already activated by you',
          data: {
            qrCode: existingQRCode,
            qrUrl: existingQRCode.qrUrl,
            tempPassword: tempPassword, // Only for new users
            isNewUser: !!tempPassword,
            user: {
              email: user.email,
              name: user.name,
              // For existing users, return their temp password if it exists, otherwise indicate they should use their existing password
              existingPassword: !tempPassword ? (user.tempPassword || 'Your existing password') : null
            }
          }
        });
      } else {
        return res.status(400).json({
          success: false,
          message: 'This QR code has already been activated by another user'
        });
      }
    }

    // Now activate the QR code with the user ID
    const qrCode = await QRService.activateQRCode(code, activationData, user._id);
    console.log('QR code activated for user:', user.email);
    
    res.json({
      success: true,
      message: 'QR code activated successfully',
      data: {
        qrCode,
        qrUrl: qrCode.qrUrl,
        tempPassword: tempPassword, // Only for new users
        isNewUser: !!tempPassword,
        user: {
          email: user.email,
          name: user.name,
          // For existing users, return their temp password if it exists, otherwise indicate they should use their existing password
          existingPassword: !tempPassword ? (user.tempPassword || 'Your existing password') : null
        }
      }
    });
  } catch (error) {
    console.error('QR activation error:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * @route   POST /api/qr/:code/scan
 * @desc    Handle QR code scan
 * @access  Public
 */
router.post('/:code/scan', async (req, res) => {
  try {
    const { code } = req.params;
    const scanData = {
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent'),
      location: req.body.location || 'Unknown'
    };

    const result = await QRService.handleScan(code, scanData);

    res.json({
      success: true,
      message: 'QR code scanned successfully',
      data: result.scanData
    });
  } catch (error) {
    console.error('QR scan error:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * @route   POST /api/qr/:code/found
 * @desc    Report item/pet as found
 * @access  Public
 */
router.post('/:code/found', [
  body('finderName').notEmpty().withMessage('Finder name is required'),
  body('finderPhone').isMobilePhone().withMessage('Valid finder phone is required'),
  body('foundLocation').notEmpty().withMessage('Found location is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { code } = req.params;
    const finderDetails = req.body;

    const qrCode = await QRService.reportFound(code, finderDetails);

    res.json({
      success: true,
      message: 'Item/Pet reported as found successfully',
      data: {
        qrCode,
        finderDetails
      }
    });
  } catch (error) {
    console.error('Report found error:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * @route   GET /api/qr/user/:userId
 * @desc    Get user's QR codes
 * @access  Private
 */
router.get('/user/:userId', auth, async (req, res) => {
  try {
    const { userId } = req.params;
    const { type } = req.query;

    // Check if user is accessing their own data
    if (req.user.id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const qrCodes = await QRService.getUserQRCodes(userId, type);

    res.json({
      success: true,
      data: qrCodes
    });
  } catch (error) {
    console.error('Get user QR codes error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * @route   PUT /api/qr/:code
 * @desc    Update QR code details
 * @access  Private
 */
router.put('/:code', auth, [
  body('details.name').optional().notEmpty().withMessage('Name cannot be empty'),
  body('contact.phone').optional().isMobilePhone().withMessage('Valid phone number is required'),
  body('contact.email').optional().isEmail().withMessage('Valid email is required'),
  body('settings.instantAlerts').optional().isBoolean().withMessage('Instant alerts must be boolean'),
  body('settings.locationSharing').optional().isBoolean().withMessage('Location sharing must be boolean'),
  body('settings.showContactOnFinderPage').optional().isBoolean().withMessage('Show contact on finder page must be boolean')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { code } = req.params;
    const updateData = req.body;

    // Verify ownership
    const qrCode = await QRService.getQRCodeByCodeForOwnership(code);
    if (qrCode.owner.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const updatedQRCode = await QRService.updateQRCode(code, updateData);

    res.json({
      success: true,
      message: 'QR code updated successfully',
      data: updatedQRCode
    });
  } catch (error) {
    console.error('Update QR code error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * @route   DELETE /api/qr/:code
 * @desc    Deactivate QR code
 * @access  Private
 */
router.delete('/:code', auth, async (req, res) => {
  try {
    const { code } = req.params;

    // Verify ownership
    const qrCode = await QRService.getQRCodeByCodeForOwnership(code);
    if (qrCode.owner.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Actually delete the QR code
    const QRCodeModel = require('../models/QRCode');
    await QRCodeModel.findOneAndDelete({ code });

    res.json({
      success: true,
      message: 'QR code deleted successfully'
    });
  } catch (error) {
    console.error('Deactivate QR code error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * @route   POST /api/qr/:code/send-update-otp
 * @desc    Send OTP for contact information update
 * @access  Private
 */
router.post('/:code/send-update-otp', auth, [
  body('newEmail').optional().isEmail().withMessage('Valid email is required'),
  body('newPhone').optional().isMobilePhone().withMessage('Valid phone number is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { code } = req.params;
    const { newEmail, newPhone } = req.body;

    console.log('Send update OTP request:', { code, newEmail, newPhone });

    // Verify ownership
    const qrCode = await QRService.getQRCodeByCodeForOwnership(code);
    if (qrCode.owner.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    console.log('Generated OTP:', otp, 'Expires:', otpExpires);

    // Store OTP in QR code document
    await QRService.storeUpdateOTP(code, otp, otpExpires, newEmail, newPhone);

    // Send OTP via email
    const emailService = require('../services/emailService');
    if (newEmail) {
      // Send to new email if email is being changed
      console.log('Sending OTP to new email:', newEmail);
      await emailService.sendContactUpdateOTP(newEmail, otp);
    } else {
      // Send to current email if only phone is being changed
      const currentEmail = qrCode.contact?.email;
      console.log('Sending OTP to current email:', currentEmail);
      if (currentEmail) {
        await emailService.sendContactUpdateOTP(currentEmail, otp);
      } else {
        console.error('No current email found for QR code');
      }
    }

    res.json({
      success: true,
      message: newEmail ? 'OTP sent to new email address' : 'OTP sent to current email address',
      otpExpires: otpExpires
    });

  } catch (error) {
    console.error('Send update OTP error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * @route   POST /api/qr/:code/verify-update-otp
 * @desc    Verify OTP and update contact information
 * @access  Private
 */
router.post('/:code/verify-update-otp', auth, [
  body('otp').isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits'),
  body('updateData').isObject().withMessage('Update data is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { code } = req.params;
    const { otp, updateData } = req.body;

    // Verify ownership
    const qrCode = await QRService.getQRCodeByCodeForOwnership(code);
    if (qrCode.owner.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Verify OTP
    const isOTPValid = await QRService.verifyUpdateOTP(code, otp);
    if (!isOTPValid) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired OTP'
      });
    }

    // Update QR code with verified data
    const updatedQRCode = await QRService.updateQRCode(code, updateData);

    // Clear OTP after successful update
    await QRService.clearUpdateOTP(code);

    res.json({
      success: true,
      message: 'Contact information updated successfully',
      data: updatedQRCode
    });

  } catch (error) {
    console.error('Verify update OTP error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * @route   PATCH /api/qr/:code/toggle-status
 * @desc    Toggle QR code active/inactive status
 * @access  Private
 */
router.patch('/:code/toggle-status', auth, async (req, res) => {
  try {
    const { code } = req.params;

    // Verify ownership
    const qrCode = await QRService.getQRCodeByCodeForOwnership(code);
    if (qrCode.owner.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Toggle status
    const newStatus = qrCode.status === 'active' ? 'inactive' : 'active';
    const updatedQRCode = await QRService.toggleQRCodeStatus(code, newStatus);

    res.json({
      success: true,
      message: `QR code ${newStatus === 'active' ? 'activated' : 'deactivated'} successfully`,
      data: {
        code: updatedQRCode.code,
        status: updatedQRCode.status,
        isActive: updatedQRCode.status === 'active'
      }
    });

  } catch (error) {
    console.error('Toggle QR code status error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * @route   POST /api/qr/:code/track-scan
 * @desc    Track QR code scan
 * @access  Public
 */
router.post('/:code/track-scan', async (req, res) => {
  try {
    const { code } = req.params;
    const scanData = {
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent'),
      location: req.body.location || 'unknown'
    };

    const result = await QRService.trackScan(code, scanData);

    res.json({
      success: true,
      message: 'Scan tracked successfully',
      data: result
    });

  } catch (error) {
    console.error('Track scan error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;
