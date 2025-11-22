
import crypto from 'crypto';
import { sendEmail } from './src/utils/replitmail';

interface VerificationCode {
    code: string;
    expiresAt: number;
    attempts: number;
}

// In-memory storage for verification codes (consider Redis for production)
const emailVerifications = new Map<string, VerificationCode>();
const phoneVerifications = new Map<string, VerificationCode>();

// Generate 6-digit OTP
function generateOTP(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// Check if email is from a disposable domain
const disposableDomains = [
    'tempmail.com', 'guerrillamail.com', '10minutemail.com', 
    'throwaway.email', 'temp-mail.org', 'mailinator.com',
    'yopmail.com', 'fakeinbox.com'
];

export function isDisposableEmail(email: string): boolean {
    const domain = email.split('@')[1]?.toLowerCase();
    return disposableDomains.some(d => domain?.includes(d));
}

// Validate email format and detect obvious fakes
export function validateEmailFormat(email: string): { valid: boolean; error?: string } {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    if (!emailRegex.test(email)) {
        return { valid: false, error: 'Invalid email format' };
    }
    
    if (isDisposableEmail(email)) {
        return { valid: false, error: 'Disposable email addresses are not allowed' };
    }
    
    return { valid: true };
}

// Send email verification code
export async function sendEmailVerificationCode(email: string, fullname: string): Promise<{ success: boolean; error?: string }> {
    const validation = validateEmailFormat(email);
    if (!validation.valid) {
        return { success: false, error: validation.error };
    }

    const code = generateOTP();
    const expiresAt = Date.now() + 15 * 60 * 1000; // 15 minutes

    emailVerifications.set(email, {
        code,
        expiresAt,
        attempts: 0
    });

    const emailHTML = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
            <div style="background: white; border-radius: 16px; padding: 40px; box-shadow: 0 10px 30px rgba(0,0,0,0.2);">
                <h2 style="color: #667eea; margin-bottom: 20px;">🔐 Email Verification</h2>
                
                <p style="font-size: 16px; color: #333; margin-bottom: 20px;">
                    Hello ${fullname},
                </p>
                
                <p style="font-size: 16px; color: #333; margin-bottom: 30px;">
                    Your verification code for VIPRUS is:
                </p>
                
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 12px; text-align: center; margin-bottom: 30px;">
                    <h1 style="color: white; font-size: 48px; letter-spacing: 8px; margin: 0;">${code}</h1>
                </div>
                
                <p style="font-size: 14px; color: #666; margin-bottom: 10px;">
                    ⏰ This code will expire in 15 minutes.
                </p>
                
                <p style="font-size: 14px; color: #666;">
                    If you didn't request this code, please ignore this email.
                </p>
                
                <div style="margin-top: 40px; padding-top: 20px; border-top: 2px solid #eee; text-align: center; color: #999; font-size: 12px;">
                    <p>© 2024 Paradox - Task-Based Income Platform</p>
                </div>
            </div>
        </div>
    `;

    try {
        await sendEmail({
            to: email,
            subject: '🔐 Paradox Email Verification Code',
            html: emailHTML,
            text: `Your Paradox verification code is: ${code}. It will expire in 15 minutes.`
        });

        return { success: true };
    } catch (error: any) {
        console.error('Email sending failed:', error);
        return { success: false, error: 'Failed to send verification email' };
    }
}

// Verify email code
export function verifyEmailCode(email: string, code: string): { success: boolean; error?: string } {
    const verification = emailVerifications.get(email);
    
    if (!verification) {
        return { success: false, error: 'No verification code found. Please request a new one.' };
    }
    
    if (Date.now() > verification.expiresAt) {
        emailVerifications.delete(email);
        return { success: false, error: 'Verification code has expired. Please request a new one.' };
    }
    
    if (verification.attempts >= 3) {
        emailVerifications.delete(email);
        return { success: false, error: 'Too many failed attempts. Please request a new code.' };
    }
    
    if (verification.code !== code) {
        verification.attempts++;
        return { success: false, error: `Invalid code. ${3 - verification.attempts} attempts remaining.` };
    }
    
    // Success - remove from pending verifications
    emailVerifications.delete(email);
    return { success: true };
}

// Send phone OTP (placeholder - needs SMS service integration)
export async function sendPhoneOTP(phone: string): Promise<{ success: boolean; error?: string }> {
    // Validate Nigerian phone format
    const phoneRegex = /^\+234[0-9]{10}$/;
    if (!phoneRegex.test(phone)) {
        return { success: false, error: 'Invalid Nigerian phone number format. Use +234XXXXXXXXXX' };
    }

    const code = generateOTP();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

    phoneVerifications.set(phone, {
        code,
        expiresAt,
        attempts: 0
    });

    console.log(`📱 SMS OTP for ${phone}: ${code}`); // For testing - remove in production

    // TODO: Integrate with SMS provider (Twilio, Africa's Talking, Termii, etc.)
    // Example for Termii (Nigerian SMS service):
    /*
    try {
        const response = await fetch('https://api.ng.termii.com/api/sms/otp/send', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                api_key: process.env.TERMII_API_KEY,
                message_type: 'NUMERIC',
                to: phone,
                from: 'Paradox',
                channel: 'generic',
                pin_attempts: 3,
                pin_time_to_live: 10,
                pin_length: 6,
                pin_placeholder: '< 1234 >',
                message_text: 'Your Paradox verification code is < 1234 >. Valid for 10 minutes.',
                pin_type: 'NUMERIC'
            })
        });
        
        const result = await response.json();
        if (result.pinId) {
            return { success: true };
        }
    } catch (error) {
        console.error('SMS sending failed:', error);
    }
    */

    // For now, return success (will log to console)
    return { success: true };
}

// Verify phone OTP
export function verifyPhoneOTP(phone: string, code: string): { success: boolean; error?: string } {
    const verification = phoneVerifications.get(phone);
    
    if (!verification) {
        return { success: false, error: 'No OTP found. Please request a new one.' };
    }
    
    if (Date.now() > verification.expiresAt) {
        phoneVerifications.delete(phone);
        return { success: false, error: 'OTP has expired. Please request a new one.' };
    }
    
    if (verification.attempts >= 3) {
        phoneVerifications.delete(phone);
        return { success: false, error: 'Too many failed attempts. Please request a new OTP.' };
    }
    
    if (verification.code !== code) {
        verification.attempts++;
        return { success: false, error: `Invalid OTP. ${3 - verification.attempts} attempts remaining.` };
    }
    
    // Success
    phoneVerifications.delete(phone);
    return { success: true };
}

// Cleanup expired codes (run periodically)
export function cleanupExpiredCodes(): void {
    const now = Date.now();
    
    for (const [email, verification] of emailVerifications.entries()) {
        if (now > verification.expiresAt) {
            emailVerifications.delete(email);
        }
    }
    
    for (const [phone, verification] of phoneVerifications.entries()) {
        if (now > verification.expiresAt) {
            phoneVerifications.delete(phone);
        }
    }
}

// Run cleanup every 5 minutes
setInterval(cleanupExpiredCodes, 5 * 60 * 1000);
