import AbstractService from './AbstractService'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import sharp, { Sharp } from 'sharp'
import UnsupportedImageFormatException from '../exceptions/UnsupportedImageFormatException'
import { EntityNotFoundException } from '../exceptions/EntityNotFoundException'

interface ResizeResponse {
  buffer: ArrayBuffer
  format: string
}

export default class ImageResizeService extends AbstractService {
  private static CACHE_DIR = path.join(process.cwd(), 'images')
  private static ADJUST_QUALITY_ABOVE = 800
  private static FORMATS_WITH_QUALITY = ['jpeg', 'png', 'webp', 'avif']
  private static OUTPUT_QUALITY = 94

  constructor () {
    super()
    fs.mkdirSync(path.dirname(ImageResizeService.CACHE_DIR), { recursive: true })
  }

  async resizeFromUrl (url: string, w: number, h: number | undefined): Promise<ResizeResponse> {
    const buffer = await this.fetchImageBuffer(url, true)
    let image = sharp(buffer)
    const meta = await image.metadata()

    if (!this.isSupportedImageFormat(meta)) {
      throw new UnsupportedImageFormatException('Only HEIF/AVIF images up to 8-bit are supported')
    }

    image = this.resize(image, w, h)
    if (w > ImageResizeService.ADJUST_QUALITY_ABOVE && ImageResizeService.FORMATS_WITH_QUALITY.includes(meta.format)) {
      image = image.toFormat(meta.format, { quality: ImageResizeService.OUTPUT_QUALITY })
    }
    const imageBuffer = await image.toBuffer()
    const format = meta.format === 'heif' ? 'avif' : meta.format

    return { buffer: imageBuffer, format }
  }

  private isSupportedImageFormat (meta: sharp.Metadata) {
    if (meta.format === 'heif') {
      if (!meta.bitsPerSample || meta.bitsPerSample > 8) {
        return false
      }
    }
    return true
  }

  private resize (image: Sharp, w: number, h: number | undefined): Sharp {
    if (!h) {
      return image.resize(w)
    }
    return image.resize(w, h, { fit: 'fill' })
  }

  private getCachePath (url: string): string {
    const hash = crypto.createHash('sha256').update(url).digest('hex')
    const ext = path.extname(new URL(url).pathname) || '.img'
    return path.join(ImageResizeService.CACHE_DIR, `${hash}${ext}`)
  }

  private async fetchImageBuffer (url: string, useDisk: boolean): Promise<ArrayBuffer> {
    const cachePath = this.getCachePath(url)
    if (useDisk) {
      if (fs.existsSync(cachePath)) {
        return fs.promises.readFile(cachePath)
      }
    }

    const res = await fetch(url)
    if (!res.ok) {
      throw new EntityNotFoundException(`Failed to fetch image: ${res.status} ${res.statusText}`)
    }
    const arrayBuffer = await res.arrayBuffer()

    fs.writeFileSync(cachePath, Buffer.from(arrayBuffer))

    return arrayBuffer
  }
}
