"use client"

import { useState, useEffect, useCallback } from "react"
import { useSession, signOut } from "next-auth/react"
import { getBotInstance } from "@/lib/twitch-bot"
import { useQueueStore } from "@/store/queue-store"

interface DashboardClientProps {
  user: {
    id: string
    username: string
    playerToken: string
  }
}

export default function DashboardClient({ user }: DashboardClientProps) {
  const { data: session } = useSession()
  const [botConnected, setBotConnected] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [copied, setCopied] = useState(false)
  const [playerPaused, setPlayerPaused] = useState(false)
  const [playerVolume, setPlayerVolume] = useState(0.0)
  const [currentPlaying, setCurrentPlaying] = useState<{ id: string; originalUrl: string; requestedBy: string } | null>(null)
  const { requests, fetchRequests, skipRequest, removeRequest } = useQueueStore()

  const [playerUrl, setPlayerUrl] = useState("")

  useEffect(() => {
    if (typeof window !== "undefined") {
      setPlayerUrl(`${window.location.origin}/player/${user.playerToken}`)
    }
  }, [user.playerToken])

  useEffect(() => {
    fetchRequests()
    const interval = setInterval(fetchRequests, 5000) // Poll every 5 seconds
    return () => clearInterval(interval)
  }, [fetchRequests])

  // Fetch currently playing video
  useEffect(() => {
    const fetchCurrentPlaying = async () => {
      try {
        const response = await fetch("/api/queue/current")
        if (response.ok) {
          const data = await response.json()
          if (data.currentRequest) {
            setCurrentPlaying({
              id: data.currentRequest.id,
              originalUrl: data.currentRequest.originalUrl,
              requestedBy: data.currentRequest.requestedBy,
            })
          } else {
            setCurrentPlaying(null)
          }
        }
      } catch (error) {
        console.error("Error fetching current playing:", error)
      }
    }
    fetchCurrentPlaying()
    const interval = setInterval(fetchCurrentPlaying, 5000)
    return () => clearInterval(interval)
  }, [])

  const handleConnectBot = useCallback(async () => {
    if (botConnected) {
      const bot = getBotInstance()
      await bot.disconnect()
      setBotConnected(false)
      return
    }

    setConnecting(true)
    try {
      const bot = getBotInstance()

      bot.onMessage(async ({ username, message: url }) => {
        // Call the queue/add endpoint
        try {
          const addResponse = await fetch("/api/queue/add", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              url,
              requestedBy: username,
              streamerId: user.id,
            }),
          })

          if (addResponse.ok) {
            fetchRequests()
          }
          // No bot message sent - bot is anonymous and doesn't send messages
        } catch (error) {
          console.error("Error adding to queue:", error)
        }
      })

      bot.onCommand(async ({ command }) => {
        // Handle pause/play commands from moderators/broadcaster
        try {
          if (command === "pause" || command === "play") {
            const shouldPause = command === "pause"
            
            // Set player state directly
            const response = await fetch("/api/player/set-state", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ 
                token: user.playerToken,
                paused: shouldPause 
              }),
            })
            
            if (response.ok) {
              const data = await response.json()
              setPlayerPaused(data.paused)
            }
          }
        } catch (error) {
          console.error("Error handling player command:", error)
        }
      })

      bot.onConnected(() => {
        setBotConnected(true)
        setConnecting(false)
      })

      bot.onDisconnected(() => {
        setBotConnected(false)
      })

      // Connect the bot anonymously (no OAuth token needed)
      await bot.connect(user.username)
    } catch (error) {
      console.error("Error connecting bot:", error)
      setConnecting(false)
      alert("Failed to connect bot. Please try again.")
    }
  }, [botConnected, user.id, user.username, fetchRequests])

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(playerUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleSkip = async (id: string) => {
    try {
      await fetch("/api/queue/skip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      })
      fetchRequests()
    } catch (error) {
      console.error("Error skipping request:", error)
    }
  }

  const handleRemove = async (id: string) => {
    try {
      await fetch("/api/queue/skip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      })
      fetchRequests()
    } catch (error) {
      console.error("Error removing request:", error)
    }
  }

  const handleTogglePlayer = async () => {
    try {
      const response = await fetch("/api/player/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: user.playerToken }),
      })
      
      if (response.ok) {
        const data = await response.json()
        setPlayerPaused(data.paused)
      }
    } catch (error) {
      console.error("Error toggling player:", error)
    }
  }

  const handleResetToken = async () => {
    if (!confirm("Are you sure you want to reset your player URL? You'll need to update it in OBS.")) {
      return
    }

    try {
      const response = await fetch("/api/player/reset-token", {
        method: "POST",
      })
      
      if (response.ok) {
        const data = await response.json()
        // Update the player URL with new token
        if (typeof window !== "undefined") {
          setPlayerUrl(`${window.location.origin}/player/${data.playerToken}`)
        }
        // Refresh the page to get updated session
        window.location.reload()
      } else {
        alert("Failed to reset player token. Please try again.")
      }
    } catch (error) {
      console.error("Error resetting token:", error)
      alert("Failed to reset player token. Please try again.")
    }
  }

  // Check player state on mount and periodically
  useEffect(() => {
    const checkPlayerState = async () => {
      try {
        const response = await fetch(`/api/player/state?token=${user.playerToken}`)
        if (response.ok) {
          const data = await response.json()
          setPlayerPaused(data.paused)
          if (typeof data.volume === "number") {
            setPlayerVolume(data.volume)
          }
        }
      } catch (error) {
        console.error("Error checking player state:", error)
      }
    }

    checkPlayerState()
    const interval = setInterval(checkPlayerState, 2000) // Check every 2 seconds
    return () => clearInterval(interval)
  }, [user.playerToken])

  const handleVolumeChange = async (newVolume: number) => {
    try {
      const response = await fetch("/api/player/volume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ volume: newVolume }),
      })
      
      if (response.ok) {
        const data = await response.json()
        setPlayerVolume(data.volume)
      }
    } catch (error) {
      console.error("Error setting volume:", error)
    }
  }

  const handleSkipCurrent = async () => {
    if (!currentPlaying) return
    
    try {
      await fetch("/api/queue/skip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: currentPlaying.id }),
      })
      
      // Immediately clear current playing
      setCurrentPlaying(null)
      
      // Refresh both the queue and current playing video
      fetchRequests()
      
      // Fetch the new current playing video
      const fetchCurrentPlaying = async () => {
        try {
          const response = await fetch("/api/queue/current")
          if (response.ok) {
            const data = await response.json()
            if (data.currentRequest) {
              setCurrentPlaying({
                id: data.currentRequest.id,
                originalUrl: data.currentRequest.originalUrl,
                requestedBy: data.currentRequest.requestedBy,
              })
            } else {
              setCurrentPlaying(null)
            }
          }
        } catch (error) {
          console.error("Error fetching current playing:", error)
        }
      }
      
      // Wait a bit for the deletion to complete, then fetch new current video
      setTimeout(() => {
        fetchCurrentPlaying()
      }, 300)
    } catch (error) {
      console.error("Error skipping current video:", error)
    }
  }

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-6xl mx-auto">
        <div className="card p-8">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl font-bold text-text-light mb-2">
                Welcome, {user.username}!
              </h1>
              <p className="text-text-gray">Manage your media request queue</p>
            </div>
            <button
              onClick={() => signOut()}
              className="btn-secondary"
            >
              Sign Out
            </button>
          </div>

          {/* Main Content: Left (Bot & URL) and Right (Controls) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Left Side: Twitch Bot and OBS Player URL (stacked) */}
            <div className="space-y-6">
              {/* Twitch Bot */}
              <div className="card p-6">
                <h2 className="text-xl font-semibold text-text-light mb-4">
                  Twitch Bot
                </h2>
                <button
                  onClick={handleConnectBot}
                  disabled={connecting}
                  className={`w-full btn-primary ${
                    botConnected
                      ? "!bg-red-600 hover:!bg-red-700"
                      : ""
                  }`}
                >
                  {connecting
                    ? "Connecting..."
                    : botConnected
                    ? "Disconnect Bot"
                    : "Connect Bot"}
                </button>
                {botConnected && (
                  <p className="text-primary-light mt-2 text-sm">
                    ✓ Bot is connected to your chat
                  </p>
                )}
              </div>

              {/* OBS Player URL */}
              <div className="card p-6">
                <h2 className="text-xl font-semibold text-text-light mb-4">
                  OBS Player URL
                </h2>
                {!user.playerToken ? (
                  <div className="space-y-3">
                    <p className="text-primary-light text-sm">
                      Player token is missing. Please reset it.
                    </p>
                    <button
                      onClick={handleResetToken}
                      className="w-full btn-primary"
                    >
                      Generate Player Token
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="flex gap-2 mb-3">
                      <input
                        type="text"
                        value={playerUrl || "Loading..."}
                        readOnly
                        className="input flex-1"
                        placeholder={playerUrl || "Generating URL..."}
                      />
                      <button
                        onClick={handleCopyUrl}
                        className="btn-secondary"
                        disabled={!playerUrl}
                      >
                        {copied ? "Copied!" : "Copy"}
                      </button>
                    </div>
                    <div className="flex gap-2 mb-3">
                      <button
                        onClick={handleResetToken}
                        className="btn-secondary"
                        title="Reset Player URL"
                      >
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
                        </svg>
                      </button>
                    </div>
                    <p className="text-text-gray text-sm">
                      Add this URL as a Browser Source in OBS
                    </p>
                  </>
                )}
              </div>
            </div>

            {/* Right Side: Player Controls */}
            <div className="card p-6">
              <h2 className="text-xl font-semibold text-text-light mb-4">
                Player Controls
              </h2>
              
              {/* Volume - Full Width */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-text-light mb-3">
                  Volume: {Math.round(playerVolume * 100)}%
                </label>
                <div className="flex items-center gap-3">
                  <svg className="w-5 h-5 text-text-light flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                    {playerVolume === 0 ? (
                      <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
                    ) : playerVolume < 0.5 ? (
                      <path d="M18.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM5 9v6h4l5 5V4L9 9H5z"/>
                    ) : (
                      <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
                    )}
                  </svg>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={playerVolume}
                    onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                    className="flex-1"
                  />
                  <span className="text-text-light text-sm w-12 text-right">
                    {Math.round(playerVolume * 100)}%
                  </span>
                </div>
              </div>

              {/* Play/Pause and Skip Buttons */}
              <div className="grid grid-cols-2 gap-4">
                {/* Play/Pause */}
                <button
                  onClick={handleTogglePlayer}
                  className="btn-primary"
                >
                  {playerPaused ? (
                    <>
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z"/>
                      </svg>
                      Play
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
                      </svg>
                      Pause
                    </>
                  )}
                </button>

                {/* Skip Current */}
                <button
                  onClick={handleSkipCurrent}
                  disabled={!currentPlaying}
                  className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M6 19h8v-2H6v2zM18 5h-2v2h-2v2h2v2h2V9h2V7h-2V5zM4 13h8v-2H4v2zm0-4h8V7H4v2zm0 8h8v-2H4v2z"/>
                  </svg>
                  Skip
                </button>
              </div>

              {/* Current Video Info */}
              {currentPlaying && (
                <div className="mt-4 p-3 card">
                  <p className="text-xs text-text-gray mb-1">Now Playing:</p>
                  <p className="text-sm text-text-light truncate" title={currentPlaying.originalUrl}>
                    {currentPlaying.originalUrl}
                  </p>
                  <p className="text-xs text-text-gray mt-1">
                    by {currentPlaying.requestedBy}
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="card p-6">
            <h2 className="text-xl font-semibold text-text-light mb-4">
              Queue ({requests.length})
            </h2>
            {requests.length === 0 ? (
              <p className="text-text-gray text-center py-8">
                No pending requests. Viewers can use !mr [url] in your chat.
              </p>
            ) : (
              <div className="space-y-3">
                {requests.map((request) => (
                  <div
                    key={request.id}
                    className="card p-4 flex items-center justify-between"
                  >
                    <div className="flex-1">
                      <p className="text-text-light font-medium">
                        {request.requestedBy}
                      </p>
                      <p className="text-text-gray text-sm truncate">
                        {request.originalUrl}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleSkip(request.id)}
                        className="btn-secondary text-sm py-1 px-3"
                      >
                        Skip
                      </button>
                      <button
                        onClick={() => handleRemove(request.id)}
                        className="btn-secondary text-sm py-1 px-3 !bg-red-600 hover:!bg-red-700 !border-red-600"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

