import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get("token")

    let streamerId: string | null = null

    if (token) {
      // Called from player with token
      const streamer = await prisma.user.findUnique({
        where: { playerToken: token },
        select: { id: true },
      })

      if (!streamer) {
        return NextResponse.json(
          { error: "Invalid token" },
          { status: 401 }
        )
      }

      streamerId = streamer.id
    } else {
      // Called from dashboard - use authenticated user
      const { auth } = await import("@/lib/auth-utils")
      const session = await auth()

      if (!session?.user?.id) {
        return NextResponse.json(
          { error: "Unauthorized" },
          { status: 401 }
        )
      }

      streamerId = session.user.id
    }

    if (!streamerId) {
      return NextResponse.json(
        { error: "Streamer not found" },
        { status: 404 }
      )
    }

    // Get current playing video
    const currentRequest = await prisma.mediaRequest.findFirst({
      where: {
        streamerId,
        status: "PLAYING",
      },
      select: {
        id: true,
      },
    })

    if (!currentRequest) {
      return NextResponse.json({
        currentTime: 0,
        duration: 0,
        title: null,
      })
    }

    // Return position data (stored in memory/global state, will be updated by player)
    const positionData = (global as any).playerPositions?.[currentRequest.id] || {
      currentTime: 0,
      duration: 0,
      title: null,
    }

    return NextResponse.json(positionData)
  } catch (error) {
    console.error("Error getting player position:", error)
    return NextResponse.json(
      { error: "Failed to get player position" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { token, currentTime, duration, title } = body

    if (!token) {
      return NextResponse.json(
        { error: "Token is required" },
        { status: 400 }
      )
    }

    // Find streamer by token
    const streamer = await prisma.user.findUnique({
      where: { playerToken: token },
      select: { id: true },
    })

    if (!streamer) {
      return NextResponse.json(
        { error: "Invalid token" },
        { status: 401 }
      )
    }

    // Get current playing video
    const currentRequest = await prisma.mediaRequest.findFirst({
      where: {
        streamerId: streamer.id,
        status: "PLAYING",
      },
      select: {
        id: true,
      },
    })

    if (!currentRequest) {
      return NextResponse.json(
        { error: "No video currently playing" },
        { status: 404 }
      )
    }

    // Store position data in memory
    if (!(global as any).playerPositions) {
      (global as any).playerPositions = {}
    }
    (global as any).playerPositions[currentRequest.id] = {
      currentTime: currentTime || 0,
      duration: duration || 0,
      title: title || null,
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error setting player position:", error)
    return NextResponse.json(
      { error: "Failed to set player position" },
      { status: 500 }
    )
  }
}

