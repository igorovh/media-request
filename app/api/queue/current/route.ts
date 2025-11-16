import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth-utils"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    // First, check if there's already a PLAYING request (current video)
    let currentRequest = await prisma.mediaRequest.findFirst({
      where: {
        streamerId: session.user.id,
        status: "PLAYING",
      },
      orderBy: {
        updatedAt: "desc", // Get the most recently updated PLAYING request
      },
    })

    // If no PLAYING request, get the oldest PENDING request and mark it as PLAYING
    if (!currentRequest) {
      currentRequest = await prisma.mediaRequest.findFirst({
        where: {
          streamerId: session.user.id,
          status: "PENDING",
        },
        orderBy: {
          createdAt: "asc",
        },
      })

      if (currentRequest) {
        // Update status to PLAYING
        currentRequest = await prisma.mediaRequest.update({
          where: { id: currentRequest.id },
          data: { status: "PLAYING" },
        })
      }
    }

    if (!currentRequest) {
      return NextResponse.json({ currentRequest: null })
    }

    return NextResponse.json({
      currentRequest: {
        id: currentRequest.id,
        originalUrl: currentRequest.originalUrl,
        processedUrl: currentRequest.processedUrl,
        playerType: currentRequest.playerType,
        requestedBy: currentRequest.requestedBy,
        status: currentRequest.status,
      },
    })
  } catch (error) {
    console.error("Error fetching current request:", error)
    return NextResponse.json(
      { error: "Failed to fetch current request" },
      { status: 500 }
    )
  }
}

