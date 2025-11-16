import { create } from "zustand"

interface MediaRequest {
  id: string
  originalUrl: string
  requestedBy: string
  createdAt: string
}

interface QueueStore {
  requests: MediaRequest[]
  fetchRequests: () => Promise<void>
  skipRequest: (id: string) => Promise<void>
  removeRequest: (id: string) => Promise<void>
}

export const useQueueStore = create<QueueStore>((set) => ({
  requests: [],
  fetchRequests: async () => {
    try {
      const response = await fetch("/api/queue/list")
      if (response.ok) {
        const data = await response.json()
        set({ requests: data.requests })
      }
    } catch (error) {
      console.error("Error fetching requests:", error)
    }
  },
  skipRequest: async (id: string) => {
    try {
      await fetch("/api/queue/skip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      })
      // Refresh the list
      const response = await fetch("/api/queue/list")
      if (response.ok) {
        const data = await response.json()
        set({ requests: data.requests })
      }
    } catch (error) {
      console.error("Error skipping request:", error)
    }
  },
  removeRequest: async (id: string) => {
    try {
      await fetch("/api/queue/skip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      })
      // Refresh the list
      const response = await fetch("/api/queue/list")
      if (response.ok) {
        const data = await response.json()
        set({ requests: data.requests })
      }
    } catch (error) {
      console.error("Error removing request:", error)
    }
  },
}))

