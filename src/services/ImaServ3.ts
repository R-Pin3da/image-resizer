import AbstractService from './AbstractService'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import sharp, { Sharp, Metadata, FormatEnum } from 'sharp'
import UnsupportedImageFormatException from '../exceptions/UnsupportedImageFormatException'
import { EntityNotFoundException } from '../exceptions/EntityNotFoundException'

interface ResizeResponse {
  buffer: Buffer
  format: string
}

export default class ImageResizeService extends AbstractService {
  private static CACHE_DIR = path.join(process.cwd(), 'images')
  private static ADJUST_QUALITY_ABOVE = 800
  private static FORMATS_WITH_QUALITY = ['jpeg', 'png', 'webp', 'avif']
  private static OUTPUT_QUALITY = 94

  constructor () {
    super()
    fs.mkdirSync(ImageResizeService.CACHE_DIR, { recursive: true })
  }

  async resizeFromUrl (url: string, width: number, height?: number): Promise<ResizeResponse> {
    const originalBuffer = await this.fetchImageBuffer(url)
    const meta = await sharp(originalBuffer).metadata()
    if (!this.isSupportedImageFormat(meta)) {
      throw new UnsupportedImageFormatException('Only HEIF/AVIF images up to 8-bit are supported')
    }
    const finalHeight = height ?? this.calculateProportionalHeight(meta, width)
    const extension = this.getExtension(url, meta.format)
    const hash = this.getUrlHash(url)
    const cacheDir = this.getSubdirectory(hash)
    const cachedPath = this.findBestMatch(hash, extension, width, finalHeight)
    if (cachedPath) {
      const buf = await fs.promises.readFile(cachedPath)
      return { buffer: buf, format: extension.slice(1) }
    }
    const pipeline = this.buildPipeline(originalBuffer, width, finalHeight, meta)
    const outBuf = await pipeline.toBuffer()
    const targetPath = path.join(cacheDir, `${hash}_${width}x${finalHeight}${extension}`)
    await fs.promises.writeFile(targetPath, outBuf)
    return { buffer: outBuf, format: meta.format === 'heif' ? 'avif' : meta.format! }
  }

  private isSupportedImageFormat (meta: Metadata): boolean {
    return !(meta.format === 'heif' && (meta.bitsPerSample ?? 0) > 8)
  }

  private calculateProportionalHeight (meta: Metadata, width: number): number {
    return Math.round((meta.height! / meta.width!) * width)
  }

  private getExtension (url: string, format?: string): string {
    const ext = path.extname(new URL(url).pathname).toLowerCase()
    if (ext) return ext
    return '.' + (format === 'heif' ? 'avif' : format ?? 'jpeg')
  }

  private getUrlHash (url: string): string {
    return crypto.createHash('sha256').update(url).digest('hex')
  }

  private getSubdirectory (hash: string): string {
    const parts = hash.slice(0, 8).split('')
    const dir = path.join(ImageResizeService.CACHE_DIR, ...parts)
    fs.mkdirSync(dir, { recursive: true })
    return dir
  }

  private findBestMatch (hash: string, ext: string, width: number, height: number): string | null {
    const dir = this.getSubdirectory(hash)
    let best: { path: string; w: number; h: number } | null = null
    for (const name of fs.readdirSync(dir)) {
      if (!name.startsWith(hash + '_') || !name.endsWith(ext)) continue
      const [fw, fh] = name.slice(hash.length + 1, name.length - ext.length).split('x').map(n => parseInt(n, 10))
      if (isNaN(fw) || isNaN(fh) || fw < width || fh < height) continue
      if (!best || fw < best.w || (fw === best.w && fh < best.h)) {
        best = { path: path.join(dir, name), w: fw, h: fh }
      }
    }
    return best ? best.path : null
  }

  private buildPipeline (buffer: Buffer, width: number, height: number, meta: Metadata): Sharp {
    let pipeline: Sharp = sharp(buffer).resize(width, height, { fit: 'fill' })
    const fmt = meta.format === 'heif' ? 'avif' : meta.format!
    if (width > ImageResizeService.ADJUST_QUALITY_ABOVE && ImageResizeService.FORMATS_WITH_QUALITY.includes(fmt)) {
      pipeline = pipeline.toFormat(fmt as keyof FormatEnum, { quality: ImageResizeService.OUTPUT_QUALITY })
    }
    return pipeline
  }

  private async fetchImageBuffer (url: string): Promise<Buffer> {
    const hash = this.getUrlHash(url)
    const extension = this.getExtension(url)
    const cacheDir = this.getSubdirectory(hash)
    const cachePath = path.join(cacheDir, `${hash}${extension}`)
    if (fs.existsSync(cachePath)) {
      return fs.promises.readFile(cachePath)
    }
    const res = await fetch(url)
    if (!res.ok) {
      throw new EntityNotFoundException(`Failed to fetch image: ${res.status} ${res.statusText}`)
    }
    const buf = Buffer.from(await res.arrayBuffer())
    await fs.promises.writeFile(cachePath, buf)
    return buf
  }
}
