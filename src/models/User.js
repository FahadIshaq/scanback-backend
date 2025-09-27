const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  phone: {
    type: String,
    required: true,
    trim: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  emailVerificationToken: String,
  emailVerificationExpires: Date,
  passwordResetToken: String,
  passwordResetExpires: Date,
  passwordResetOTP: String,
  passwordResetOTPExpires: Date,
  tempPassword: {
    type: String,
    default: null
  },
  tempPasswordExpires: Date,
  profile: {
    avatar: String,
    preferences: {
      notifications: {
        email: { type: Boolean, default: true },
        sms: { type: Boolean, default: true }
      }
    }
  },
  stats: {
    totalItems: { type: Number, default: 0 },
    totalPets: { type: Number, default: 0 },
    itemsFound: { type: Number, default: 0 },
    petsFound: { type: Number, default: 0 }
  }
}, {
  timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Generate temporary password
userSchema.methods.generateTempPassword = function() {
  const tempPassword = Math.random().toString(36).slice(-8).toUpperCase();
  this.tempPassword = tempPassword;
  this.tempPasswordExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
  return tempPassword;
};

// Check if temp password is valid
userSchema.methods.isTempPasswordValid = function() {
  return this.tempPassword && 
         this.tempPasswordExpires && 
         this.tempPasswordExpires > new Date();
};

module.exports = mongoose.model('User', userSchema);
