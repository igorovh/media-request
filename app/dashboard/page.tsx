import { redirect } from "next/navigation"
import { auth } from "@/lib/auth-utils"
import DashboardClient from "@/components/DashboardClient"

export default async function DashboardPage() {
  const session = await auth()

  if (!session) {
    redirect("/")
  }

  return <DashboardClient user={session.user} />
}

