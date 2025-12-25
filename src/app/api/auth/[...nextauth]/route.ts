import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextRequest } from "next/server";

const handler = async (req: NextRequest, context: any) => {
    // Detect the origin from the request headers (works with ngrok)
    // This ensures OAuth callbacks use the correct URL regardless of NEXTAUTH_URL
    const host = req.headers.get('host');
    const protocol = req.headers.get('x-forwarded-proto') || (host?.includes('localhost') ? 'http' : 'https');
    
    if (host) {
        const detectedUrl = `${protocol}://${host}`;
        // Override NEXTAUTH_URL for this request to use the detected origin
        // This ensures Google OAuth redirects go to the correct URL (ngrok or localhost)
        const originalNextAuthUrl = process.env.NEXTAUTH_URL;
        process.env.NEXTAUTH_URL = detectedUrl;
        
        try {
            return await NextAuth(authOptions)(req, context);
        } finally {
            // Restore original if it was set
            if (originalNextAuthUrl) {
                process.env.NEXTAUTH_URL = originalNextAuthUrl;
            }
        }
    }
    
    return NextAuth(authOptions)(req, context);
};

export { handler as GET, handler as POST };
