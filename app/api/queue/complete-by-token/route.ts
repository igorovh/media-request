import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const completeRequestSchema = z.object({
  id: z.string(),
  token: z.string(),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, token } = completeRequestSchema.parse(body)

    // Verify token and get streamer
    const streamer = await prisma.user.findUnique({
      where: { playerToken: token },
    })

    if (!streamer) {
      return NextResponse.json(
        { error: "Invalid token" },
        { status: 401 }
      )
    }

    // Verify the request belongs to this streamer
    const mediaRequest = await prisma.mediaRequest.findUnique({
      where: { id },
    })

    if (!mediaRequest) {
      return NextResponse.json(
        { error: "Media request not found" },
        { status: 404 }
      )
    }

    if (mediaRequest.streamerId !== streamer.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 403 }
      )
    }

    // Update status to PLAYED and remove from queue (delete the request)
    await prisma.mediaRequest.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error completing request:", error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: "Failed to complete request" },
      { status: 500 }
    )
  }
}

