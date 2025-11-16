import { authOptions } from "./auth"
import NextAuth from "next-auth"

// Create the NextAuth handler - this returns an object with GET, POST, and auth methods
export const { handlers, auth, signIn, signOut } = NextAuth(authOptions)

