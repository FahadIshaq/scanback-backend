# ScanBack Backend API

A comprehensive backend system for ScanBack QR code service, built with Node.js, Express, and MongoDB.

## Features

- 🔐 **User Authentication & Authorization**
- 📱 **QR Code Generation & Management**
- 🐾 **Pet & Item Management**
- 📧 **Email Notifications**
- 📊 **Analytics & Tracking**
- 🔒 **Security & Rate Limiting**

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose
- **Authentication**: JWT
- **Email**: Nodemailer
- **QR Codes**: qrcode library
- **Security**: Helmet, CORS, Rate Limiting

## Installation

1. **Clone and navigate to backend directory**
   ```bash
   cd backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   ```bash
   cp env.example .env
   ```
   
   Update the `.env` file with your configuration:
   ```env
   MONGODB_URI=mongodb://localhost:27017/scanback
   JWT_SECRET=your-super-secret-jwt-key
   EMAIL_USER=your-email@gmail.com
   EMAIL_PASS=your-app-password
   ```

4. **Start the server**
   ```bash
   # Development
   npm run dev
   
   # Production
   npm start
   ```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login
- `POST /api/auth/change-password` - Change password
- `GET /api/auth/me` - Get current user
- `PUT /api/auth/profile` - Update profile

### QR Codes
- `POST /api/qr/generate` - Generate new QR code
- `GET /api/qr/:code` - Get QR code details
- `POST /api/qr/:code/activate` - Activate QR code
- `POST /api/qr/:code/scan` - Handle QR scan
- `POST /api/qr/:code/found` - Report as found

### Items
- `POST /api/items/create` - Create item QR code
- `GET /api/items` - Get user's items
- `GET /api/items/:id` - Get specific item
- `PUT /api/items/:id` - Update item
- `DELETE /api/items/:id` - Deactivate item

### Pets
- `POST /api/pets/create` - Create pet QR code
- `GET /api/pets` - Get user's pets
- `GET /api/pets/:id` - Get specific pet
- `PUT /api/pets/:id` - Update pet
- `DELETE /api/pets/:id` - Deactivate pet
- `GET /api/pets/species` - Get available species

### Notifications
- `GET /api/notifications` - Get notifications
- `PUT /api/notifications/:id/read` - Mark as read
- `PUT /api/notifications/read-all` - Mark all as read
- `DELETE /api/notifications/:id` - Delete notification

## Database Models

### User
- Authentication & profile information
- Statistics tracking
- Email verification

### QRCode
- QR code details and metadata
- Owner information
- Scan history and analytics
- Contact information

### Notification
- Email and SMS notifications
- Delivery status tracking
- Priority levels

## QR Code Flow

1. **User Registration**: User creates account, receives temp password via email
2. **QR Generation**: User creates QR codes for pets/items
3. **Activation**: QR code is activated with contact details
4. **Scanning**: When found, someone scans the QR code
5. **Notification**: Owner receives email/SMS notification
6. **Recovery**: Owner contacts finder to recover item/pet

## Email Templates

- Welcome email with temporary password
- Item/Pet found notifications
- QR code scan alerts
- Email verification

## Security Features

- JWT authentication
- Password hashing with bcrypt
- Rate limiting
- CORS protection
- Input validation
- Helmet security headers

## Environment Variables

```env
# Database
MONGODB_URI=mongodb://localhost:27017/scanback

# Server
PORT=5000
NODE_ENV=development

# JWT
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRE=7d

# Email
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
EMAIL_FROM=ScanBack <noreply@scanback.co.za>

# Frontend
FRONTEND_URL=http://localhost:3000

# QR Code
QR_CODE_BASE_URL=https://scanback.co.za/scan
QR_CODE_SIZE=200
```

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run tests
npm test
```

## Production Deployment

1. Set up MongoDB database
2. Configure environment variables
3. Install dependencies: `npm install`
4. Start server: `npm start`

## API Response Format

```json
{
  "success": true,
  "message": "Operation successful",
  "data": {
    // Response data
  }
}
```

## Error Handling

All errors follow a consistent format:
```json
{
  "success": false,
  "message": "Error description",
  "errors": [
    // Validation errors (if any)
  ]
}
```

## License

MIT License - see LICENSE file for details.
