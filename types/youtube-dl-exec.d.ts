declare module "youtube-dl-exec" {
  export interface ExecOptions {
    dumpSingleJson?: boolean
    noCheckCertificates?: boolean
    noWarnings?: boolean
    preferFreeFormats?: boolean
    addHeader?: string[]
    [key: string]: any
  }

  export interface VideoFormat {
    url?: string
    fragment_base_url?: string
    ext?: string
    vcodec?: string
    acodec?: string
    height?: number
    tbr?: number
    [key: string]: any
  }

  export interface VideoInfo {
    url?: string
    formats?: VideoFormat[]
    [key: string]: any
  }

  export function exec(
    url: string,
    options?: ExecOptions
  ): Promise<VideoInfo> | any
}

