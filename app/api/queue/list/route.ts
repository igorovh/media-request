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

    // Get all PENDING requests for this streamer
    const requests = await prisma.mediaRequest.findMany({
      where: {
        streamerId: session.user.id,
        status: "PENDING",
      },
      orderBy: {
        createdAt: "asc",
      },
      select: {
        id: true,
        originalUrl: true,
        requestedBy: true,
        createdAt: true,
      },
    })

    return NextResponse.json({ requests })
  } catch (error) {
    console.error("Error fetching queue list:", error)
    return NextResponse.json(
      { error: "Failed to fetch queue list" },
      { status: 500 }
    )
  }
}

