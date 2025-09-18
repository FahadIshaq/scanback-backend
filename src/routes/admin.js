const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const QRCode = require('../models/QRCode');
const User = require('../models/User');
const Notification = require('../models/Notification');

// Admin middleware - check if user is admin
const adminAuth = (req, res, next) => {
  // For now, we'll allow any authenticated user to access admin routes
  // In production, you should check for admin role
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }
  next();
};

// Get all QR codes with pagination and filters
router.get('/qr-codes', auth, adminAuth, async (req, res) => {
  try {
    const { page = 1, limit = 10, type, status } = req.query;
    const filter = {};
    
    if (type && type !== 'all') filter.type = type;
    if (status && status !== 'all') filter.status = status;

    const qrCodes = await QRCode.find(filter)
      .populate('owner', 'name email phone')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

    const total = await QRCode.countDocuments(filter);
    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: {
        qrCodes,
        totalPages,
        currentPage: parseInt(page),
        total
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get QR code statistics
router.get('/stats', auth, adminAuth, async (req, res) => {
  try {
    const totalQRCodes = await QRCode.countDocuments();
    const activeQRCodes = await QRCode.countDocuments({ status: 'active' });
    const totalUsers = await User.countDocuments();
    const totalScans = await QRCode.aggregate([
      { $group: { _id: null, total: { $sum: '$scanCount' } } }
    ]);

    res.json({
      success: true,
      data: {
        totalQRCodes,
        activeQRCodes,
        totalUsers,
        totalScans: totalScans[0]?.total || 0
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get all users with pagination
router.get('/users', auth, adminAuth, async (req, res) => {
  try {
    const { page = 1, limit = 10, search } = req.query;
    const filter = {};
    
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ];
    }

    const users = await User.find(filter)
      .select('-password')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

    const total = await User.countDocuments(filter);
    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: {
        users,
        totalPages,
        currentPage: parseInt(page),
        total
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get user statistics
router.get('/user-stats', auth, adminAuth, async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const verifiedUsers = await User.countDocuments({ isEmailVerified: true });
    const activeUsers = await User.countDocuments({ status: 'active' });

    res.json({
      success: true,
      data: {
        totalUsers,
        verifiedUsers,
        activeUsers
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update user status
router.put('/users/:userId/status', auth, adminAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    const { status } = req.body;

    const user = await User.findByIdAndUpdate(
      userId,
      { status },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({
      success: true,
      data: { user }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update QR code status
router.put('/qr-codes/:code/status', auth, adminAuth, async (req, res) => {
  try {
    const { code } = req.params;
    const { status } = req.body;

    const qrCode = await QRCode.findOneAndUpdate(
      { code },
      { status },
      { new: true }
    ).populate('owner', 'name email phone');

    if (!qrCode) {
      return res.status(404).json({ success: false, message: 'QR code not found' });
    }

    res.json({
      success: true,
      data: { qrCode }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete QR code
router.delete('/qr-codes/:code', auth, adminAuth, async (req, res) => {
  try {
    const { code } = req.params;

    const qrCode = await QRCode.findOneAndDelete({ code });

    if (!qrCode) {
      return res.status(404).json({ success: false, message: 'QR code not found' });
    }

    res.json({
      success: true,
      message: 'QR code deleted successfully'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get analytics data
router.get('/analytics', auth, adminAuth, async (req, res) => {
  try {
    const { period = '30d' } = req.query;
    
    // Calculate date range based on period
    let days = 30;
    if (period === '7d') days = 7;
    else if (period === '90d') days = 90;
    else if (period === '1y') days = 365;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // QR code creation analytics
    const qrCodeStats = await QRCode.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" }
          },
          count: { $sum: 1 },
          items: { $sum: { $cond: [{ $eq: ["$type", "item"] }, 1, 0] } },
          pets: { $sum: { $cond: [{ $eq: ["$type", "pet"] }, 1, 0] } }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // User registration analytics
    const userStats = await User.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.json({
      success: true,
      data: {
        qrCodeStats,
        userStats,
        period
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get scan history
router.get('/scan-history', auth, adminAuth, async (req, res) => {
  try {
    const { page = 1, limit = 10, code } = req.query;
    const filter = {};
    
    if (code) filter.code = code;

    const qrCodes = await QRCode.find(filter)
      .populate('owner', 'name email')
      .sort({ lastScanned: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

    const total = await QRCode.countDocuments(filter);
    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: {
        qrCodes,
        totalPages,
        currentPage: parseInt(page),
        total
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get all notifications
router.get('/notifications', auth, adminAuth, async (req, res) => {
  try {
    const { page = 1, limit = 10, type } = req.query;
    const filter = {};
    
    if (type && type !== 'all') filter.type = type;

    const notifications = await Notification.find(filter)
      .populate('user', 'name email')
      .populate('qrCode', 'code type details.name')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

    const total = await Notification.countDocuments(filter);
    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: {
        notifications,
        totalPages,
        currentPage: parseInt(page),
        total
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Bulk generate QR codes
router.post('/bulk-generate', auth, adminAuth, async (req, res) => {
  try {
    const { count, type, template } = req.body;
    
    if (!count || count > 100) {
      return res.status(400).json({ 
        success: false, 
        message: 'Count must be between 1 and 100' 
      });
    }

    const qrCodes = [];
    for (let i = 0; i < count; i++) {
      const qrData = {
        type,
        details: {
          name: `${template.name || 'Item'} ${i + 1}`,
          ...template.details
        },
        contact: template.contact || {
          phone: '+27123456789',
          email: 'admin@scanback.co.za'
        }
      };

      const response = await require('../services/qrService').createQRCode(
        req.user.id,
        type,
        qrData.details,
        qrData.contact
      );

      qrCodes.push(response);
    }

    res.json({
      success: true,
      data: { qrCodes },
      message: `${count} QR codes generated successfully`
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Generate QR code for admin (blank QR codes)
router.post('/generate-qr', auth, adminAuth, async (req, res) => {
  try {
    const { type } = req.body;
    
    if (!type || !['item', 'pet'].includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Type must be either item or pet'
      });
    }

    // Create a blank QR code with default values for required fields
    const qrData = {
      type,
      details: {
        name: `Blank ${type === "pet" ? "Pet" : "Item"} QR Code`,
        description: "",
        category: "",
        color: "",
        brand: "",
        model: "",
        serialNumber: "",
        ...(type === "pet" ? {
          species: "",
          breed: "",
          age: undefined,
          microchipId: ""
        } : {
          value: undefined,
          purchaseDate: undefined,
          warrantyExpiry: undefined
        })
      },
      contact: {
        name: "Admin User", // Required field
        phone: "+27123456789", // Default placeholder phone
        backupPhone: "",
        countryCode: "+27",
        email: "admin@scanback.co.za", // Default admin email
        message: "",
        location: {
          address: "",
          city: "",
          country: "",
          coordinates: {
            lat: 0,
            lng: 0
          }
        }
      },
      settings: {
        instantAlerts: true,
        locationSharing: true
      }
    };

    const result = await require('../services/qrService').createQRCode(
      req.user.id,
      type,
      qrData.details,
      qrData.contact
    );

    // Update the QR code with settings after creation
    const QRCodeModel = require('../models/QRCode');
    await QRCodeModel.findByIdAndUpdate(result.qrCode._id, {
      settings: qrData.settings
    });

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
    console.error('Admin QR generation error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Export QR codes
router.get('/export', auth, adminAuth, async (req, res) => {
  try {
    const { format = 'csv' } = req.query;
    
    const qrCodes = await QRCode.find()
      .populate('owner', 'name email phone')
      .lean();

    if (format === 'csv') {
      const csv = [
        'Code,Type,Name,Description,Owner,Email,Phone,Status,Scans,Created At',
        ...qrCodes.map(qr => [
          qr.code,
          qr.type,
          qr.details.name,
          qr.details.description || '',
          qr.owner.name,
          qr.owner.email,
          qr.owner.phone,
          qr.status,
          qr.scanCount,
          new Date(qr.createdAt).toISOString()
        ].join(','))
      ].join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=qr-codes.csv');
      res.send(csv);
    } else {
      res.status(400).json({ success: false, message: 'Unsupported format' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
