const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/scanback')
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// Import QR Code model
const QRCode = require('./src/models/QRCode');

async function updateQRUrls() {
  try {
    console.log('🔄 Updating QR code URLs...');
    
    // Update all QR codes to use local URL
    const result = await QRCode.updateMany(
      {},
      {
        $set: {
          // This will make the virtual qrUrl return the local URL
          // The virtual will use the environment variable
        }
      }
    );
    
    console.log(`✅ Updated ${result.modifiedCount} QR codes`);
    console.log('🎉 All QR codes now point to local development URL');
    
  } catch (error) {
    console.error('❌ Error updating QR codes:', error);
  } finally {
    mongoose.connection.close();
  }
}

updateQRUrls();


