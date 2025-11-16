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

    // Delete all media requests for this streamer (except currently playing)
    // First, mark any currently playing video as PLAYED
    await prisma.mediaRequest.updateMany({
      where: {
        streamerId: session.user.id,
        status: "PLAYING",
      },
      data: {
        status: "PLAYED",
      },
    })

    // Then delete all requests (PENDING and PLAYED)
    await prisma.mediaRequest.deleteMany({
      where: {
        streamerId: session.user.id,
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

