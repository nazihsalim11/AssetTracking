// Phone validation/normalisation, extracted verbatim from server.js. Indian 10-digit
// numbers are normalised to +91; international numbers must be + followed by 7–15
// digits. Shared by the bulk-import and user-management routes.
const validateAndFormatPhone = (phone) => {
  if (!phone) return { isValid: true, value: '' };
  const cleaned = String(phone).replace(/[\s\-\(\)]/g, '');
  if (!cleaned) return { isValid: true, value: '' };

  if (cleaned.startsWith('+')) {
    const digitsOnly = cleaned.slice(1);
    if (/^\d{7,15}$/.test(digitsOnly)) {
      return { isValid: true, value: cleaned };
    }
    return { isValid: false, error: 'Invalid international phone format. Must be + followed by 7 to 15 digits.' };
  }

  if (/^\d{10}$/.test(cleaned)) {
    return { isValid: true, value: '+91' + cleaned };
  }

  if (/^91\d{10}$/.test(cleaned)) {
    return { isValid: true, value: '+' + cleaned };
  }

  return { isValid: false, error: 'Invalid phone format. Indian numbers require 10 digits. International numbers must start with +.' };
};

module.exports = validateAndFormatPhone;
