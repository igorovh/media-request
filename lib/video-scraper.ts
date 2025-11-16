// URL validation functions for whitelisted services
export function isValidYouTubeUrl(url: string): boolean {
  try {
    const urlObj = new URL(url)
    const hostname = urlObj.hostname.toLowerCase().replace('www.', '')
    return (hostname === 'youtube.com' && (url.includes('/watch') || url.includes('/shorts'))) || hostname === 'youtu.be'
  } catch {
    return false
  }
}

export function isValidStreamableUrl(url: string): boolean {
  try {
    const urlObj = new URL(url)
    const hostname = urlObj.hostname.toLowerCase().replace('www.', '')
    return hostname === 'streamable.com'
  } catch {
    return false
  }
}

export function isValidTwitchUrl(url: string): boolean {
  try {
    const urlObj = new URL(url)
    const hostname = urlObj.hostname.toLowerCase().replace('www.', '')
    return hostname === 'clips.twitch.tv' || (hostname === 'twitch.tv' && url.includes('/clip/'))
  } catch {
    return false
  }
}

export function isValidTwitterUrl(url: string): boolean {
  try {
    const urlObj = new URL(url)
    const hostname = urlObj.hostname.toLowerCase().replace('www.', '')
    return (hostname === 'twitter.com' || hostname === 'x.com') && url.includes('/status/')
  } catch {
    return false
  }
}

export function isValidNuulsUrl(url: string): boolean {
  try {
    const urlObj = new URL(url)
    const hostname = urlObj.hostname.toLowerCase().replace('www.', '')
    return hostname === 'i.nuuls.com'
  } catch {
    return false
  }
}

export function isValidInstagramReelsUrl(url: string): boolean {
  try {
    const urlObj = new URL(url)
    const hostname = urlObj.hostname.toLowerCase().replace('www.', '')
    return hostname === 'instagram.com' && (url.includes('/reels/') || url.includes('/reel/'))
  } catch {
    return false
  }
}

export function isValidTikTokUrl(url: string): boolean {
  try {
    const urlObj = new URL(url)
    const hostname = urlObj.hostname.toLowerCase().replace('www.', '')
    return hostname === 'tiktok.com' && (url.includes('/video/') || url.includes('/photo/'))
  } catch {
    return false
  }
}

// Main validation function
export function isValidVideoUrl(url: string): boolean {
  return (
    isValidYouTubeUrl(url) ||
    isValidStreamableUrl(url) ||
    isValidTwitchUrl(url) ||
    isValidTwitterUrl(url) ||
    isValidNuulsUrl(url) ||
    isValidInstagramReelsUrl(url) ||
    isValidTikTokUrl(url)
  )
}

// Determine player type based on URL
export function getPlayerType(url: string): "YOUTUBE" | "MP4" {
  if (isValidYouTubeUrl(url)) {
    return "YOUTUBE"
  }
  return "MP4"
}

// Service-specific scrapers to extract raw MP4 URLs
export async function scrapeYouTube(url: string): Promise<string | null> {
  // YouTube URLs are used directly with ReactPlayer
  // No need to extract MP4 - ReactPlayer handles it
  return url
}

export async function scrapeStreamable(url: string): Promise<string | null> {
  try {
    // Streamable API endpoint
    const videoId = url.split('/').pop()?.split('?')[0]
    if (!videoId) return null

    const apiUrl = `https://api.streamable.com/videos/${videoId}`
    const response = await fetch(apiUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    })

    if (!response.ok) return null

    const data = await response.json()
    
    // Try to get the best quality MP4
    if (data.files && data.files.mp4) {
      return data.files.mp4.url || data.files.mp4
    }
    
    // Fallback to any available MP4
    if (data.files) {
      const mp4File = Object.values(data.files).find((file: any) => 
        file && (typeof file === 'string' || file.url)
      ) as any
      if (mp4File) {
        return typeof mp4File === 'string' ? mp4File : mp4File.url
      }
    }

    return null
  } catch (error) {
    console.error("Error scraping Streamable:", error)
    return null
  }
}

