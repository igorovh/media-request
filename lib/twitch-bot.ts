import tmi from "tmi.js"

export interface BotMessage {
  username: string
  message: string
  tags: any
}

export interface BotCommand {
  username: string
  command: "pause" | "play"
  tags: any
}

export class TwitchBot {
  private client: tmi.Client | null = null
  private channel: string = ""
  private broadcasterUsername: string = ""
  private onMessageCallback?: (message: BotMessage) => void
  private onCommandCallback?: (command: BotCommand) => void
  private onConnectedCallback?: () => void
  private onDisconnectedCallback?: () => void

  async connect(channel: string): Promise<void> {
    this.channel = channel.toLowerCase().replace("#", "")
    this.broadcasterUsername = this.channel

    // Connect anonymously (no OAuth required)
    this.client = new tmi.Client({
      options: { debug: false },
      // No identity - connects as anonymous user
      channels: [this.channel],
    })

    // Set up event handlers
    this.client.on("message", (channel: string, tags: any, message: string, self: boolean) => {
      if (self) return // Ignore messages from the bot itself

      const username = tags.username || "unknown"
      
      // Check for !mr command (add video to queue)
      const mrMatch = message.match(/^!mr\s+(.+)$/i)
      if (mrMatch) {
        const url = mrMatch[1].trim()
        
        if (this.onMessageCallback) {
          this.onMessageCallback({
            username,
            message: url,
            tags,
          })
        }
        return
      }

      // Check for !mrpause command
      if (message.match(/^!mrpause$/i)) {
        if (this.isModeratorOrBroadcaster(tags, username)) {
          if (this.onCommandCallback) {
            this.onCommandCallback({
              username,
              command: "pause",
              tags,
            })
          }
        }
        return
      }

      // Check for !mrplay command
      if (message.match(/^!mrplay$/i)) {
        if (this.isModeratorOrBroadcaster(tags, username)) {
          if (this.onCommandCallback) {
            this.onCommandCallback({
              username,
              command: "play",
              tags,
            })
          }
        }
        return
      }
    })

    this.client.on("connected", () => {
      console.log(`Connected to Twitch channel: ${this.channel}`)
      if (this.onConnectedCallback) {
        this.onConnectedCallback()
      }
    })

    this.client.on("disconnected", () => {
      console.log(`Disconnected from Twitch channel: ${this.channel}`)
      if (this.onDisconnectedCallback) {
        this.onDisconnectedCallback()
      }
    })

    try {
      await this.client.connect()
    } catch (error) {
      console.error("Failed to connect to Twitch:", error)
      throw error
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.disconnect()
      this.client = null
    }
  }

  // Removed sendMessage - bot doesn't need to send messages

  private isModeratorOrBroadcaster(tags: any, username: string): boolean {
    // Check if user is a moderator
    if (tags.mod === true || tags.mod === "1") {
      return true
    }

    // Check if user is the broadcaster
    if (tags.badges && tags.badges.broadcaster === "1") {
      return true
    }

    // Check if username matches broadcaster (case-insensitive)
    if (username.toLowerCase() === this.broadcasterUsername.toLowerCase()) {
      return true
    }

    return false
  }

  onMessage(callback: (message: BotMessage) => void): void {
    this.onMessageCallback = callback
  }

  onCommand(callback: (command: BotCommand) => void): void {
    this.onCommandCallback = callback
  }

  onConnected(callback: () => void): void {
    this.onConnectedCallback = callback
  }

  onDisconnected(callback: () => void): void {
    this.onDisconnectedCallback = callback
  }

  isConnected(): boolean {
    return this.client !== null && this.client.readyState() === "OPEN"
  }
}

// Singleton instance
let botInstance: TwitchBot | null = null

export function getBotInstance(): TwitchBot {
  if (!botInstance) {
    botInstance = new TwitchBot()
  }
  return botInstance
}

