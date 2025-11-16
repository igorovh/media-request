import { exec as execChild } from "child_process"
import { promisify } from "util"

const execAsync = promisify(execChild)

function getYtDlpCommand(): string {
  // Get yt-dlp path from environment variable
  const ytDlpPath = process.env.YOUTUBE_DL_EXEC?.trim().replace(/^["']|["']$/g, '')
  
  if (ytDlpPath) {
    return ytDlpPath
  }
  
  // Fallback to system yt-dlp if in PATH
  return "yt-dlp"
}

export async function getDirectVideoUrl(url: string): Promise<string | null> {
  try {
    // Check if it's a YouTube URL - return as-is
    if (url.includes("youtube.com") || url.includes("youtu.be")) {
      return url
    }

    const ytDlpCommand = getYtDlpCommand()
    console.log('Using yt-dlp command:', ytDlpCommand)

    // Build yt-dlp command arguments
    const args = [
      url,
      "--dump-single-json",
      "--no-check-certificates",
      "--no-warnings",
      "--prefer-free-formats",
      "--add-header", "referer:youtube.com",
      "--add-header", "user-agent:googlebot",
    ]

    // Execute yt-dlp directly using execFile for better Windows support
    // Use execAsync with proper argument handling
    const command = process.platform === "win32" ? ytDlpCommand : ytDlpCommand
    const fullCommand = process.platform === "win32" 
      ? `"${command}" ${args.map(arg => `"${arg.replace(/"/g, '\\"')}"`).join(" ")}`
      : `${command} ${args.map(arg => `"${arg.replace(/"/g, '\\"')}"`).join(" ")}`

    const execOptions: any = { 
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
    }
    
    if (process.platform === "win32") {
      execOptions.shell = true
    }
    
    const { stdout, stderr } = await execAsync(fullCommand, execOptions)

    const stderrStr = stderr ? (typeof stderr === 'string' ? stderr : stderr.toString()) : ''
    
    // Parse JSON output (ensure stdout is a string)
    const stdoutStr = typeof stdout === 'string' ? stdout : stdout.toString()
    
    // Check if stdout is null or empty (yt-dlp failed)
    if (!stdoutStr || stdoutStr.trim() === 'null' || stdoutStr.trim() === '') {
      if (stderrStr) {
        console.error("yt-dlp error:", stderrStr)
      }
      return null
    }

    // Check for errors in stderr (but allow warnings)
    if (stderrStr && stderrStr.includes("ERROR")) {
      console.error("yt-dlp error:", stderrStr)
      return null
    }
    
    if (stderrStr && !stderrStr.includes("WARNING") && !stderrStr.includes("ERROR")) {
      console.warn("yt-dlp stderr:", stderrStr)
    }

    let info: any
    try {
      info = JSON.parse(stdoutStr)
    } catch (parseError) {
      console.error("Failed to parse yt-dlp JSON output:", parseError)
      console.error("Output was:", stdoutStr)
      return null
    }

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

