import { getToken } from "next-auth/jwt";
import { NextRequest } from "next/server";

/**
 * Helper to get auth token with proper cookie name handling.
 * Checks which cookie exists first to avoid unnecessary decryption attempts.
 */
export async function getAuthToken(req: NextRequest) {
    const startTime = Date.now();
    const isProduction = process.env.NODE_ENV === 'production';
    
    // Check which cookies are present to avoid trying both
    const hasSecureCookie = req.cookies.has('__Secure-next-auth.session-token');
    const hasStandardCookie = req.cookies.has('next-auth.session-token');
    
    console.log(`[Auth] Checking cookies: secure=${hasSecureCookie}, standard=${hasStandardCookie}, env=${isProduction ? 'prod' : 'dev'}`);
    
    // In production, prefer the secure cookie if it exists
    if (isProduction && hasSecureCookie) {
        try {
            const t1 = Date.now();
            const token = await getToken({ 
                req, 
                secret: process.env.NEXTAUTH_SECRET,
                cookieName: '__Secure-next-auth.session-token'
            });
            console.log(`[Auth] Secure cookie getToken took ${Date.now() - t1}ms`);
            if (token) {
                console.log(`[Auth] Total auth time: ${Date.now() - startTime}ms (secure cookie)`);
                return token;
            }
        } catch (e) {
            console.error('[Auth] Error with secure cookie:', e);
            // Fall through to try standard cookie name
        }
    }
    
    // Try standard cookie name if it exists
    if (hasStandardCookie) {
        try {
            const t1 = Date.now();
            const token = await getToken({ 
                req, 
                secret: process.env.NEXTAUTH_SECRET,
                cookieName: 'next-auth.session-token'
            });
            console.log(`[Auth] Standard cookie getToken took ${Date.now() - t1}ms`);
            if (token) {
                console.log(`[Auth] Total auth time: ${Date.now() - startTime}ms (standard cookie)`);
                return token;
            }
        } catch (e) {
            console.error('[Auth] Error with standard cookie:', e);
        }
    }
    
    // If neither specific cookie worked, try default behavior
    try {
        const t1 = Date.now();
        const token = await getToken({ 
            req, 
            secret: process.env.NEXTAUTH_SECRET
        });
        console.log(`[Auth] Default getToken took ${Date.now() - t1}ms`);
        console.log(`[Auth] Total auth time: ${Date.now() - startTime}ms (default)`);
        return token;
    } catch (e) {
        console.error('[Auth] Error getting token (default):', e);
        return null;
    }
}

