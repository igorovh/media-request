import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth-utils"
import { prisma } from "@/lib/prisma"

export async function POST(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    // Delete all media requests for this streamer EXCEPT the currently playing one
    // Get the currently playing video ID first
    const currentlyPlaying = await prisma.mediaRequest.findFirst({
      where: {
        streamerId: session.user.id,
        status: "PLAYING",
      },
      select: {
        id: true,
      },
    })

    // Delete all requests except the currently playing one
    await prisma.mediaRequest.deleteMany({
      where: {
        streamerId: session.user.id,
        ...(currentlyPlaying ? {
          NOT: {
            id: currentlyPlaying.id,
          },
        } : {}),
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error clearing queue:", error)
    return NextResponse.json(
      { error: "Failed to clear queue" },
      { status: 500 }
    )
  }
}

