import AbstractService from './AbstractService'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import sharp, { Sharp, FormatEnum } from 'sharp'
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

  async resizeFromUrl (url: string, w: number, h?: number): Promise<ResizeResponse> {
    const origPath = this.getOriginalCachePath(url)
    if (!fs.existsSync(path.dirname(origPath))) fs.mkdirSync(path.dirname(origPath), { recursive: true })
    const origBuf = await this.fetchImageBuffer(url, true)
    const meta = await sharp(origBuf).metadata()
    if (meta.format === 'heif' && (meta.bitsPerSample ?? 0) > 8) {
      throw new UnsupportedImageFormatException('Only HEIF/AVIF images up to 8-bit are supported')
    }
    let hh = h
    if (!hh) {
      hh = Math.round((meta.height! / meta.width!) * w)
    }
    const ext = path.extname(new URL(url).pathname).toLowerCase() || '.img'
    const hash = this.getUrlHash(url)
    const cached = this.findCachedResize(hash, ext, w, hh)
    if (cached) {
      const buf = await fs.promises.readFile(cached)
      return { buffer: buf, format: ext.slice(1) }
    }
    let pipeline: Sharp = sharp(origBuf).resize(w, hh, { fit: 'fill' })
    const inputFmt = meta.format === 'heif' ? 'avif' : meta.format!
    if (w > ImageResizeService.ADJUST_QUALITY_ABOVE && ImageResizeService.FORMATS_WITH_QUALITY.includes(inputFmt)) {
      pipeline = pipeline.toFormat(inputFmt as keyof FormatEnum, { quality: ImageResizeService.OUTPUT_QUALITY })
    }
    const outBuf = await pipeline.toBuffer()
    const resPath = this.getResizedCachePath(hash, ext, w, hh)
    if (!fs.existsSync(path.dirname(resPath))) fs.mkdirSync(path.dirname(resPath), { recursive: true })
    await fs.promises.writeFile(resPath, outBuf)
    return { buffer: outBuf, format: inputFmt }
  }

  private getUrlHash (url: string) {
    return crypto.createHash('sha256').update(url).digest('hex')
  }

  private getSubdir (hash: string) {
    return path.join(ImageResizeService.CACHE_DIR, ...hash.slice(0, 8).split(''))
  }

  private getOriginalCachePath (url: string) {
    const hash = this.getUrlHash(url)
    const ext = path.extname(new URL(url).pathname).toLowerCase() || '.img'
    return path.join(this.getSubdir(hash), `${hash}${ext}`)
  }

  private getResizedCachePath (hash: string, ext: string, w: number, h: number) {
    return path.join(this.getSubdir(hash), `${hash}_${w}x${h}${ext}`)
  }

  private findCachedResize (hash: string, ext: string, w: number, h: number): string | null {
    const dir = this.getSubdir(hash)
    if (!fs.existsSync(dir)) return null
    let best: { path: string; w: number; h: number } | null = null
    for (const name of fs.readdirSync(dir)) {
      if (!name.startsWith(hash + '_') || !name.endsWith(ext)) continue
      const [fw, fh] = name.slice((hash + '_').length, name.length - ext.length).split('x').map(n => parseInt(n, 10))
      if (isNaN(fw) || isNaN(fh) || fw < w || fh < h) continue
      if (!best || fw < best.w || (fw === best.w && fh < best.h)) {
        best = { path: path.join(dir, name), w: fw, h: fh }
      }
    }
    return best ? best.path : null
  }

  private async fetchImageBuffer (url: string, useDisk: boolean): Promise<Buffer> {
    const origPath = this.getOriginalCachePath(url)
    if (useDisk && fs.existsSync(origPath)) {
      return fs.promises.readFile(origPath)
    }
    const res = await fetch(url)
    if (!res.ok) {
      throw new EntityNotFoundException(`Failed to fetch image: ${res.status} ${res.statusText}`)
    }
    const buf = Buffer.from(await res.arrayBuffer())
    if (!fs.existsSync(path.dirname(origPath))) fs.mkdirSync(path.dirname(origPath), { recursive: true })
    await fs.promises.writeFile(origPath, buf)
    return buf
  }
}
