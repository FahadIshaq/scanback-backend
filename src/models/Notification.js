const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  qrCode: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'QRCode',
    required: true
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['scan', 'found', 'contact_attempt', 'system'],
    required: true
  },
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  data: {
    finderName: String,
    finderPhone: String,
    finderEmail: String,
    foundLocation: String,
    scanLocation: String,
    itemName: String,
    petName: String,
    qrCode: String
  },
  channels: [{
    type: {
      type: String,
      enum: ['email', 'sms', 'whatsapp', 'push'],
      required: true
    },
    status: {
      type: String,
      enum: ['pending', 'sent', 'delivered', 'failed'],
      default: 'pending'
    },
    sentAt: Date,
    deliveredAt: Date,
    error: String
  }],
  isRead: {
    type: Boolean,
    default: false
  },
  readAt: Date,
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  expiresAt: Date
}, {
  timestamps: true
});

// Index for efficient queries
notificationSchema.index({ owner: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ qrCode: 1, type: 1 });
notificationSchema.index({ 'channels.status': 1 });

// Method to mark as read
notificationSchema.methods.markAsRead = function() {
  this.isRead = true;
  this.readAt = new Date();
};

// Method to add channel status
notificationSchema.methods.addChannelStatus = function(channelType, status, error = null) {
  const channel = this.channels.find(c => c.type === channelType);
  if (channel) {
    channel.status = status;
    if (status === 'sent') channel.sentAt = new Date();
    if (status === 'delivered') channel.deliveredAt = new Date();
    if (error) channel.error = error;
  } else {
    this.channels.push({
      type: channelType,
      status,
      error,
      sentAt: status === 'sent' ? new Date() : undefined,
      deliveredAt: status === 'delivered' ? new Date() : undefined
    });
  }
};

module.exports = mongoose.model('Notification', notificationSchema);
