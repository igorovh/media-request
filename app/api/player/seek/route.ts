import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth-utils"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const seekRequestSchema = z.object({
  time: z.number().min(0),
})

export async function POST(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { time } = seekRequestSchema.parse(body)

    // Get streamer's player token
    const streamer = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { playerToken: true },
    })

    if (!streamer?.playerToken) {
      return NextResponse.json(
        { error: "Player token not found" },
        { status: 404 }
      )
    }

    // Store seek request in memory (player will poll for this)
    if (!(global as any).seekRequests) {
      (global as any).seekRequests = {}
    }
    (global as any).seekRequests[streamer.playerToken] = {
      time,
      timestamp: Date.now(),
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error seeking:", error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: "Failed to seek" },
      { status: 500 }
    )
  }
}

// GET endpoint for player to check for seek requests
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

    // Check for seek request
    const seekRequest = (global as any).seekRequests?.[token]
    
    if (seekRequest && Date.now() - seekRequest.timestamp < 5000) {
      // Clear the seek request after returning it
      delete (global as any).seekRequests[token]
      return NextResponse.json({ seekTime: seekRequest.time })
    }

    return NextResponse.json({ seekTime: undefined })
  } catch (error) {
    console.error("Error getting seek request:", error)
    return NextResponse.json(
      { error: "Failed to get seek request" },
      { status: 500 }
    )
  }
}

