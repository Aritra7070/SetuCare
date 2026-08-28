const QRCode = require('qrcode');

/**
 * Generate high-contrast scannable QR Code as Data URI (Base64 PNG)
 * Encodes only the plain PHID string for offline continuity.
 */
const generateQRCodeDataUrl = async (phidText, options = {}) => {
  try {
    const qrOptions = {
      errorCorrectionLevel: 'M',
      type: 'image/png',
      margin: 2,
      scale: 8,
      color: {
        dark: '#0F172A', // Deep navy for sharp scanner recognition
        light: '#FFFFFF',
      },
      ...options,
    };

    const dataUrl = await QRCode.toDataURL(phidText, qrOptions);
    return dataUrl;
  } catch (error) {
    console.error('[QR Generator] Error generating QR code:', error);
    throw new Error('Failed to generate QR code data URL: ' + error.message);
  }
};

module.exports = {
  generateQRCodeDataUrl,
};
