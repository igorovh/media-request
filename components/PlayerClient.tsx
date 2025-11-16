"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import dynamic from "next/dynamic"

// Dynamically import ReactPlayer to avoid SSR issues
// Use lazy loading for better performance
const ReactPlayer = dynamic(() => import("react-player/lazy"), { 
  ssr: false,
  loading: () => <div className="w-full h-full flex items-center justify-center bg-black"><p className="text-white">Loading player...</p></div>
})

interface MediaRequest {
  id: string
  processedUrl: string
  playerType: "YOUTUBE" | "MP4"
}

interface PlayerClientProps {
  streamerId: string
}

export default function PlayerClient({ streamerId }: PlayerClientProps) {
  const [currentRequest, setCurrentRequest] = useState<MediaRequest | null>(
    null
  )
  const [loading, setLoading] = useState(true)
  const [isPlaying, setIsPlaying] = useState(true)
  const [showControls, setShowControls] = useState(false)
  const [playerReady, setPlayerReady] = useState(false)
  const [volume, setVolume] = useState(0.0)
  const videoRef = useRef<HTMLVideoElement>(null)
  const playerRef = useRef<any>(null) // ReactPlayer ref
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Clean YouTube URL to extract just the video ID
  const cleanYouTubeUrl = useCallback((url: string): string => {
    if (!url) return ""
    
    // Extract video ID from various YouTube URL formats
    let videoId = ""
    
    // Match youtube.com/watch?v=VIDEO_ID
    const watchMatch = url.match(/[?&]v=([^&]+)/)
    if (watchMatch && watchMatch[1]) {
      videoId = watchMatch[1]
    }
    
    // Match youtu.be/VIDEO_ID
    if (!videoId) {
      const shortMatch = url.match(/youtu\.be\/([^?&]+)/)
      if (shortMatch && shortMatch[1]) {
        videoId = shortMatch[1]
      }
    }
    
    // Match youtube.com/embed/VIDEO_ID
    if (!videoId) {
      const embedMatch = url.match(/youtube\.com\/embed\/([^?&]+)/)
      if (embedMatch && embedMatch[1]) {
        videoId = embedMatch[1]
      }
    }
    
    if (videoId) {
      // Return clean URL with just the video ID
      return `https://www.youtube.com/watch?v=${videoId}`
    }
    
    // Return original URL if we can't parse it
    console.warn("Could not extract video ID from URL:", url)
    return url
  }, [])

  const fetchAndPlayNext = useCallback(async () => {
    try {
      // Get token from URL
      const token = window.location.pathname.split("/player/")[1]
      if (!token) {
        console.error("No token found in URL")
        return
      }

      const response = await fetch(`/api/queue/current-by-token?token=${token}`)

      if (!response.ok) {
        throw new Error("Failed to fetch current request")
      }

      const data = await response.json()
      console.log("Fetched video data:", data)

      if (data.currentRequest) {
        // Check if it's a different video
        setCurrentRequest((prev) => {
          if (prev?.id === data.currentRequest.id) {
            // Same video, don't reset anything
            console.log("Same video, not updating state")
            setLoading(false)
            return prev
          }
          // Different video, update
          console.log("New video, updating state:", data.currentRequest)
          setLoading(true)
          setPlayerReady(false)
          setIsPlaying(true) // Ensure playing is set to true for new video
          return data.currentRequest
        })
        // Set loading false after a brief moment to allow video to load
        setTimeout(() => {
          setLoading(false)
          setIsPlaying(true) // Force playing state
        }, 100)
      } else {
        // No more requests - clear current video
        console.log("No videos in queue")
        setCurrentRequest(null)
        setLoading(false)
      }
    } catch (error) {
      console.error("Error fetching next video:", error)
      setLoading(false)
    }
  }, [])

  // Fetch current video on mount and poll for updates
  useEffect(() => {
    fetchAndPlayNext()
    
    // Poll for new videos every 5 seconds to catch skips and new videos
    const videoPollInterval = setInterval(() => {
      fetchAndPlayNext()
    }, 5000)
    
    return () => clearInterval(videoPollInterval)
  }, [fetchAndPlayNext])

  // Fetch initial player state (volume, paused) on mount
  useEffect(() => {
    const fetchInitialState = async () => {
      try {
        const token = window.location.pathname.split("/player/")[1]
        const response = await fetch(`/api/player/state?token=${token}`)
        if (response.ok) {
          const data = await response.json()
          setIsPlaying(!data.paused)
          if (typeof data.volume === "number") {
            setVolume(data.volume)
          }
        }
      } catch (error) {
        console.error("Error fetching initial player state:", error)
      }
    }
    fetchInitialState()
  }, [])

  // Check player state periodically
  useEffect(() => {
    if (!currentRequest) return // Don't check if no video
    
    const checkPlayerState = async () => {
      try {
        const token = window.location.pathname.split("/player/")[1]
        const response = await fetch(`/api/player/state?token=${token}`)
        if (response.ok) {
          const data = await response.json()
          // Only update if state actually changed to avoid unnecessary re-renders
          setIsPlaying((prev) => {
            const newState = !data.paused
            if (prev !== newState) {
              console.log("Player state changed:", newState ? "playing" : "paused")
            }
            return newState
          })
          
          // Update volume if provided
          if (typeof data.volume === "number") {
            setVolume(data.volume)
          }
          
          // Update video player state
          if (currentRequest.playerType === "MP4" && videoRef.current) {
            if (data.paused) {
              videoRef.current.pause()
            } else {
              videoRef.current.play().catch((error) => {
                console.error("Error playing video:", error)
              })
            }
            // Update volume
            if (typeof data.volume === "number") {
              videoRef.current.volume = data.volume
            }
          }
          // ReactPlayer will automatically respect isPlaying state
        }
      } catch (error) {
        console.error("Error checking player state:", error)
      }
    }

    checkPlayerState() // Check immediately
    const interval = setInterval(checkPlayerState, 3000) // Check every 3 seconds (less frequent)
    return () => clearInterval(interval)
  }, [currentRequest])

  const handleVideoEnd = async () => {
    if (currentRequest) {
      const videoIdToDelete = currentRequest.id
      
      // Clear current request immediately
      setCurrentRequest(null)
      setLoading(true)
      
      // Mark current request as complete and remove from queue
      try {
        const token = window.location.pathname.split("/player/")[1]
        const response = await fetch("/api/queue/complete-by-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: videoIdToDelete, token }),
        })
        
        if (!response.ok) {
          console.error("Failed to complete request")
        }
      } catch (error) {
        console.error("Error completing request:", error)
      }
      
      // Wait a bit for the deletion to complete, then fetch next video
      setTimeout(() => {
        fetchAndPlayNext()
      }, 500)
    }
  }

  const togglePlayPause = useCallback(() => {
    setIsPlaying((prev) => {
      const newPlayingState = !prev
      
      if (currentRequest?.playerType === "MP4" && videoRef.current) {
        if (newPlayingState) {
          videoRef.current.play().catch((error) => {
            console.error("Error playing video:", error)
          })
        } else {
          videoRef.current.pause()
        }
      }
      
      return newPlayingState
    })
  }, [currentRequest])

  // Keyboard controls
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault()
        togglePlayPause()
      }
    }

    window.addEventListener("keydown", handleKeyPress)
    return () => window.removeEventListener("keydown", handleKeyPress)
  }, [togglePlayPause])

  // Show controls on mouse move
  useEffect(() => {
    const handleMouseMove = () => {
      setShowControls(true)
      
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current)
      }
      
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false)
      }, 3000)
    }

    window.addEventListener("mousemove", handleMouseMove)
    return () => {
      window.removeEventListener("mousemove", handleMouseMove)
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current)
      }
    }
  }, [])

  // Handle HTML5 video ended event and ensure autoplay
  useEffect(() => {
    const video = videoRef.current
    if (video && currentRequest?.playerType === "MP4") {
      const handleEnd = () => handleVideoEnd()
      video.addEventListener("ended", handleEnd)
      
      // Ensure video plays
      if (isPlaying) {
        video.play().catch((error) => {
          console.error("Error playing video:", error)
        })
      }
      
      return () => {
        video.removeEventListener("ended", handleEnd)
      }
    }
  }, [currentRequest, isPlaying])

  // Ensure ReactPlayer plays when URL changes and update volume
  useEffect(() => {
    if (currentRequest?.playerType === "YOUTUBE") {
      // Force play when new video loads
      setIsPlaying(true)
      setPlayerReady(false) // Reset ready state for new video
      
      // If player is already ready, force play
      if (playerReady && playerRef.current) {
        setTimeout(() => {
          try {
            const internalPlayer = playerRef.current?.getInternalPlayer()
            if (internalPlayer && typeof internalPlayer.playVideo === "function") {
              internalPlayer.playVideo()
              console.log("Forced play on video change")
            }
          } catch (error) {
            console.error("Error forcing play on video change:", error)
          }
        }, 300)
      }
    }
  }, [currentRequest, playerReady])
  
  // Update ReactPlayer volume when volume changes
  useEffect(() => {
    if (currentRequest?.playerType === "YOUTUBE" && playerReady && playerRef.current) {
      try {
        const internalPlayer = playerRef.current.getInternalPlayer()
        if (internalPlayer) {
          if (volume > 0) {
            if (typeof internalPlayer.unMute === "function") {
              internalPlayer.unMute()
            }
            if (typeof internalPlayer.setVolume === "function") {
              internalPlayer.setVolume(volume * 100) // YouTube uses 0-100 scale
              console.log("Updated volume to:", volume * 100)
            }
          } else {
            if (typeof internalPlayer.mute === "function") {
              internalPlayer.mute()
              console.log("Muted player")
            }
          }
        }
      } catch (error) {
        console.error("Error updating volume on YouTube player:", error)
      }
    }
  }, [volume, currentRequest, playerReady])

  // Update video element volume when volume changes and ensure autoplay
  useEffect(() => {
    if (videoRef.current && currentRequest?.playerType === "MP4") {
      videoRef.current.volume = volume
      videoRef.current.muted = volume === 0
      
      // Ensure video is playing when volume changes
      if (isPlaying && videoRef.current.paused) {
        videoRef.current.play().catch((error) => {
          console.error("Error playing video after volume change:", error)
        })
      }
    }
  }, [volume, currentRequest, isPlaying])
  
  // Force play MP4 video when new video loads
  useEffect(() => {
    if (currentRequest?.playerType === "MP4" && videoRef.current) {
      setIsPlaying(true)
      // Try to play immediately
      videoRef.current.play().catch((error) => {
        console.error("Error autoplaying MP4 video:", error)
      })
    }
  }, [currentRequest])

  if (loading && !currentRequest) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-black">
        <p className="text-text-light">Loading...</p>
      </div>
    )
  }

  if (!currentRequest && !loading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-black">
        <p className="text-text-light text-xl">No videos in queue</p>
      </div>
    )
  }

  if (!currentRequest) {
    return null
  }

  return (
    <div 
      className="w-full h-full bg-black overflow-hidden relative" 
      style={{ margin: 0, padding: 0, height: "100vh", width: "100vw" }}
      onClick={togglePlayPause}
    >
      {currentRequest.playerType === "YOUTUBE" ? (
        <div style={{ width: "100%", height: "100%", position: "relative" }}>
          {currentRequest.processedUrl ? (
            <>
              {!playerReady && (
                <div className="absolute inset-0 flex items-center justify-center bg-black z-10">
                  <p className="text-white">Loading player...</p>
                </div>
              )}
              <ReactPlayer
                ref={playerRef}
                key={currentRequest.id} // Force re-render when video changes
                url={cleanYouTubeUrl(currentRequest.processedUrl)}
                playing={isPlaying}
                volume={volume}
                muted={volume === 0}
                controls={false}
                width="100%"
                height="100%"
                onEnded={handleVideoEnd}
                onReady={() => {
                  // Ensure video starts playing
                  console.log("ReactPlayer ready, setting playing to true")
                  console.log("Playing URL:", currentRequest.processedUrl)
                  console.log("Volume:", volume)
                  setPlayerReady(true)
                  setIsPlaying(true)
                  
                  // Force play and set volume
                  setTimeout(() => {
                    if (playerRef.current) {
                      try {
                        const internalPlayer = playerRef.current.getInternalPlayer()
                        if (internalPlayer) {
                          // Force play
                          if (typeof internalPlayer.playVideo === "function") {
                            internalPlayer.playVideo()
                            console.log("Forced video to play")
                          }
                          
                          // Set volume and unmute if needed
                          if (volume > 0) {
                            if (typeof internalPlayer.unMute === "function") {
                              internalPlayer.unMute()
                            }
                            if (typeof internalPlayer.setVolume === "function") {
                              internalPlayer.setVolume(volume * 100) // YouTube uses 0-100 scale
                              console.log("Unmuted and set volume to:", volume * 100)
                            }
                          }
                        }
                      } catch (error) {
                        console.error("Error setting volume/play on YouTube player:", error)
                      }
                    }
                  }, 500) // Wait a bit for player to fully initialize
                }}
                onPlay={() => {
                  console.log("ReactPlayer playing")
                  setIsPlaying(true)
                }}
                onPause={() => {
                  console.log("ReactPlayer paused")
                  setIsPlaying(false)
                }}
                onError={(error) => {
                  console.error("ReactPlayer error:", error)
                  setPlayerReady(false)
                }}
                onStart={() => {
                  console.log("ReactPlayer started")
                }}
                config={{
                  youtube: {
                    playerVars: {
                      autoplay: 1,
                      controls: 0,
                      modestbranding: 1,
                      rel: 0,
                      mute: volume === 0 ? 1 : 0, // Only mute if volume is 0
                      enablejsapi: 1,
                    },
                  },
                }}
              />
              {/* Debug info - remove in production */}
              {process.env.NODE_ENV === "development" && (
                <div style={{ position: "absolute", top: 0, left: 0, background: "rgba(0,0,0,0.7)", color: "white", padding: "4px", fontSize: "10px", zIndex: 1000 }}>
                  URL: {currentRequest.processedUrl}
                  <br />
                  Ready: {playerReady ? "Yes" : "No"}
                  <br />
                  Playing: {isPlaying ? "Yes" : "No"}
                </div>
              )}
            </>
          ) : (
            <div className="text-white flex items-center justify-center h-full">
              No video URL provided
            </div>
          )}
        </div>
      ) : (
      <video
        key={currentRequest.id} // Force re-render when video changes
        ref={videoRef}
        src={currentRequest.processedUrl}
        autoPlay
        muted={volume === 0}
        playsInline
        className="w-full h-full object-contain"
        onEnded={handleVideoEnd}
        onPlay={() => {
          console.log("Video playing")
          setIsPlaying(true)
        }}
        onPause={() => {
          console.log("Video paused")
          setIsPlaying(false)
        }}
        onLoadedData={() => {
          console.log("Video loaded, attempting to play")
          // Force play when video is loaded
          if (videoRef.current) {
            videoRef.current.play().catch((error) => {
              console.error("Error autoplaying video:", error)
            })
            setIsPlaying(true)
          }
        }}
        onCanPlay={() => {
          // Also try to play when video can play
          if (videoRef.current && isPlaying) {
            videoRef.current.play().catch((error) => {
              console.error("Error playing video on canPlay:", error)
            })
          }
        }}
        onError={(e) => {
          console.error("Video error:", e)
        }}
      />
      )}
      
      {/* Play/Pause Controls Overlay */}
      {showControls && (
        <div 
          className="absolute inset-0 flex items-center justify-center bg-black/20 transition-opacity duration-300"
          style={{ pointerEvents: "none" }}
        >
          <div className="bg-black/60 rounded-full p-4">
            {isPlaying ? (
              <svg className="w-16 h-16 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
              </svg>
            ) : (
              <svg className="w-16 h-16 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z"/>
              </svg>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

