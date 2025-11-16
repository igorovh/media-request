import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth-utils"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const completeRequestSchema = z.object({
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
    const { id } = completeRequestSchema.parse(body)

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

    // Update status to PLAYED
    await prisma.mediaRequest.update({
      where: { id },
      data: { status: "PLAYED" },
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

