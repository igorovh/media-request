import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth-utils"
import { prisma } from "@/lib/prisma"
import { randomBytes } from "crypto"

// Generate a cuid-like token
function generateToken(): string {
  const timestamp = Date.now().toString(36)
  const random = randomBytes(16).toString("hex")
  return `cl${timestamp}${random}`
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    // Generate a new player token
    let newToken = generateToken()
    
    // Ensure uniqueness (retry if collision, though very unlikely)
    let attempts = 0
    while (attempts < 5) {
      const existing = await prisma.user.findUnique({
        where: { playerToken: newToken },
      })
      if (!existing) break
      newToken = generateToken()
      attempts++
    }

    // Update user with new player token
    const updatedUser = await prisma.user.update({
      where: { id: session.user.id },
      data: { playerToken: newToken },
    })

    return NextResponse.json({ 
      success: true,
      playerToken: updatedUser.playerToken
    })
  } catch (error) {
    console.error("Error resetting player token:", error)
    return NextResponse.json(
      { error: "Failed to reset player token" },
      { status: 500 }
    )
  }
}

