import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth-utils"
import { prisma } from "@/lib/prisma"
import { decrypt } from "@/lib/encryption"

export async function POST(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    })

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      )
    }

    // Return bot connection info (the actual connection will be handled client-side)
    // We return the username and a flag that connection should be initiated
    return NextResponse.json({
      success: true,
      username: user.username.toLowerCase(),
      message: "Bot connection initiated. Check your Twitch chat.",
    })
  } catch (error) {
    console.error("Error connecting bot:", error)
    return NextResponse.json(
      { error: "Failed to connect bot" },
      { status: 500 }
    )
  }
}

