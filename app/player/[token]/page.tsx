import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import PlayerClient from "@/components/PlayerClient"

interface PlayerPageProps {
  params: {
    token: string
  }
}

export default async function PlayerPage({ params }: PlayerPageProps) {
  const { token } = params

  // Validate token and get streamer
  const streamer = await prisma.user.findUnique({
    where: { playerToken: token },
  })

  if (!streamer) {
    notFound()
  }

  return (
    <div style={{ margin: 0, padding: 0, overflow: "hidden", height: "100vh", width: "100vw" }}>
      <PlayerClient streamerId={streamer.id} />
    </div>
  )
}

