import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { isValidVideoUrl, getPlayerType, isValidTikTokUrl, validateTikTokUrl } from "@/lib/video-scraper"
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

    // Validate URL is from a whitelisted service
    if (!isValidVideoUrl(url)) {
      return NextResponse.json(
        { error: "Video source not supported. Supported services: YouTube, TikTok, Streamable, Nuuls" },
        { status: 400 }
      )
    }

    // For TikTok URLs, validate that they resolve to a proper video URL with ID
    if (isValidTikTokUrl(url)) {
      const isValid = await validateTikTokUrl(url)
      if (!isValid) {
        return NextResponse.json(
          { error: "Invalid TikTok URL. The URL must resolve to a valid video." },
          { status: 400 }
        )
      }
    }

    // Determine player type
    const playerType = getPlayerType(url)
    
    // For YouTube, store the URL directly (it doesn't expire)
    // For other services, we'll extract the MP4 URL on-demand when playing
    // Store originalUrl as processedUrl for now (will be replaced on-demand for non-YouTube)
    const processedUrl = url

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

