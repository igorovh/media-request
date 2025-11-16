import { redirect } from "next/navigation"
import { auth } from "@/lib/auth-utils"
import SignInButton from "@/components/SignInButton"

export default async function Home() {
  const session = await auth()

  if (session) {
    redirect("/dashboard")
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="card p-8 max-w-md w-full">
        <h1 className="text-4xl font-bold text-text-light mb-2 text-center">
          Media Request
        </h1>
        <p className="text-text-gray text-center mb-8">
          Connect your Twitch account to manage viewer media requests
        </p>
        <SignInButton />
      </div>
    </div>
  )
}

