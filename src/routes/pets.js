const express = require('express');
const { body, validationResult } = require('express-validator');
const QRService = require('../services/qrService');
const auth = require('../middleware/auth');
const router = express.Router();

/**
 * @route   POST /api/pets/create
 * @desc    Create a new pet QR code
 * @access  Private
 */
router.post('/create', auth, [
  body('name').notEmpty().withMessage('Pet name is required'),
  body('species').notEmpty().withMessage('Species is required'),
  body('breed').optional().isString(),
  body('age').optional().isInt({ min: 0, max: 30 }).withMessage('Age must be between 0 and 30'),
  body('color').optional().isString(),
  body('microchipId').optional().isString(),
  body('description').optional().isString(),
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
      species,
      breed,
      age,
      color,
      microchipId,
      description,
      contact
    } = req.body;

    const details = {
      name,
      species,
      breed,
      age: age ? parseInt(age) : undefined,
      color,
      microchipId,
      description
    };

    const result = await QRService.createQRCode(req.user.id, 'pet', details, contact);

    res.status(201).json({
      success: true,
      message: 'Pet QR code created successfully',
      data: {
        qrCode: result.qrCode,
        qrImageDataURL: result.qrImageDataURL,
        qrUrl: result.qrUrl
      }
    });
  } catch (error) {
    console.error('Create pet error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * @route   GET /api/pets
 * @desc    Get user's pets
 * @access  Private
 */
router.get('/', auth, async (req, res) => {
  try {
    const pets = await QRService.getUserQRCodes(req.user.id, 'pet');

    res.json({
      success: true,
      data: pets
    });
  } catch (error) {
    console.error('Get pets error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * @route   GET /api/pets/:id
 * @desc    Get specific pet
 * @access  Private
 */
router.get('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const pet = await QRService.getQRCodeByCode(id);

    // Check ownership
    if (pet.owner.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    res.json({
      success: true,
      data: pet
    });
  } catch (error) {
    console.error('Get pet error:', error);
    res.status(404).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * @route   PUT /api/pets/:id
 * @desc    Update pet details
 * @access  Private
 */
router.put('/:id', auth, [
  body('name').optional().notEmpty().withMessage('Name cannot be empty'),
  body('species').optional().notEmpty().withMessage('Species cannot be empty'),
  body('breed').optional().isString(),
  body('age').optional().isInt({ min: 0, max: 30 }).withMessage('Age must be between 0 and 30'),
  body('color').optional().isString(),
  body('microchipId').optional().isString(),
  body('description').optional().isString(),
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
    const pet = await QRService.getQRCodeByCode(id);
    if (pet.owner.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const updatedPet = await QRService.updateQRCode(id, updateData);

    res.json({
      success: true,
      message: 'Pet updated successfully',
      data: updatedPet
    });
  } catch (error) {
    console.error('Update pet error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * @route   DELETE /api/pets/:id
 * @desc    Deactivate pet
 * @access  Private
 */
router.delete('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;

    // Verify ownership
    const pet = await QRService.getQRCodeByCode(id);
    if (pet.owner.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const deactivatedPet = await QRService.deactivateQRCode(id);

    res.json({
      success: true,
      message: 'Pet deactivated successfully',
      data: deactivatedPet
    });
  } catch (error) {
    console.error('Deactivate pet error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * @route   POST /api/pets/:id/scan
 * @desc    Handle pet scan
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
      message: 'Pet scanned successfully',
      data: result.scanData
    });
  } catch (error) {
    console.error('Pet scan error:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * @route   POST /api/pets/:id/found
 * @desc    Report pet as found
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

    const pet = await QRService.reportFound(id, finderDetails);

    res.json({
      success: true,
      message: 'Pet reported as found successfully',
      data: {
        pet,
        finderDetails
      }
    });
  } catch (error) {
    console.error('Report pet found error:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * @route   GET /api/pets/species
 * @desc    Get available pet species
 * @access  Public
 */
router.get('/species', (req, res) => {
  const species = [
    'Dog',
    'Cat',
    'Bird',
    'Fish',
    'Hamster',
    'Rabbit',
    'Guinea Pig',
    'Turtle',
    'Snake',
    'Lizard',
    'Horse',
    'Cow',
    'Goat',
    'Sheep',
    'Pig',
    'Chicken',
    'Duck',
    'Other'
  ];

  res.json({
    success: true,
    data: species
  });
});

module.exports = router;
