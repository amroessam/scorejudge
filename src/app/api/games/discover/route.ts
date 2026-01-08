import { NextRequest, NextResponse } from "next/server";
import { getAuthToken } from "@/lib/auth-utils";
import { getDiscoverableGames } from "@/lib/db";

export async function GET(req: NextRequest) {
    const token = await getAuthToken(req);

    if (!token || !token.email) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const discoverableGames = await getDiscoverableGames(token.email);
        return NextResponse.json(discoverableGames);
    } catch (error) {
        console.error('Error fetching discoverable games:', error);
        return NextResponse.json({ error: "Failed to fetch discoverable games" }, { status: 500 });
    }
}
