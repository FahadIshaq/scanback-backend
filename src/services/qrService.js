const QRCode = require('qrcode');
const { v4: uuidv4 } = require('uuid');
const QRCodeModel = require('../models/QRCode');
const User = require('../models/User');

class QRService {
  /**
   * Generate a unique QR code
   */
  static generateUniqueCode() {
    return uuidv4().replace(/-/g, '').substring(0, 12).toUpperCase();
  }

  /**
   * Generate QR code image
   */
  static async generateQRImage(data, options = {}) {
    const defaultOptions = {
      type: 'png',
      quality: 0.92,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      },
      width: parseInt(process.env.QR_CODE_SIZE) || 200
    };

    const qrOptions = { ...defaultOptions, ...options };
    
    try {
      const qrDataURL = await QRCode.toDataURL(data, qrOptions);
      return qrDataURL;
    } catch (error) {
      throw new Error(`QR code generation failed: ${error.message}`);
    }
  }

  /**
   * Create a new QR code for item or pet
   */
  static async createQRCode(ownerId, type, details, contact) {
    try {
      // Generate unique code
      const code = this.generateUniqueCode();
      
      // Generate QR code image
      const qrUrl = `${process.env.QR_CODE_BASE_URL || 'http://192.168.0.104:3001/scan'}/${code}`;
      const qrImageDataURL = await this.generateQRImage(qrUrl);
      
      // Convert data URL to buffer
      const qrImageBuffer = Buffer.from(qrImageDataURL.split(',')[1], 'base64');
      
      // Create QR code record
      const qrCode = new QRCodeModel({
        code,
        type,
        owner: ownerId,
        details,
        contact: {
          ...contact,
          location: contact.location || {
            address: '',
            city: '',
            country: '',
            coordinates: {
              lat: 0,
              lng: 0
            }
          }
        },
        settings: {
          instantAlerts: true,
          locationSharing: true
        },
        qrImageUrl: qrImageDataURL,
        qrImageData: qrImageBuffer,
        isActivated: false
      });

      await qrCode.save();
      
      // Update user stats
      await User.findByIdAndUpdate(ownerId, {
        $inc: { 
          [`stats.total${type === 'pet' ? 'Pets' : 'Items'}`]: 1 
        }
      });

      return {
        qrCode,
        qrImageDataURL,
        qrUrl
      };
    } catch (error) {
      throw new Error(`Failed to create QR code: ${error.message}`);
    }
  }

  /**
   * Get QR code by code string
   */
  static async getQRCodeByCode(code) {
    try {
      const qrCode = await QRCodeModel.findOne({ code })
        .populate('owner', 'name email phone')
        .lean();
      
      if (!qrCode) {
        throw new Error('QR code not found');
      }

      return qrCode;
    } catch (error) {
      throw new Error(`Failed to get QR code: ${error.message}`);
    }
  }

  /**
   * Activate QR code
   */
  static async activateQRCode(code, activationData, ownerId) {
    try {
      const qrCode = await QRCodeModel.findOne({ code });
      
      if (!qrCode) {
        throw new Error('QR code not found');
      }

      if (qrCode.isActivated) {
        throw new Error('QR code is already activated');
      }

      // Update QR code with activation data and owner
      qrCode.isActivated = true;
      qrCode.activationDate = new Date();
      qrCode.owner = ownerId; // Set the owner
      qrCode.details = { ...qrCode.details, ...activationData.details };
      qrCode.contact = { 
        ...qrCode.contact, 
        ...activationData.contact,
        location: activationData.contact.location || {
          address: '',
          city: '',
          country: '',
          coordinates: {
            lat: 0,
            lng: 0
          }
        }
      };
      qrCode.settings = { 
        ...qrCode.settings, 
        ...activationData.settings 
      };

      await qrCode.save();
      
      return qrCode;
    } catch (error) {
      throw new Error(`Failed to activate QR code: ${error.message}`);
    }
  }

  /**
   * Handle QR code scan
   */
  static async handleScan(code, scanData) {
    try {
      const qrCode = await QRCodeModel.findOne({ code });
      
      if (!qrCode) {
        throw new Error('QR code not found');
      }

      if (!qrCode.isActivated) {
        throw new Error('QR code is not activated yet');
      }

      // Increment scan count and add to history
      qrCode.incrementScanCount(
        scanData.ipAddress,
        scanData.userAgent,
        scanData.location
      );

      await qrCode.save();

      return {
        qrCode,
        scanData: {
          itemName: qrCode.details.name,
          petName: qrCode.details.name,
          type: qrCode.type,
          ownerName: qrCode.owner.name,
          contact: qrCode.contact,
          message: qrCode.contact.message
        }
      };
    } catch (error) {
      throw new Error(`Failed to handle scan: ${error.message}`);
    }
  }

  /**
   * Report item/pet as found
   */
  static async reportFound(code, finderDetails) {
    try {
      const qrCode = await QRCodeModel.findOne({ code });
      
      if (!qrCode) {
        throw new Error('QR code not found');
      }

      if (qrCode.status === 'found') {
        throw new Error('Item/Pet is already marked as found');
      }

      // Mark as found
      qrCode.markAsFound(finderDetails);
      await qrCode.save();

      // Update user stats
      await User.findByIdAndUpdate(qrCode.owner, {
        $inc: { 
          [`stats.${qrCode.type === 'pet' ? 'pets' : 'items'}Found`]: 1 
        }
      });

      return qrCode;
    } catch (error) {
      throw new Error(`Failed to report as found: ${error.message}`);
    }
  }

  /**
   * Get user's QR codes
   */
  static async getUserQRCodes(userId, type = null) {
    try {
      const filter = { owner: userId };
      if (type) filter.type = type;

      const qrCodes = await QRCodeModel.find(filter)
        .sort({ createdAt: -1 })
        .lean();

      return qrCodes;
    } catch (error) {
      throw new Error(`Failed to get user QR codes: ${error.message}`);
    }
  }

  /**
   * Update QR code details
   */
  static async updateQRCode(code, updateData) {
    try {
      const qrCode = await QRCodeModel.findOneAndUpdate(
        { code },
        { 
          $set: {
            'details': updateData.details,
            'contact': updateData.contact
          }
        },
        { new: true }
      );

      if (!qrCode) {
        throw new Error('QR code not found');
      }

      return qrCode;
    } catch (error) {
      throw new Error(`Failed to update QR code: ${error.message}`);
    }
  }

  /**
   * Deactivate QR code
   */
  static async deactivateQRCode(code) {
    try {
      const qrCode = await QRCodeModel.findOneAndUpdate(
        { code },
        { 
          $set: { 
            status: 'inactive',
            isActivated: false
          }
        },
        { new: true }
      );

      if (!qrCode) {
        throw new Error('QR code not found');
      }

      return qrCode;
    } catch (error) {
      throw new Error(`Failed to deactivate QR code: ${error.message}`);
    }
  }
}

module.exports = QRService;
