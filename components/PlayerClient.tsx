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
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [title, setTitle] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const playerRef = useRef<any>(null) // ReactPlayer ref
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const positionUpdateIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const seekCheckIntervalRef = useRef<NodeJS.Timeout | null>(null)
  // Refs to track latest values for use in callbacks
  const durationRef = useRef(0)
  const titleRef = useRef<string | null>(null)
  const lastPositionUpdateRef = useRef<number>(0)
  const lastSeekTimeRef = useRef<number | null>(null)
  const currentTimeRef = useRef(0)
  const playerReadyRef = useRef(false)
  const currentRequestRef = useRef<MediaRequest | null>(null)
  const internalPlayerRef = useRef<any>(null) // Store the YouTube internal player directly

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
          // Different video, stop the old one first
          if (prev) {
            console.log("Stopping previous video before switching")
            // Stop the previous video
            if (playerRef.current) {
              try {
                const internalPlayer = internalPlayerRef.current || playerRef.current.getInternalPlayer()
                if (internalPlayer && typeof internalPlayer.pauseVideo === "function") {
                  internalPlayer.pauseVideo()
                }
              } catch (e) {
                // Ignore errors
              }
            }
            if (videoRef.current) {
              videoRef.current.pause()
            }
          }
          // Different video, update
          console.log("New video, updating state:", data.currentRequest)
          setLoading(true)
          setPlayerReady(false)
          setIsPlaying(true) // Ensure playing is set to true for new video
          currentRequestRef.current = data.currentRequest
          return data.currentRequest
        })
        // Don't set loading false here - let onReady/onLoadedData handle it
      } else {
        // No more requests - clear the current video immediately
        console.log("No videos in queue, clearing current video")
        setCurrentRequest(null)
        currentRequestRef.current = null
        setLoading(false)
        setIsPlaying(false)
        // Stop the video if it's playing
        if (playerRef.current) {
          try {
            const internalPlayer = internalPlayerRef.current || playerRef.current.getInternalPlayer()
            if (internalPlayer && typeof internalPlayer.pauseVideo === "function") {
              internalPlayer.pauseVideo()
            }
          } catch (e) {
            // Ignore errors
          }
        }
        if (videoRef.current) {
          videoRef.current.pause()
        }
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

  // Update position periodically and check for seek requests
  useEffect(() => {
    if (!currentRequest) return

    const token = window.location.pathname.split("/player/")[1]
    
    // Update position every second
    const updatePosition = async () => {
      try {
        // Don't update if player isn't ready yet
        if (currentRequest.playerType === "YOUTUBE" && !playerReady) {
          return
        }

        let newCurrentTime = 0
        let newDuration = 0
        let newTitle: string | null = null

        if (currentRequest.playerType === "YOUTUBE" && playerRef.current) {
          try {
            const internalPlayer = playerRef.current.getInternalPlayer()
            if (internalPlayer) {
              // Try to get current time
              if (typeof internalPlayer.getCurrentTime === "function") {
                try {
                  const time = internalPlayer.getCurrentTime()
                  if (time !== null && time !== undefined && !isNaN(time) && isFinite(time)) {
                    newCurrentTime = time
                  }
                } catch (e) {
                  console.warn("Error calling getCurrentTime:", e)
                }
              }
              
              // Try to get duration
              if (typeof internalPlayer.getDuration === "function") {
                try {
                  const dur = internalPlayer.getDuration()
                  if (dur !== null && dur !== undefined && !isNaN(dur) && isFinite(dur) && dur > 0) {
                    newDuration = dur
                  }
                } catch (e) {
                  console.warn("Error calling getDuration:", e)
                }
              }
              
              // Try to get title
              if (typeof internalPlayer.getVideoData === "function") {
                try {
                  const videoData = internalPlayer.getVideoData()
                  if (videoData && videoData.title) {
                    newTitle = videoData.title
                  }
                } catch (e) {
                  // getVideoData might throw, ignore
                }
              }
            } else {
              console.warn("YouTube internal player not available")
            }
          } catch (error) {
            console.error("Error getting YouTube player position:", error)
          }
        } else if (currentRequest.playerType === "MP4" && videoRef.current) {
          const video = videoRef.current
          if (video.readyState >= 2) { // HAVE_CURRENT_DATA or better
            newCurrentTime = video.currentTime || 0
            if (video.duration && isFinite(video.duration) && video.duration > 0) {
              newDuration = video.duration
            }
          }
        }

        // Update current time
        // If we're seeking, check if seek has completed
        if (lastSeekTimeRef.current !== null) {
          const seekTarget = lastSeekTimeRef.current
          const timeDifference = Math.abs(newCurrentTime - seekTarget)
          if (timeDifference < 2) {
            // Seek completed - clear the ref
            console.log("Seek completed, clearing ref. Target:", seekTarget, "Actual:", newCurrentTime)
            lastSeekTimeRef.current = null
            setCurrentTime(newCurrentTime)
          } else {
            // Still seeking - show seek target for now, but also track actual position
            setCurrentTime(seekTarget)
            currentTimeRef.current = seekTarget
          }
        } else if (newCurrentTime >= 0) {
          // Not seeking - update normally
          setCurrentTime(newCurrentTime)
          currentTimeRef.current = newCurrentTime
        }
        if (newDuration > 0) {
          setDuration(newDuration)
          durationRef.current = newDuration
        } else if (durationRef.current > 0) {
          // If we couldn't get duration from player but have it in ref, use ref value
          newDuration = durationRef.current
        }
        if (newTitle) {
          setTitle(newTitle)
          titleRef.current = newTitle
        } else if (titleRef.current) {
          // If we couldn't get title from player but have it in ref, use ref value
          newTitle = titleRef.current
        }

        // Send position update to API
        // For YouTube, send even if currentTime is 0 (video might be at start)
        // For MP4, only send if we have valid data
        const shouldSendUpdate = currentRequest.playerType === "YOUTUBE" 
          ? (newCurrentTime >= 0 && playerReady) // YouTube: send if we have any time value and player is ready
          : (newCurrentTime >= 0 || newDuration > 0) // MP4: send if we have time or duration
        
        if (shouldSendUpdate) {
          // Use seek target if we're seeking, otherwise use actual position
          const timeToSend = lastSeekTimeRef.current !== null 
            ? lastSeekTimeRef.current 
            : newCurrentTime
          
          // Use ref values as fallback to ensure we always send valid duration/title if we have them
          const positionData = {
            token,
            currentTime: timeToSend,
            duration: newDuration > 0 ? newDuration : (durationRef.current || 0),
            title: newTitle || titleRef.current,
          }
          console.log("Sending position update:", positionData)
          
          try {
            const response = await fetch("/api/player/position", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(positionData),
            })
            
            if (!response.ok) {
              const errorData = await response.json()
              console.error("Position update failed:", errorData)
            } else {
              console.log("Position update successful")
            }
          } catch (fetchError) {
            console.error("Error sending position update:", fetchError)
          }
        } else {
          console.log("Skipping position update - no valid data:", {
            currentTime: newCurrentTime,
            duration: newDuration,
            playerType: currentRequest.playerType,
            playerReady: currentRequest.playerType === "YOUTUBE" ? playerReady : true,
          })
        }
      } catch (error) {
        console.error("Error updating position:", error)
      }
    }

    // Check for seek requests
    const checkSeek = async () => {
      try {
        const response = await fetch(`/api/player/seek?token=${token}`)
        if (response.ok) {
          const data = await response.json()
          if (data.seekTime !== undefined && data.seekTime !== null) {
            console.log("🎯 Seek request received in player:", data.seekTime, "Current time:", currentTimeRef.current)
            // Store the seek time to prevent position updates from overwriting it
            lastSeekTimeRef.current = data.seekTime
            
            // Perform seek - use ref to get latest currentRequest
            const request = currentRequestRef.current || currentRequest
            const player = playerRef.current
            console.log("🔍 Seek debug - currentRequest:", !!request, "playerType:", request?.playerType, "playerRef:", !!player, "playerRef type:", typeof player, "has getInternalPlayer:", typeof player?.getInternalPlayer === "function")
            
            // Try to get player even if ref seems null - ReactPlayer might not have set it yet
            if (request && request.playerType === "YOUTUBE") {
              // First try to use the stored internal player ref (most reliable)
              if (internalPlayerRef.current) {
                console.log("✅ Using stored internal player ref for seek")
                performSeekDirect(internalPlayerRef.current, data.seekTime)
              } else if (player && typeof player.getInternalPlayer === "function") {
                // Try to get internal player from ReactPlayer ref
                try {
                  const internalPlayer = player.getInternalPlayer()
                  if (internalPlayer) {
                    internalPlayerRef.current = internalPlayer // Store it for next time
                    console.log("✅ Got internal player from ReactPlayer ref")
                    performSeekDirect(internalPlayer, data.seekTime)
                  } else {
                    console.warn("⚠️ getInternalPlayer returned null")
                    retrySeekWithBackoff(data.seekTime)
                  }
                } catch (error) {
                  console.error("❌ Error getting internal player:", error)
                  retrySeekWithBackoff(data.seekTime)
                }
              } else {
                // Player not ready, retry with exponential backoff
                console.warn("⚠️ playerRef not ready, retrying...")
                retrySeekWithBackoff(data.seekTime)
              }
              
              // Helper function for retry logic
              function retrySeekWithBackoff(seekTime: number) {
                let retryCount = 0
                const maxRetries = 5
                const retrySeek = () => {
                  retryCount++
                  // Try stored ref first
                  if (internalPlayerRef.current && lastSeekTimeRef.current === seekTime) {
                    console.log("🔄 Retry seek with stored internal player (attempt", retryCount, ")")
                    performSeekDirect(internalPlayerRef.current, seekTime)
                    return
                  }
                  // Try ReactPlayer ref
                  const retryPlayer = playerRef.current
                  if (retryPlayer && typeof retryPlayer.getInternalPlayer === "function" && lastSeekTimeRef.current === seekTime) {
                    try {
                      const internalPlayer = retryPlayer.getInternalPlayer()
                      if (internalPlayer) {
                        internalPlayerRef.current = internalPlayer // Store it
                        console.log("🔄 Retry seek with player (attempt", retryCount, ")")
                        performSeekDirect(internalPlayer, seekTime)
                        return
                      }
                    } catch (e) {
                      // Continue to retry
                    }
                  }
                  if (retryCount < maxRetries) {
                    setTimeout(retrySeek, 100 * retryCount) // Exponential backoff: 100ms, 200ms, 300ms, etc.
                  } else {
                    console.error("❌ Failed to get player after", maxRetries, "retries")
                    lastSeekTimeRef.current = null
                  }
                }
                setTimeout(retrySeek, 100)
              }
            } else if (request && request.playerType === "MP4" && videoRef.current) {
              console.log("Seeking MP4 player to:", data.seekTime)
              videoRef.current.currentTime = data.seekTime
              setCurrentTime(data.seekTime)
              currentTimeRef.current = data.seekTime
              // For MP4, seek is immediate, but wait a bit to ensure it's applied
              setTimeout(() => {
                if (lastSeekTimeRef.current === data.seekTime) {
                  lastSeekTimeRef.current = null
                }
              }, 500)
            }
          }
        }
      } catch (error) {
        // Only log actual errors, not missing seek requests
        if (error instanceof Error && !error.message.includes("fetch")) {
          console.error("Error checking for seek requests:", error)
        }
      }
    }
    
    // Helper function to perform the actual seek (takes internal player directly)
    const performSeekDirect = (internalPlayer: any, seekTime: number) => {
      try {
        console.log("🔍 Seek check - internalPlayer:", !!internalPlayer, "playerReady:", playerReadyRef.current)
        const hasSeekTo = typeof internalPlayer.seekTo === "function"
        console.log("🔍 Seek check - hasSeekTo:", hasSeekTo)
        if (hasSeekTo) {
          // Always try to seek, even if playerReady is false (it might work)
          console.log("▶️ Attempting to seek YouTube player to:", seekTime)
          try {
            internalPlayer.seekTo(seekTime, true)
            console.log("✅ seekTo() called successfully")
            // Also update local state immediately for visual feedback
            setCurrentTime(seekTime)
            currentTimeRef.current = seekTime
            // Don't clear the ref here - let onProgress detect when seek completes
            // Set a fallback timeout in case seek never completes
            setTimeout(() => {
              if (lastSeekTimeRef.current === seekTime) {
                console.warn("⏱️ Seek timeout - clearing seek ref after 5 seconds")
                lastSeekTimeRef.current = null
              }
            }, 5000)
          } catch (seekError) {
            console.error("❌ Error calling seekTo():", seekError)
            lastSeekTimeRef.current = null
          }
        } else {
          console.warn("❌ YouTube player seekTo function not available")
          lastSeekTimeRef.current = null
        }
      } catch (error) {
        console.error("❌ Error seeking YouTube player:", error)
        lastSeekTimeRef.current = null
      }
    }
    
    positionUpdateIntervalRef.current = setInterval(updatePosition, 1000)
    seekCheckIntervalRef.current = setInterval(checkSeek, 500)

    return () => {
      if (positionUpdateIntervalRef.current) {
        clearInterval(positionUpdateIntervalRef.current)
      }
      if (seekCheckIntervalRef.current) {
        clearInterval(seekCheckIntervalRef.current)
      }
    }
  }, [currentRequest, playerReady])

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
      
      // Set loading but keep currentRequest until we have the next video
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
      
      // Fetch next video immediately - it will update currentRequest if found
      // Only clear currentRequest if no new video is found
      setTimeout(async () => {
        try {
          const token = window.location.pathname.split("/player/")[1]
          const response = await fetch(`/api/queue/current-by-token?token=${token}`)
          
          if (response.ok) {
            const data = await response.json()
            if (data.currentRequest) {
              // New video found, update state
              setCurrentRequest(data.currentRequest)
              currentRequestRef.current = data.currentRequest
              setPlayerReady(false)
              setIsPlaying(true)
            } else {
              // No more videos, clear current request
              setCurrentRequest(null)
              currentRequestRef.current = null
              setLoading(false)
            }
          } else {
            // Error fetching, clear current request
            setCurrentRequest(null)
            currentRequestRef.current = null
            setLoading(false)
          }
        } catch (error) {
          console.error("Error fetching next video:", error)
          setCurrentRequest(null)
          currentRequestRef.current = null
          setLoading(false)
        }
      }, 300)
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
      // Set volume and muted state
      videoRef.current.volume = volume
      videoRef.current.muted = true // Start muted for autoplay
      // Try to play immediately
      videoRef.current.play().then(() => {
        console.log("MP4 video autoplay started")
        // Unmute after playback starts if volume > 0
        if (volume > 0) {
          setTimeout(() => {
            if (videoRef.current) {
              videoRef.current.muted = false
            }
          }, 100)
        }
      }).catch((error) => {
        console.error("Error autoplaying MP4 video:", error)
        // Video will be handled by onLoadedData/onCanPlay handlers
      })
    }
  }, [currentRequest, volume])

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
              {loading && !playerReady && (
                <div className="absolute inset-0 flex items-center justify-center bg-black z-10">
                  <p className="text-white">Loading player...</p>
                </div>
              )}
              <ReactPlayer
                ref={playerRef as any}
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
                  playerReadyRef.current = true
                  setLoading(false) // Clear loading when player is ready
                  setIsPlaying(true)
                  
                  // Store the internal player reference for seeking
                  if (playerRef.current) {
                    try {
                      const internalPlayer = playerRef.current.getInternalPlayer()
                      if (internalPlayer) {
                        internalPlayerRef.current = internalPlayer
                        console.log("✅ Internal player stored in ref")
                      }
                    } catch (error) {
                      console.error("Error getting internal player:", error)
                    }
                  }
                  
                  // Force play and set volume
                  setTimeout(() => {
                    if (playerRef.current) {
                      try {
                        const internalPlayer = playerRef.current.getInternalPlayer()
                        if (internalPlayer) {
                          // Update ref if not already set
                          if (!internalPlayerRef.current) {
                            internalPlayerRef.current = internalPlayer
                          }
                          
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
                onDuration={(dur) => {
                  // ReactPlayer's onDuration callback - most reliable way to get duration
                  if (dur && dur > 0 && isFinite(dur)) {
                    console.log("Duration from onDuration callback:", dur)
                    setDuration(dur)
                    durationRef.current = dur
                    
                    // Also send position update with duration immediately
                    const token = window.location.pathname.split("/player/")[1]
                    if (token) {
                      // Use a small timeout to ensure currentTime is updated
                      setTimeout(() => {
                        const positionData = {
                          token,
                          currentTime: currentTime || 0,
                          duration: dur,
                          title: titleRef.current,
                        }
                        
                        fetch("/api/player/position", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify(positionData),
                        }).catch((error) => {
                          console.error("Error sending duration update:", error)
                        })
                      }, 100)
                    }
                  }
                }}
                onProgress={(state) => {
                  // Update position and duration from ReactPlayer's progress callback
                  // This is more reliable than polling getCurrentTime()
                  if (state.playedSeconds !== undefined && state.playedSeconds >= 0) {
                    // Check if we're seeking
                    if (lastSeekTimeRef.current !== null) {
                      const seekTarget = lastSeekTimeRef.current
                      const timeDifference = Math.abs(state.playedSeconds - seekTarget)
                      if (timeDifference < 2) {
                        // Seek completed
                        console.log("Seek completed in onProgress. Target:", seekTarget, "Actual:", state.playedSeconds)
                        lastSeekTimeRef.current = null
                        setCurrentTime(state.playedSeconds)
                    } else {
                      // Still seeking - show seek target
                      setCurrentTime(seekTarget)
                      currentTimeRef.current = seekTarget
                    }
                  } else {
                    // Not seeking - update normally
                    setCurrentTime(state.playedSeconds)
                    currentTimeRef.current = state.playedSeconds
                  }
                  }
                  
                  // Try to get duration from internal player as fallback
                  let currentDuration = durationRef.current
                  let currentTitle = titleRef.current
                  
                  try {
                    const internalPlayer = playerRef.current?.getInternalPlayer()
                    if (internalPlayer) {
                      // Try to get duration
                      if (typeof internalPlayer.getDuration === "function") {
                        const playerDuration = internalPlayer.getDuration()
                        if (playerDuration > 0 && isFinite(playerDuration)) {
                          currentDuration = playerDuration
                          if (currentDuration !== durationRef.current) {
                            durationRef.current = currentDuration
                            setDuration(currentDuration)
                            console.log("Duration from internal player:", currentDuration)
                          }
                        }
                      }
                      
                      // Try to get title
                      if (typeof internalPlayer.getVideoData === "function") {
                        try {
                          const videoData = internalPlayer.getVideoData()
                          if (videoData && videoData.title) {
                            currentTitle = videoData.title
                            if (currentTitle !== titleRef.current) {
                              titleRef.current = currentTitle
                              setTitle(currentTitle)
                            }
                          }
                        } catch (e) {
                          // getVideoData might throw, ignore
                        }
                      }
                    }
                  } catch (error) {
                    // Ignore errors
                  }
                  
                  // Send position update immediately when progress updates
                  // Use refs to get latest values (avoid stale closure)
                  const token = window.location.pathname.split("/player/")[1]
                  if (token && state.playedSeconds !== undefined) {
                    // Use seek target if we're seeking, otherwise use actual position
                    const timeToSend = lastSeekTimeRef.current !== null 
                      ? lastSeekTimeRef.current 
                      : (state.playedSeconds || 0)
                    
                    const positionData = {
                      token,
                      currentTime: timeToSend,
                      duration: currentDuration || 0,
                      title: currentTitle,
                    }
                    
                    // Send position update (throttle to avoid too many requests)
                    // Only send every 0.5 seconds max
                    const now = Date.now()
                    if (now - lastPositionUpdateRef.current > 500) {
                      lastPositionUpdateRef.current = now
                      fetch("/api/player/position", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(positionData),
                      }).catch((error) => {
                        console.error("Error sending position update from onProgress:", error)
                      })
                    }
                  }
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
        muted={true} // Start muted for autoplay to work (browsers require this)
        playsInline
        className="w-full h-full object-contain"
        onEnded={handleVideoEnd}
        onPlay={() => {
          console.log("Video playing")
          setIsPlaying(true)
          // Unmute after playback starts (autoplay requires muted initially)
          if (videoRef.current && volume > 0) {
            videoRef.current.muted = false
          }
        }}
        onPause={() => {
          console.log("Video paused")
          setIsPlaying(false)
        }}
        onLoadedMetadata={() => {
          console.log("Video metadata loaded")
          if (videoRef.current && videoRef.current.duration) {
            setDuration(videoRef.current.duration)
            console.log("Duration set:", videoRef.current.duration)
          }
        }}
        onLoadedData={() => {
          console.log("Video loaded, attempting to play")
          setLoading(false) // Clear loading when video is loaded
          // Force play when video is loaded
          if (videoRef.current) {
            if (videoRef.current.duration) {
              setDuration(videoRef.current.duration)
            }
            // Set volume before playing
            videoRef.current.volume = volume
            videoRef.current.play().then(() => {
              console.log("Video autoplay started successfully")
              setIsPlaying(true)
              // Unmute if volume > 0
              const video = videoRef.current
              if (video && volume > 0) {
                video.muted = false
              }
            }).catch((error) => {
              console.error("Error autoplaying video:", error)
              // If autoplay fails, try with muted
              if (videoRef.current) {
                videoRef.current.muted = true
                videoRef.current.play().then(() => {
                  console.log("Video autoplay started with muted")
                  setIsPlaying(true)
                  // Unmute after a short delay
                  const video = videoRef.current
                  if (video) {
                    setTimeout(() => {
                      if (videoRef.current && volume > 0) {
                        videoRef.current.muted = false
                      }
                    }, 100)
                  }
                }).catch((err) => {
                  console.error("Error autoplaying even with muted:", err)
                })
              }
            })
          }
        }}
        onCanPlay={() => {
          console.log("Video can play")
          setLoading(false) // Clear loading when video can play
          // Also try to play when video can play
          if (videoRef.current && isPlaying && videoRef.current.paused) {
            if (videoRef.current.duration) {
              setDuration(videoRef.current.duration)
            }
            // Set volume before playing
            videoRef.current.volume = volume
            videoRef.current.play().then(() => {
              console.log("Video started playing on canPlay")
              // Unmute if volume > 0
              const video = videoRef.current
              if (video && volume > 0) {
                video.muted = false
              }
            }).catch((error) => {
              console.error("Error playing video on canPlay:", error)
            })
          }
        }}
        onDurationChange={() => {
          if (videoRef.current && videoRef.current.duration) {
            setDuration(videoRef.current.duration)
            console.log("Duration changed:", videoRef.current.duration)
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

