declare module "tmi.js" {
  export interface ClientOptions {
    options?: {
      debug?: boolean
    }
    connection?: {
      secure?: boolean
      reconnect?: boolean
      maxReconnectAttempts?: number
      maxReconnectInterval?: number
      reconnectInterval?: number
    }
    identity?: {
      username?: string
      password?: string
    }
    channels?: string[]
  }

  export interface ChatUserstate {
    "badge-info"?: string
    badges?: Record<string, string>
    color?: string
    "display-name"?: string
    emotes?: Record<string, string[]>
    "first-msg"?: boolean
    flags?: string
    id?: string
    mod?: boolean
    "returning-chatter"?: boolean
    "room-id"?: string
    subscriber?: boolean
    "tmi-sent-ts"?: string
    turbo?: boolean
    "user-id"?: string
    "user-type"?: string
    username?: string
    "message-type"?: "chat" | "action" | "whisper"
  }

  export interface ChatMessage {
    channel: string
    userstate: ChatUserstate
    message: string
    self: boolean
  }

  export class Client {
    constructor(options?: ClientOptions)
    connect(): Promise<[string, number]>
    disconnect(): Promise<[string, number]>
    on(event: "connected", listener: (addr: string, port: number) => void): this
    on(event: "disconnected", listener: (reason: string) => void): this
    on(event: "message", listener: (channel: string, userstate: ChatUserstate, message: string, self: boolean) => void): this
    on(event: string, listener: (...args: any[]) => void): this
    say(channel: string, message: string): Promise<[string]>
    join(channel: string): Promise<[string]>
    part(channel: string): Promise<[string]>
    readyState(): "OPEN" | "CONNECTING" | "CLOSING" | "CLOSED"
  }

  const tmi: {
    Client: typeof Client
  }
  export default tmi
  export { Client }
}

