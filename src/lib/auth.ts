import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

export const authOptions: NextAuthOptions = {
    providers: [
        GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
            authorization: {
                params: {
                    scope: "openid email profile https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/spreadsheets",
                    prompt: "consent",
                    access_type: "offline",
                    response_type: "code",
                },
            },
        }),
    ],
    session: {
        strategy: "jwt",
    },
    cookies: {
        sessionToken: {
            name: process.env.NODE_ENV === 'production' 
                ? '__Secure-next-auth.session-token'
                : 'next-auth.session-token',
            options: {
                httpOnly: true,
                sameSite: 'lax',
                path: '/',
                secure: process.env.NODE_ENV === 'production',
            },
        },
    },
    useSecureCookies: process.env.NODE_ENV === 'production',
    callbacks: {
        async jwt({ token, account, user }) {
            // Initial sign in
            if (account && user) {
                return {
                    ...token,
                    accessToken: account.access_token,
                    refreshToken: account.refresh_token,
                    expiresAt: account.expires_at,  // UNIX timestamp in seconds
                    id: user.id,
                };
            }

            // Return previous token if the access token has not expired yet
            // expiresAt checks are good practice but for MVP we might just use what we have or refresh execution-time
            // But we need to refresh it if expired.
            // For now, let's just pass it through. If we need rotation, we'll add it.
            return token;
        },
        async session({ session, token }) {
            if (session.user) {
                session.user.id = token.id as string;
            }
            return session;
        },
        async redirect({ url, baseUrl }) {
            // Always use relative URLs so they respect the current origin (ngrok or localhost)
            // This ensures redirects work correctly regardless of NEXTAUTH_URL setting
            
            // If url is already relative, return as-is
            if (url.startsWith("/")) return url;
            
            // If url is absolute, extract just the path to make it relative
            try {
                const urlObj = new URL(url);
                // Return relative path with query string if present
                return urlObj.pathname + (urlObj.search || '');
            } catch (e) {
                // If URL parsing fails, check if it's a relative path
                if (url.startsWith("/")) return url;
                // Default: return relative path to home
                return "/";
            }
        },
    },
    secret: process.env.NEXTAUTH_SECRET,
};
