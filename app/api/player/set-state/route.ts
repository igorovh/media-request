import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const setStateRequestSchema = z.object({
  token: z.string(),
  paused: z.boolean(),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { token, paused } = setStateRequestSchema.parse(body)

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

    // Set player paused state
    const updatedUser = await prisma.user.update({
      where: { playerToken: token },
      data: { playerPaused: paused },
    })

    return NextResponse.json({ 
      success: true,
      paused: updatedUser.playerPaused
    })
  } catch (error) {
    console.error("Error setting player state:", error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: "Failed to set player state" },
      { status: 500 }
    )
  }
}

