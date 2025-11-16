import { exec } from "youtube-dl-exec"

export async function getDirectVideoUrl(url: string): Promise<string | null> {
  try {
    // Check if it's a YouTube URL - return as-is
    if (url.includes("youtube.com") || url.includes("youtu.be")) {
      return url
    }

    // For other platforms, try to extract direct MP4 URL
    const info = await exec(url, {
      dumpSingleJson: true,
      noCheckCertificates: true,
      noWarnings: true,
      preferFreeFormats: true,
      addHeader: ["referer:youtube.com", "user-agent:googlebot"],
    })

    // Try to find the best video format (prefer mp4)
    if (info.formats && Array.isArray(info.formats)) {
      // Filter for video-only or video+audio formats
      const videoFormats = info.formats.filter(
        (format: any) =>
          format.vcodec !== "none" &&
          (format.ext === "mp4" || format.acodec === "none")
      )

      // Sort by quality/bitrate
      videoFormats.sort((a: any, b: any) => {
        const aQuality = a.height || a.tbr || 0
        const bQuality = b.height || b.tbr || 0
        return bQuality - aQuality
      })

      if (videoFormats.length > 0) {
        return videoFormats[0].url || videoFormats[0].fragment_base_url
      }
    }

    // Fallback to direct URL if available
    if (info.url) {
      return info.url
    }

    // If no direct URL found, return null
    return null
  } catch (error) {
    console.error("Video scraping error:", error)
    return null
  }
}

export function isYouTubeUrl(url: string): boolean {
  return url.includes("youtube.com") || url.includes("youtu.be")
}

