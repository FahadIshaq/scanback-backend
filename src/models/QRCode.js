const mongoose = require('mongoose');

const qrCodeSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  type: {
    type: String,
    enum: ['item', 'pet'],
    required: true
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  details: {
    name: {
      type: String,
      required: true,
      trim: true
    },
    description: String,
    category: String,
    color: String,
    brand: String,
    model: String,
    serialNumber: String,
    // Pet specific fields
    image: String,
    emergencyDetails: String,
    pedigreeInfo: String,
    microchipId: String,
    // Emergency Details fields
    medicalNotes: String,
    vetName: String,
    vetPhone: String,
    vetCountryCode: String,
    emergencyContact: String,
    emergencyCountryCode: String,
    // Pedigree Information fields
    breed: String,
    age: String,
    registrationNumber: String,
    breederInfo: String,
    // Item specific fields
    value: Number,
    purchaseDate: Date,
    warrantyExpiry: Date
  },
  contact: {
    name: {
      type: String,
      required: true
    },
    phone: {
      type: String,
      required: true
    },
    backupPhone: String,
    countryCode: {
      type: String,
      default: '+27'
    },
    email: {
      type: String,
      required: true
    },
    message: String,
    location: {
      address: String,
      city: String,
      country: String,
      coordinates: {
        lat: Number,
        lng: Number
      }
    }
  },
  settings: {
    instantAlerts: {
      type: Boolean,
      default: true
    },
    locationSharing: {
      type: Boolean,
      default: true
    },
    showContactOnFinderPage: {
      type: Boolean,
      default: true
    }
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended', 'found'],
    default: 'active'
  },
  isActivated: {
    type: Boolean,
    default: false
  },
  activationDate: Date,
  lastScanned: Date,
  scanCount: {
    type: Number,
    default: 0
  },
  foundBy: {
    finderName: String,
    finderPhone: String,
    finderEmail: String,
    foundDate: Date,
    foundLocation: String,
    notes: String
  },
  qrImageUrl: String,
  qrImageData: Buffer,
  metadata: {
    userAgent: String,
    ipAddress: String,
    scanHistory: [{
      scannedAt: Date,
      ipAddress: String,
      userAgent: String,
      location: String
    }]
  },
  // OTP fields for contact updates
  updateOTP: {
    code: String,
    expires: Date,
    newEmail: String,
    newPhone: String
  }
}, {
  timestamps: true
});

// Index for faster queries
qrCodeSchema.index({ code: 1, type: 1 });
qrCodeSchema.index({ owner: 1, status: 1 });
qrCodeSchema.index({ 'contact.phone': 1 });
qrCodeSchema.index({ 'contact.email': 1 });

// Virtual for QR code URL
qrCodeSchema.virtual('qrUrl').get(function() {
  return `${process.env.QR_CODE_BASE_URL || 'https://scanback.vercel.app/scan'}/${this.code}`;
});

// Method to increment scan count
qrCodeSchema.methods.incrementScanCount = function(ipAddress, userAgent, location) {
  this.scanCount += 1;
  this.lastScanned = new Date();
  this.metadata.scanHistory.push({
    scannedAt: new Date(),
    ipAddress: ipAddress || 'unknown',
    userAgent: userAgent || 'unknown',
    location: location || 'unknown'
  });
  
  // Keep only last 50 scan records
  if (this.metadata.scanHistory.length > 50) {
    this.metadata.scanHistory = this.metadata.scanHistory.slice(-50);
  }
};

// Method to mark as found
qrCodeSchema.methods.markAsFound = function(finderDetails) {
  this.status = 'found';
  this.foundBy = {
    finderName: finderDetails.name,
    finderPhone: finderDetails.phone,
    finderEmail: finderDetails.email,
    foundDate: new Date(),
    foundLocation: finderDetails.location,
    notes: finderDetails.notes
  };
};

module.exports = mongoose.model('QRCode', qrCodeSchema);