export async function scrapeTwitch(url: string): Promise<string | null> {
  try {
    // Extract clip slug from URL
    let clipSlug = ''
    if (url.includes('clips.twitch.tv/')) {
      clipSlug = url.split('clips.twitch.tv/')[1]?.split('?')[0] || ''
    } else if (url.includes('/clip/')) {
      clipSlug = url.split('/clip/')[1]?.split('?')[0] || ''
    }
    
    if (!clipSlug) return null

    // Use Twitch API to get clip info
    const apiUrl = `https://api.twitch.tv/helix/clips?id=${clipSlug}`
    const clientId = process.env.TWITCH_CLIENT_ID
    
    if (!clientId) {
      console.error("TWITCH_CLIENT_ID not set")
      return null
    }

    const response = await fetch(apiUrl, {
      headers: {
        'Client-ID': clientId,
        'Accept': 'application/vnd.twitchtv.v5+json',
      },
    })

    if (!response.ok) return null

    const data = await response.json()
    
    if (data.data && data.data[0] && data.data[0].thumbnail_url) {
      // Extract video URL from thumbnail URL pattern
      // Twitch clip thumbnails follow pattern: https://clips-media-assets2.twitch.tv/{clip_id}-preview-{width}x{height}.jpg
      // Video URL pattern: https://clips-media-assets2.twitch.tv/{clip_id}.mp4
      const thumbnailUrl = data.data[0].thumbnail_url
      const clipId = thumbnailUrl.match(/\/([^\/]+)-preview/)?.[1]
      
      if (clipId) {
        return `https://clips-media-assets2.twitch.tv/${clipId}.mp4`
      }
      
      // Alternative: try to get from video URL field if available
      if (data.data[0].video_url) {
        return data.data[0].video_url
      }
    }

    return null
  } catch (error) {
    console.error("Error scraping Twitch:", error)
    return null
  }
}

export async function scrapeTwitter(url: string): Promise<string | null> {
  try {
    // Extract tweet ID from URL
    const tweetIdMatch = url.match(/\/(?:status|statuses)\/(\d+)/)
    if (!tweetIdMatch) return null

    const tweetId = tweetIdMatch[1]
    
    // Use a public API service to get video URL
    // Note: Twitter/X doesn't have a public API for this, so we'll use a third-party service
    // You may need to use a service like nitter or similar
    // For now, we'll try to use Twitter's embed API
    
    // Alternative: Use a scraping service or API
    // This is a placeholder - you may need to implement actual scraping
    // or use a service like RapidAPI's Twitter scraper
    
    console.warn("Twitter scraping not fully implemented - may need third-party service")
    return null
  } catch (error) {
    console.error("Error scraping Twitter:", error)
    return null
  }
}

export async function scrapeNuuls(url: string): Promise<string | null> {
  try {
    // Nuuls URLs are typically direct image/video links
    // Check if it's already a direct link
    if (url.match(/\.(mp4|webm|mov)$/i)) {
      return url
    }
    
    // Try to fetch and check content type
    const response = await fetch(url, {
      method: 'HEAD',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    })
    
    const contentType = response.headers.get('content-type')
    if (contentType && contentType.startsWith('video/')) {
      return url
    }
    
    return null
  } catch (error) {
    console.error("Error scraping Nuuls:", error)
    return null
  }
}

export async function scrapeInstagramReels(url: string): Promise<string | null> {
  try {
    // Extract reel ID from URL
    const reelIdMatch = url.match(/\/(?:reels?|p)\/([^\/\?]+)/)
    if (!reelIdMatch) return null

    // Instagram requires authentication and has strict rate limiting
    // You'll likely need to use a third-party service or implement proper Instagram API access
    // For now, this is a placeholder
    
    console.warn("Instagram Reels scraping not fully implemented - may need third-party service")
    return null
  } catch (error) {
    console.error("Error scraping Instagram Reels:", error)
    return null
  }
}

export async function scrapeTikTok(url: string): Promise<string | null> {
  try {
    // Extract video ID from URL
    const videoIdMatch = url.match(/\/(?:video|photo)\/(\d+)/)
    if (!videoIdMatch) return null

    // TikTok has strict anti-scraping measures
    // You'll likely need to use a third-party API service
    // For now, this is a placeholder
    
    console.warn("TikTok scraping not fully implemented - may need third-party service")
    return null
  } catch (error) {
    console.error("Error scraping TikTok:", error)
    return null
  }
}

// Main function to extract raw MP4 URL from any supported service
export async function getDirectVideoUrl(url: string): Promise<string | null> {
  if (!isValidVideoUrl(url)) {
    return null
  }

  if (isValidYouTubeUrl(url)) {
    return await scrapeYouTube(url)
  } else if (isValidStreamableUrl(url)) {
    return await scrapeStreamable(url)
  } else if (isValidTwitchUrl(url)) {
    return await scrapeTwitch(url)
  } else if (isValidTwitterUrl(url)) {
    return await scrapeTwitter(url)
  } else if (isValidNuulsUrl(url)) {
    return await scrapeNuuls(url)
  } else if (isValidInstagramReelsUrl(url)) {
    return await scrapeInstagramReels(url)
  } else if (isValidTikTokUrl(url)) {
    return await scrapeTikTok(url)
  }

  return null
}

// Legacy function for backward compatibility
export function isYouTubeUrl(url: string): boolean {
  return isValidYouTubeUrl(url)
}
