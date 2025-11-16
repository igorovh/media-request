import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth-utils"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const setVolumeSchema = z.object({
  volume: z.number().min(0).max(1),
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
    const { volume } = setVolumeSchema.parse(body)

    // Update user's player volume
    const updatedUser = await prisma.user.update({
      where: { id: session.user.id },
      data: { playerVolume: volume },
    })

    return NextResponse.json({
      success: true,
      volume: updatedUser.playerVolume,
    })
  } catch (error) {
    console.error("Error setting player volume:", error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: "Failed to set player volume" },
      { status: 500 }
    )
  }
}

