import { getToken } from "next-auth/jwt";
import { NextRequest } from "next/server";

/**
 * Helper to get auth token with proper cookie name handling.
 * Checks which cookie exists first to avoid unnecessary decryption attempts.
 */
export async function getAuthToken(req: NextRequest) {
    const isProduction = process.env.NODE_ENV === 'production';
    
    // Check which cookies are present to avoid trying both
    const hasSecureCookie = req.cookies.has('__Secure-next-auth.session-token');
    const hasStandardCookie = req.cookies.has('next-auth.session-token');
    
    // In production, prefer the secure cookie if it exists
    if (isProduction && hasSecureCookie) {
        try {
            const token = await getToken({ 
                req, 
                secret: process.env.NEXTAUTH_SECRET,
                cookieName: '__Secure-next-auth.session-token'
            });
            if (token) return token;
        } catch (e) {
            // Fall through to try standard cookie name
        }
    }
    
    // Try standard cookie name if it exists
    if (hasStandardCookie) {
        try {
            const token = await getToken({ 
                req, 
                secret: process.env.NEXTAUTH_SECRET,
                cookieName: 'next-auth.session-token'
            });
            if (token) return token;
        } catch (e) {
            console.error('Error getting token:', e);
        }
    }
    
    // If neither specific cookie worked, try default behavior
    try {
        const token = await getToken({ 
            req, 
            secret: process.env.NEXTAUTH_SECRET
        });
        return token;
    } catch (e) {
        console.error('Error getting token (default):', e);
        return null;
    }
}

