const express = require('express');
const Notification = require('../models/Notification');
const QRCode = require('../models/QRCode');
const emailService = require('../services/emailService');
const auth = require('../middleware/auth');
const router = express.Router();

/**
 * @route   GET /api/notifications
 * @desc    Get user's notifications
 * @access  Private
 */
router.get('/', auth, async (req, res) => {
  try {
    const { page = 1, limit = 20, type, isRead } = req.query;
    const skip = (page - 1) * limit;

    const filter = { owner: req.user.id };
    if (type) filter.type = type;
    if (isRead !== undefined) filter.isRead = isRead === 'true';

    const notifications = await Notification.find(filter)
      .populate('qrCode', 'code type details.name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Notification.countDocuments(filter);

    res.json({
      success: true,
      data: {
        notifications,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total
        }
      }
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get notifications'
    });
  }
});

/**
 * @route   GET /api/notifications/unread-count
 * @desc    Get unread notifications count
 * @access  Private
 */
router.get('/unread-count', auth, async (req, res) => {
  try {
    const count = await Notification.countDocuments({
      owner: req.user.id,
      isRead: false
    });

    res.json({
      success: true,
      data: { count }
    });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get unread count'
    });
  }
});

/**
 * @route   PUT /api/notifications/:id/read
 * @desc    Mark notification as read
 * @access  Private
 */
router.put('/:id/read', auth, async (req, res) => {
  try {
    const { id } = req.params;

    const notification = await Notification.findOne({
      _id: id,
      owner: req.user.id
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    notification.markAsRead();
    await notification.save();

    res.json({
      success: true,
      message: 'Notification marked as read',
      data: notification
    });
  } catch (error) {
    console.error('Mark notification as read error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark notification as read'
    });
  }
});

/**
 * @route   PUT /api/notifications/read-all
 * @desc    Mark all notifications as read
 * @access  Private
 */
router.put('/read-all', auth, async (req, res) => {
  try {
    const result = await Notification.updateMany(
      { owner: req.user.id, isRead: false },
      { $set: { isRead: true, readAt: new Date() } }
    );

    res.json({
      success: true,
      message: 'All notifications marked as read',
      data: { modifiedCount: result.modifiedCount }
    });
  } catch (error) {
    console.error('Mark all notifications as read error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark all notifications as read'
    });
  }
});

/**
 * @route   DELETE /api/notifications/:id
 * @desc    Delete notification
 * @access  Private
 */
router.delete('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;

    const notification = await Notification.findOneAndDelete({
      _id: id,
      owner: req.user.id
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    res.json({
      success: true,
      message: 'Notification deleted successfully'
    });
  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete notification'
    });
  }
});

/**
 * @route   POST /api/notifications/send-scan-notification
 * @desc    Send scan notification (internal use)
 * @access  Private
 */
router.post('/send-scan-notification', auth, async (req, res) => {
  try {
    const { qrCodeId, scanData } = req.body;

    const qrCode = await QRCode.findById(qrCodeId).populate('owner');
    if (!qrCode) {
      return res.status(404).json({
        success: false,
        message: 'QR code not found'
      });
    }

    // Create notification
    const notification = new Notification({
      qrCode: qrCodeId,
      owner: qrCode.owner._id,
      type: 'scan',
      title: `QR Code Scanned`,
      message: `Someone scanned your ${qrCode.type === 'pet' ? 'pet' : 'item'} tag`,
      data: {
        itemName: qrCode.details.name,
        petName: qrCode.details.name,
        qrCode: qrCode.code,
        scanLocation: scanData.location
      },
      channels: [{
        type: 'email',
        status: 'pending'
      }]
    });

    await notification.save();

    // Send email notification
    try {
      await emailService.sendScanNotification(
        qrCode.owner.email,
        qrCode.owner.name,
        {
          name: qrCode.details.name,
          type: qrCode.type
        },
        scanData
      );

      notification.addChannelStatus('email', 'sent');
      await notification.save();
    } catch (emailError) {
      console.error('Failed to send scan notification email:', emailError);
      notification.addChannelStatus('email', 'failed', emailError.message);
      await notification.save();
    }

    res.json({
      success: true,
      message: 'Scan notification sent',
      data: notification
    });
  } catch (error) {
    console.error('Send scan notification error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send scan notification'
    });
  }
});

/**
 * @route   POST /api/notifications/send-found-notification
 * @desc    Send found notification (internal use)
 * @access  Private
 */
router.post('/send-found-notification', auth, async (req, res) => {
  try {
    const { qrCodeId, finderDetails } = req.body;

    const qrCode = await QRCode.findById(qrCodeId).populate('owner');
    if (!qrCode) {
      return res.status(404).json({
        success: false,
        message: 'QR code not found'
      });
    }

    // Create notification
    const notification = new Notification({
      qrCode: qrCodeId,
      owner: qrCode.owner._id,
      type: 'found',
      title: `🎉 ${qrCode.type === 'pet' ? 'Pet' : 'Item'} Found!`,
      message: `Great news! Your ${qrCode.type === 'pet' ? 'pet' : 'item'} has been found`,
      data: {
        itemName: qrCode.details.name,
        petName: qrCode.details.name,
        qrCode: qrCode.code,
        finderName: finderDetails.finderName,
        finderPhone: finderDetails.finderPhone,
        finderEmail: finderDetails.finderEmail,
        foundLocation: finderDetails.foundLocation
      },
      channels: [{
        type: 'email',
        status: 'pending'
      }],
      priority: 'high'
    });

    await notification.save();

    // Send email notification
    try {
      await emailService.sendItemFoundNotification(
        qrCode.owner.email,
        qrCode.owner.name,
        {
          name: qrCode.details.name,
          type: qrCode.type,
          description: qrCode.details.description,
          breed: qrCode.details.breed,
          brand: qrCode.details.brand
        },
        finderDetails
      );

      notification.addChannelStatus('email', 'sent');
      await notification.save();
    } catch (emailError) {
      console.error('Failed to send found notification email:', emailError);
      notification.addChannelStatus('email', 'failed', emailError.message);
      await notification.save();
    }

    res.json({
      success: true,
      message: 'Found notification sent',
      data: notification
    });
  } catch (error) {
    console.error('Send found notification error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send found notification'
    });
  }
});

module.exports = router;
