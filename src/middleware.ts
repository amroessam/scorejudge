import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

const PROTECTED_METHODS = ['POST', 'PATCH', 'PUT', 'DELETE'];

const PUBLIC_MUTATION_PATHS = [
    '/api/auth',
];

export async function middleware(req: NextRequest) {
    const { pathname } = req.nextUrl;

    if (!pathname.startsWith('/api/')) {
        return NextResponse.next();
    }

    if (!PROTECTED_METHODS.includes(req.method)) {
        return NextResponse.next();
    }

    if (PUBLIC_MUTATION_PATHS.some(p => pathname.startsWith(p))) {
        return NextResponse.next();
    }

    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (!token) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.next();
}

export const config = {
    matcher: '/api/:path*',
};
