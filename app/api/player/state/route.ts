import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get("token")

    if (!token) {
      return NextResponse.json(
        { error: "Token is required" },
        { status: 400 }
      )
    }

    // Find streamer by token
    const streamer = await prisma.user.findUnique({
      where: { playerToken: token },
      select: { playerPaused: true, playerVolume: true },
    })

    if (!streamer) {
      return NextResponse.json(
        { error: "Invalid token" },
        { status: 401 }
      )
    }

    return NextResponse.json({ 
      paused: streamer.playerPaused,
      volume: streamer.playerVolume ?? 0.0
    })
  } catch (error) {
    console.error("Error getting player state:", error)
    return NextResponse.json(
      { error: "Failed to get player state" },
      { status: 500 }
    )
  }
}

