import axios from 'axios'

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
    // Support tiktok.com, vm.tiktok.com, and vt.tiktok.com
    // Ignore slide photos (URLs containing /photo/)
    const isTikTokDomain = hostname === 'tiktok.com' || hostname === 'vm.tiktok.com' || hostname === 'vt.tiktok.com'
    return isTikTokDomain && !url.includes('/photo/')
  } catch {
    return false
  }
}

// Get the real TikTok URL by following redirects for short URLs (vm.tiktok.com, vt.tiktok.com)
async function getRedirectURL(url: string): Promise<string> {
  try {
    const URLObject = new URL(url)
    const hostname = URLObject.hostname.toLowerCase()

    if (hostname === 'vm.tiktok.com' || hostname === 'vt.tiktok.com') {
      const response = await axios.get(url, {
        maxRedirects: 5,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Referer': 'https://www.tiktok.com/',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Sec-Fetch-User': '?1',
          'Upgrade-Insecure-Requests': '1',
        },
      })
      // response.request.res.responseUrl contains the final URL after redirects
      const finalUrl = response.request.res?.responseUrl || response.config.url || url
      console.info('Redirect result:', {
        responseUrl: response.request.res?.responseUrl,
        configUrl: response.config.url,
        originalUrl: url,
        finalUrl: finalUrl
      })
      return finalUrl
    } else {
      return url
    }
  } catch (error) {
    console.warn("Couldn't get TikTok redirect URL:", error)
    return url // Return original URL if redirect fails
  }
}

// Async validation for TikTok URLs - follows redirects and validates we get a proper video URL
export async function validateTikTokUrl(url: string): Promise<boolean> {
  try {
    if (!isValidTikTokUrl(url)) {
      return false
    }

    // Follow redirects to get the real URL
    const realUrl = await getRedirectURL(url)
    
    // Check if TikTok redirected to explore page or other invalid pages
    if (realUrl.includes('/explore') || realUrl.includes('tiktok.com/@') && !realUrl.includes('/video/')) {
      console.warn("TikTok URL redirected to explore page or invalid page:", realUrl)
      return false
    }
    
    // Check if the final URL contains a video ID (format: /video/1234567890)
    const videoIdMatch = realUrl.match(/\/video\/(\d+)/)
    if (!videoIdMatch) {
      console.warn("TikTok URL does not resolve to a valid video URL:", realUrl)
      return false
    }

    return true
  } catch (error) {
    console.warn("Error validating TikTok URL:", error)
    return false
  }
}

// Main validation function - only supports YouTube, TikTok, and Streamable
export function isValidVideoUrl(url: string): boolean {
  return (
    isValidYouTubeUrl(url) ||
    isValidStreamableUrl(url) ||
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
    
    if (!clipSlug) {
      console.error("Could not extract Twitch clip slug from URL:", url)
      return null
    }

    // Use Twitch GraphQL API to get clip info
    const graphqlQuery = JSON.stringify([{
      operationName: "VideoAccessToken_Clip",
      variables: {
        platform: "web",
        slug: clipSlug
      },
      extensions: {
        persistedQuery: {
          version: 1,
          sha256Hash: "993d9a5131f15a37bd16f32342c44ed1e0b1a9b968c6afdb662d2cddd595f6c5"
        }
      }
    }])

    const response = await axios.post('https://gql.twitch.tv/gql', graphqlQuery, {
      headers: {
        'accept': '*/*',
        'accept-language': 'en-US',
        'cache-control': 'no-cache',
        'client-id': 'kimne78kx3ncx6brgo4mv6wki5h1ko',
        'content-type': 'text/plain;charset=UTF-8',
        'origin': 'https://www.twitch.tv',
        'pragma': 'no-cache',
        'priority': 'u=1, i',
        'referer': 'https://www.twitch.tv/',
      },
      maxBodyLength: Infinity,
    })

    if (!response.data || !Array.isArray(response.data) || !response.data[0]) {
      console.error("Invalid Twitch GraphQL response structure")
      return null
    }

    const clipData = response.data[0]?.data?.clip
    if (!clipData) {
      console.error("No clip data in Twitch GraphQL response")
      return null
    }

    // Get video qualities from the response
    const videoQualities = clipData.videoQualities || clipData.assets?.[0]?.videoQualities || []
    
    if (videoQualities.length === 0) {
      console.error("No video qualities found in Twitch clip response")
      return null
    }

    // Sort by quality (prefer higher quality) and return the best available
    // Quality order: 1080 > 720 > 480 > 360
    const qualityOrder = { '1080': 4, '720': 3, '480': 2, '360': 1 }
    const sortedQualities = videoQualities.sort((a: any, b: any) => {
      const aOrder = qualityOrder[a.quality as keyof typeof qualityOrder] || 0
      const bOrder = qualityOrder[b.quality as keyof typeof qualityOrder] || 0
      return bOrder - aOrder
    })

    const bestQuality = sortedQualities[0]
    if (bestQuality?.sourceURL) {
      console.log(`Twitch clip: Using quality ${bestQuality.quality} (${bestQuality.frameRate} fps)`)
      return bestQuality.sourceURL
    }

    console.error("No sourceURL found in Twitch clip video qualities")
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
    // First, resolve redirects for short URLs (vm.tiktok.com, vt.tiktok.com)
    const realUrl = await getRedirectURL(url)
    
    // Extract video ID from URL
    const videoIdMatch = realUrl.match(/\/video\/(\d+)/)
    if (!videoIdMatch) {
      console.error("Could not extract TikTok video ID from URL:", realUrl)
      return null
    }

    const videoId = videoIdMatch[1]
    const apiUrl = `https://api.twitterpicker.com/tiktok/mediav2?id=${videoId}`

    const response = await fetch(apiUrl, {
      headers: {
        "User-Agent": "PostmanRuntime/7.49.1",
        "Accept": "*/*",
        "Postman-Token": "98c1389c-aa0c-4e8c-a1b2-7e335ee724c7",
        "Accept-Encoding": "gzip, deflate, br",
        "Connection": "keep-alive",
      },
    })

    if (!response.ok) {
      console.error(`TikTok API error: ${response.status} ${response.statusText}`)
      return null
    }

    const data = await response.json()

    // Check if response has video_no_watermark URL
    if (data.video_no_watermark && data.video_no_watermark.url) {
      return data.video_no_watermark.url
    }

    // Fallback to video_watermark if no_watermark is not available
    if (data.video_watermark && data.video_watermark.url) {
      console.warn("Using watermarked TikTok video (no watermark version not available)")
      return data.video_watermark.url
    }

    console.error("TikTok API response does not contain video URL:", data)
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
  } else if (isValidTikTokUrl(url)) {
    return await scrapeTikTok(url)
  }

  return null
}

// Legacy function for backward compatibility
export function isYouTubeUrl(url: string): boolean {
  return isValidYouTubeUrl(url)
}
