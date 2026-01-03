import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { DEBUG_MODE } from "./config";
import { upsertUser } from "./db";

const providers: any[] = [
    GoogleProvider({
        clientId: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        authorization: {
            params: {
                scope: "openid email profile",
                prompt: "consent",
                access_type: "offline",
                response_type: "code",
            },
        },
    }),
];

// Add anonymous credentials provider in debug mode
if (DEBUG_MODE) {
    providers.push(
        CredentialsProvider({
            name: "anonymous",
            credentials: {},
            async authorize() {
                // Generate a unique anonymous user
                const id = `anon_${Date.now()}_${Math.random().toString(36).substring(7)}`;
                return {
                    id,
                    name: `Anonymous User ${id.substring(5, 13)}`,
                    email: `anonymous-${id}@debug.local`,
                };
            },
        })
    );
}

export const authOptions: NextAuthOptions = {
    providers,
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
        async signIn({ user, account, profile }) {
            if (user.email) {
                await upsertUser({
                    id: user.id, // Pass the user ID from NextAuth
                    email: user.email,
                    name: user.name || undefined,
                    image: user.image || undefined,
                    google_sub: profile?.sub || undefined,
                });
            }
            return true;
        },
        async jwt({ token, account, user }) {
            // Initial sign in
            if (account && user) {
                return {
                    ...token,
                    accessToken: account.access_token,
                    refreshToken: account.refresh_token,
                    expiresAt: account.expires_at,  // UNIX timestamp in seconds
                    id: user.id,
                    picture: user.image || undefined,
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
                if (token.picture) {
                    session.user.image = token.picture as string;
                }
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
