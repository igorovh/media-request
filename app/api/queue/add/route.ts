import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getDirectVideoUrl, isYouTubeUrl } from "@/lib/video-scraper"
import { z } from "zod"

const addRequestSchema = z.object({
  url: z.string().url(),
  requestedBy: z.string(),
  streamerId: z.string(),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { url, requestedBy, streamerId } = addRequestSchema.parse(body)

    // Verify streamer exists
    const streamer = await prisma.user.findUnique({
      where: { id: streamerId },
    })

    if (!streamer) {
      return NextResponse.json(
        { error: "Streamer not found" },
        { status: 404 }
      )
    }

    let processedUrl: string
    let playerType: "YOUTUBE" | "MP4"

    if (isYouTubeUrl(url)) {
      // YouTube URLs are used directly
      processedUrl = url
      playerType = "YOUTUBE"
    } else {
      // Try to scrape direct video URL for other platforms
      const directUrl = await getDirectVideoUrl(url)
      
      if (!directUrl) {
        return NextResponse.json(
          { error: "Video source not supported or could not be processed" },
          { status: 400 }
        )
      }

      processedUrl = directUrl
      playerType = "MP4"
    }

    // Create the media request
    const mediaRequest = await prisma.mediaRequest.create({
      data: {
        originalUrl: url,
        processedUrl,
        playerType,
        requestedBy,
        streamerId,
        status: "PENDING",
      },
    })

    return NextResponse.json({
      success: true,
      mediaRequest: {
        id: mediaRequest.id,
        originalUrl: mediaRequest.originalUrl,
        requestedBy: mediaRequest.requestedBy,
      },
    })
  } catch (error) {
    console.error("Error adding to queue:", error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: "Failed to add to queue" },
      { status: 500 }
    )
  }
}

