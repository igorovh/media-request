import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const toggleRequestSchema = z.object({
  token: z.string(),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { token } = toggleRequestSchema.parse(body)

    // Find streamer by token
    const streamer = await prisma.user.findUnique({
      where: { playerToken: token },
    })

    if (!streamer) {
      return NextResponse.json(
        { error: "Invalid token" },
        { status: 401 }
      )
    }

    // Toggle player paused state
    const updatedUser = await prisma.user.update({
      where: { playerToken: token },
      data: { playerPaused: !streamer.playerPaused },
    })

    return NextResponse.json({ 
      success: true,
      paused: updatedUser.playerPaused
    })
  } catch (error) {
    console.error("Error toggling player:", error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: "Failed to toggle player" },
      { status: 500 }
    )
  }
}

