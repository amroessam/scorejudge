import { NextRequest, NextResponse } from "next/server";
import { getAuthToken } from "@/lib/auth-utils";
import { getUserByEmail, updateUser } from "@/lib/db";
import { validateCSRF } from "@/lib/csrf";

export async function GET(req: NextRequest) {
    const token = await getAuthToken(req);

    if (!token || !token.email) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const user = await getUserByEmail(token.email);
        if (!user) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        return NextResponse.json({
            email: user.email,
            name: user.name,
            display_name: user.display_name,
            image: user.image,
            isNew: !user.display_name
        });
    } catch (error) {
        console.error('[GET /api/user/profile] Error:', error);
        return NextResponse.json({ error: "Failed to fetch profile" }, { status: 500 });
    }
}

export async function PATCH(req: NextRequest) {
    // Validate CSRF protection
    if (!validateCSRF(req)) {
        return NextResponse.json({ error: "CSRF validation failed" }, { status: 403 });
    }

    const token = await getAuthToken(req);

    if (!token || !token.email) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await req.json();
        const { display_name, image } = body;

        // Server-side validation for display_name length
        if (display_name && display_name.length > 12) {
            return NextResponse.json({ error: "Display name must be 12 characters or less" }, { status: 400 });
        }

        const user = await getUserByEmail(token.email);
        if (!user) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        const updatedUser = await updateUser(user.id, {
            display_name,
            image
        });

        if (!updatedUser) {
            return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
        }

        return NextResponse.json(updatedUser);
    } catch (error) {
        console.error('[PATCH /api/user/profile] Error:', error);
        return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
    }
}
