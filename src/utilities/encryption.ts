import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16
const TAG_LENGTH = 16

// Get encryption key from environment variable
function getEncryptionKey(): Buffer {
  const secret = process.env.ENCRYPTION_SECRET || process.env.PAYLOAD_SECRET
  if (!secret) {
    throw new Error('ENCRYPTION_SECRET environment variable is required for token encryption')
  }
  // Use per-deployment salt from env var. Falls back to a fixed salt for
  // backward compatibility with data encrypted before this change.
  const salt = process.env.ENCRYPTION_SALT || 'angel-os-v1'
  return crypto.scryptSync(secret, salt, 32)
}

/**
 * Encrypt sensitive data (like OAuth tokens) for storage
 * @param text The plaintext to encrypt
 * @returns Encrypted string (hex-encoded)
 */
export function encrypt(text: string): string {
  if (!text) return text
  
  try {
    const key = getEncryptionKey()
    const iv = crypto.randomBytes(IV_LENGTH)
    const cipher = crypto.createCipheriv(ALGORITHM, key as crypto.CipherKey, iv as crypto.BinaryLike)
    
    const updateBuf = cipher.update(text, 'utf8')
    const finalBuf = cipher.final()
    const encrypted = Buffer.concat([updateBuf, finalBuf] as Uint8Array[])
    
    const tag = cipher.getAuthTag()
    
    // Combine IV + tag + encrypted data (Buffer extends Uint8Array; cast for strict TS)
    return Buffer.concat([iv, tag, encrypted] as Uint8Array[]).toString('hex')
  } catch (error) {
    console.error('Encryption error:', error)
    throw new Error('Failed to encrypt data')
  }
}

/**
 * Decrypt sensitive data (like OAuth tokens) from storage
 * @param encryptedText The encrypted string (hex-encoded)
 * @returns Decrypted plaintext
 */
export function decrypt(encryptedText: string): string {
  if (!encryptedText) return encryptedText
  
  try {
    const key = getEncryptionKey()
    const data = Buffer.from(encryptedText, 'hex')
    
    // Extract IV, tag, and encrypted data
    const iv = data.subarray(0, IV_LENGTH)
    const tag = data.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH)
    const encrypted = data.subarray(IV_LENGTH + TAG_LENGTH)
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key as crypto.CipherKey, iv as crypto.BinaryLike)
    decipher.setAuthTag(tag as NodeJS.ArrayBufferView)
    
    const decrypted = Buffer.concat([
      decipher.update(encrypted as NodeJS.ArrayBufferView),
      decipher.final(),
    ] as Uint8Array[])
    
    return decrypted.toString('utf8')
  } catch (error) {
    console.error('Decryption error:', error)
    throw new Error('Failed to decrypt data')
  }
}

/**
 * Safely decrypt a token and handle errors gracefully
 * @param encryptedToken The encrypted token
 * @returns Decrypted token or null if decryption fails
 */
export function safeDecrypt(encryptedToken: string): string | null {
  try {
    return decrypt(encryptedToken)
  } catch (error) {
    console.error('Safe decryption failed:', error)
    return null
  }
}

/**
 * Check if a string appears to be encrypted (hex format)
 * @param text The text to check
 * @returns True if the text appears to be encrypted
 */
export function isEncrypted(text: string): boolean {
  if (!text || text.length < (IV_LENGTH + TAG_LENGTH) * 2) return false
  return /^[0-9a-f]+$/i.test(text)
}

/**
 * Hash sensitive data for comparison purposes (one-way)
 * @param text The text to hash
 * @returns SHA-256 hash
 */
export function hash(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex')
}

/**
 * Generate a secure random token
 * @param length Length in bytes (default 32)
 * @returns Random hex string
 */
export function generateSecureToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex')
} 