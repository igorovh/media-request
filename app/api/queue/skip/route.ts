import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth-utils"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const skipRequestSchema = z.object({
  id: z.string(),
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
    const { id } = skipRequestSchema.parse(body)

    // Verify the request belongs to the authenticated streamer
    const mediaRequest = await prisma.mediaRequest.findUnique({
      where: { id },
    })

    if (!mediaRequest) {
      return NextResponse.json(
        { error: "Media request not found" },
        { status: 404 }
      )
    }

    if (mediaRequest.streamerId !== session.user.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 403 }
      )
    }

    // If this is the currently playing video, mark it as PLAYED first
    // This will cause the player to stop and move to the next video
    // The player polls for PLAYING videos, so marking as PLAYED will make it stop
    if (mediaRequest.status === "PLAYING") {
      await prisma.mediaRequest.update({
        where: { id },
        data: { status: "PLAYED" },
      })
      // Don't delete immediately - let the player detect the status change first
      // The video will be cleaned up later or can be deleted in a separate cleanup job
    } else {
      // Not currently playing, just delete it
      await prisma.mediaRequest.delete({
        where: { id },
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error skipping request:", error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: "Failed to skip request" },
      { status: 500 }
    )
  }
}

