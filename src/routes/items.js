const express = require('express');
const { body, validationResult } = require('express-validator');
const QRService = require('../services/qrService');
const auth = require('../middleware/auth');
const router = express.Router();

/**
 * @route   POST /api/items/create
 * @desc    Create a new item QR code
 * @access  Private
 */
router.post('/create', auth, [
  body('name').notEmpty().withMessage('Item name is required'),
  body('description').optional().isString(),
  body('category').optional().isString(),
  body('color').optional().isString(),
  body('brand').optional().isString(),
  body('model').optional().isString(),
  body('serialNumber').optional().isString(),
  body('value').optional().isNumeric().withMessage('Value must be a number'),
  body('purchaseDate').optional().isISO8601().withMessage('Purchase date must be valid'),
  body('warrantyExpiry').optional().isISO8601().withMessage('Warranty expiry must be valid'),
  body('contact.phone').isMobilePhone().withMessage('Valid phone number is required'),
  body('contact.email').isEmail().withMessage('Valid email is required'),
  body('contact.message').optional().isString()
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

    const {
      name,
      description,
      category,
      color,
      brand,
      model,
      serialNumber,
      value,
      purchaseDate,
      warrantyExpiry,
      contact
    } = req.body;

    const details = {
      name,
      description,
      category,
      color,
      brand,
      model,
      serialNumber,
      value: value ? parseFloat(value) : undefined,
      purchaseDate: purchaseDate ? new Date(purchaseDate) : undefined,
      warrantyExpiry: warrantyExpiry ? new Date(warrantyExpiry) : undefined
    };

    const result = await QRService.createQRCode(req.user.id, 'item', details, contact);

    res.status(201).json({
      success: true,
      message: 'Item QR code created successfully',
      data: {
        qrCode: result.qrCode,
        qrImageDataURL: result.qrImageDataURL,
        qrUrl: result.qrUrl
      }
    });
  } catch (error) {
    console.error('Create item error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * @route   GET /api/items
 * @desc    Get user's items
 * @access  Private
 */
router.get('/', auth, async (req, res) => {
  try {
    const items = await QRService.getUserQRCodes(req.user.id, 'item');

    res.json({
      success: true,
      data: items
    });
  } catch (error) {
    console.error('Get items error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * @route   GET /api/items/:id
 * @desc    Get specific item
 * @access  Private
 */
router.get('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const item = await QRService.getQRCodeByCode(id);

    // Check ownership
    if (item.owner.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    res.json({
      success: true,
      data: item
    });
  } catch (error) {
    console.error('Get item error:', error);
    res.status(404).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * @route   PUT /api/items/:id
 * @desc    Update item details
 * @access  Private
 */
router.put('/:id', auth, [
  body('name').optional().notEmpty().withMessage('Name cannot be empty'),
  body('description').optional().isString(),
  body('category').optional().isString(),
  body('color').optional().isString(),
  body('brand').optional().isString(),
  body('model').optional().isString(),
  body('serialNumber').optional().isString(),
  body('value').optional().isNumeric().withMessage('Value must be a number'),
  body('purchaseDate').optional().isISO8601().withMessage('Purchase date must be valid'),
  body('warrantyExpiry').optional().isISO8601().withMessage('Warranty expiry must be valid'),
  body('contact.phone').optional().isMobilePhone().withMessage('Valid phone number is required'),
  body('contact.email').optional().isEmail().withMessage('Valid email is required'),
  body('contact.message').optional().isString()
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

    const { id } = req.params;
    const updateData = req.body;

    // Verify ownership
    const item = await QRService.getQRCodeByCode(id);
    if (item.owner.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const updatedItem = await QRService.updateQRCode(id, updateData);

    res.json({
      success: true,
      message: 'Item updated successfully',
      data: updatedItem
    });
  } catch (error) {
    console.error('Update item error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * @route   DELETE /api/items/:id
 * @desc    Deactivate item
 * @access  Private
 */
router.delete('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;

    // Verify ownership
    const item = await QRService.getQRCodeByCode(id);
    if (item.owner.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const deactivatedItem = await QRService.deactivateQRCode(id);

    res.json({
      success: true,
      message: 'Item deactivated successfully',
      data: deactivatedItem
    });
  } catch (error) {
    console.error('Deactivate item error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * @route   POST /api/items/:id/scan
 * @desc    Handle item scan
 * @access  Public
 */
router.post('/:id/scan', async (req, res) => {
  try {
    const { id } = req.params;
    const scanData = {
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent'),
      location: req.body.location || 'Unknown'
    };

    const result = await QRService.handleScan(id, scanData);

    res.json({
      success: true,
      message: 'Item scanned successfully',
      data: result.scanData
    });
  } catch (error) {
    console.error('Item scan error:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * @route   POST /api/items/:id/found
 * @desc    Report item as found
 * @access  Public
 */
router.post('/:id/found', [
  body('finderName').notEmpty().withMessage('Finder name is required'),
  body('finderPhone').isMobilePhone().withMessage('Valid finder phone is required'),
  body('foundLocation').notEmpty().withMessage('Found location is required'),
  body('finderEmail').optional().isEmail().withMessage('Valid finder email is required'),
  body('notes').optional().isString()
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

    const { id } = req.params;
    const finderDetails = req.body;

    const item = await QRService.reportFound(id, finderDetails);

    res.json({
      success: true,
      message: 'Item reported as found successfully',
      data: {
        item,
        finderDetails
      }
    });
  } catch (error) {
    console.error('Report item found error:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;
