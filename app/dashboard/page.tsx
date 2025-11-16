import { redirect } from "next/navigation"
import Link from "next/link"
import { auth } from "@/lib/auth-utils"
import { prisma } from "@/lib/prisma"
import DashboardClient from "@/components/DashboardClient"

export default async function DashboardPage() {
  const session = await auth()

  if (!session) {
    redirect("/")
  }

  // Check if user has access
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { hasAccess: true },
  })

  if (!user || !user.hasAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <div className="card p-8 max-w-md w-full text-center">
          <h1 className="text-3xl font-bold text-text-light mb-4">
            Access Denied
          </h1>
          <p className="text-text-gray mb-6">
            You don't have access to the dashboard.
          </p>
          <div className="space-y-3">
            <p className="text-text-light text-sm">
              To request access, please contact:
            </p>
            <div className="space-y-2">
              <a
                href="https://discord.com/users/igorovh"
                target="_blank"
                rel="noopener noreferrer"
                className="block text-primary-light hover:text-primary-dark transition-colors"
              >
                Discord: igorovh
              </a>
              <a
                href="mailto:contact@igor.ovh"
                className="block text-primary-light hover:text-primary-dark transition-colors"
              >
                Email: contact@igor.ovh
              </a>
            </div>
            <Link
              href="/"
              className="btn-secondary mt-6 inline-block"
            >
              Go Back
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return <DashboardClient user={session.user} />
}

