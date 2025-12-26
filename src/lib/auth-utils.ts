import { getToken } from "next-auth/jwt";
import { NextRequest } from "next/server";

/**
 * Helper to get auth token with proper cookie name handling.
 * Tries both production and development cookie names to handle
 * cases where cookies might have been set with different names.
 */
export async function getAuthToken(req: NextRequest) {
    const isProduction = process.env.NODE_ENV === 'production';
    
    // Try production cookie name first if in production
    if (isProduction) {
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
    
    // Try standard cookie name (works for both dev and prod if cookie was set with this name)
    try {
        const token = await getToken({ 
            req, 
            secret: process.env.NEXTAUTH_SECRET,
            cookieName: 'next-auth.session-token'
        });
        return token;
    } catch (e) {
        console.error('Error getting token:', e);
        return null;
    }
}

