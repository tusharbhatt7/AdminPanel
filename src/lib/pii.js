// Driver PII — phone, ID number, licence number, vehicle number — is stored
// encrypted at rest in Firestore by the driver app, alongside a companion
// *Hash field for lookup. ride_requests copies some of those values onto the
// ride document, so ciphertext turns up here too.
//
// This panel holds no decryption key, so rendering the raw value puts a base64
// blob where an admin expects a vehicle number. Detect that and label it rather
// than showing the blob. Encrypted values are base64 and the plaintext forms
// (Indian vehicle numbers, phone numbers) never contain =, + or /.
const BASE64_ONLY = /[=+/]/;

export const looksEncrypted = (value) =>
    typeof value === 'string' && value.length >= 16 && BASE64_ONLY.test(value);

/** The value if it is readable, otherwise null. */
export const plainOrNull = (value) => (looksEncrypted(value) ? null : (value || null));
