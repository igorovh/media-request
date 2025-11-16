import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth-utils"
import { prisma } from "@/lib/prisma"

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    // Get all PENDING and PLAYING requests for this streamer
    const requests = await prisma.mediaRequest.findMany({
      where: {
        streamerId: session.user.id,
        status: {
          in: ["PENDING", "PLAYING"],
        },
      },
      orderBy: {
        createdAt: "asc",
      },
      select: {
        id: true,
        originalUrl: true,
        requestedBy: true,
        createdAt: true,
        status: true,
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

