import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import sharp, { FormatEnum } from 'sharp'
import UnsupportedImageFormatException from '../exceptions/UnsupportedImageFormatException'
import { EntityNotFoundException } from '../exceptions/EntityNotFoundException'
import AbstractService from './AbstractService'
import InvalidArgumentException from '../exceptions/InvalidArgumentException'

interface ResizeResponse {
  buffer: ArrayBuffer
  format: string
}

export enum ConversionFormat {
  JPG = 'jpg',
  PNG = 'png',
  WEBP = 'webp',
  AVIF = 'avif'
}

interface FetchImageBufferResponse {
  width: number
  format: string
  buffer: ArrayBuffer
}

async function fileExists (path: string): Promise<boolean> {
  try {
    const stats = await fs.promises.stat(path)
    return stats.isFile()
  } catch (err) {
    if (err.code === 'ENOENT') {
      return false
    }
    throw err
  }
}

async function dirExists (path: string): Promise<boolean> {
  try {
    const stats = await fs.promises.stat(path)
    return stats.isDirectory()
  } catch (err) {
    if (err.code === 'ENOENT') {
      return false
    }
    throw err
  }
}

export class UrlImageResizer extends AbstractService {
  private static USE_CACHE = true
  private static CACHE_DIR = path.join(process.cwd(), 'images')
  private static ADJUST_QUALITY_ABOVE = 800
  private static FORMATS_WITH_QUALITY = ['jpeg', 'png', 'webp', 'avif']
  private static OUTPUT_QUALITY = 94

  private url: URL

  private imageDiskDir: string

  private originalFormat: string = 'jpg'

  private desiredFormat: string

  public constructor (url: string, format: ConversionFormat | undefined) {
    super()
    this.url = new URL(url)
    this.imageDiskDir = this.getImageDiskDirectory(url)
    this.setExtension(path.extname(this.url.pathname))
    this.desiredFormat = format ?? this.originalFormat
  }

  private setExtension (extension: string): UrlImageResizer {
    extension = extension.replace('.', '')
    if (!extension) {
      throw new InvalidArgumentException('Extension cannot be empty')
    }
    this.originalFormat = extension
    return this
  }

  public async resize (width: number): Promise<ResizeResponse> {
    const imageBuffer = await this.fetchImageBuffer(width)
    const needsConversion = imageBuffer.format !== this.desiredFormat
    const needsResize = imageBuffer.width !== width

    if (!needsConversion && !needsResize) {
      return { buffer: imageBuffer.buffer, format: imageBuffer.format }
    }

    sharp.concurrency(1)
    let image = sharp(imageBuffer.buffer)
    const meta = await image.metadata()

    if (!this.isSupportedImageFormat(meta)) {
      throw new UnsupportedImageFormatException('Only HEIF/AVIF images up to 8-bit are supported')
    }

    if (needsResize) {
      image = image.resize(width)
    }

    if (width > UrlImageResizer.ADJUST_QUALITY_ABOVE && UrlImageResizer.FORMATS_WITH_QUALITY.includes(meta.format)) {
      image = image.toFormat(this.desiredFormat as keyof FormatEnum, { quality: UrlImageResizer.OUTPUT_QUALITY })
    } else if (needsConversion) {
      image = image.toFormat(this.desiredFormat as keyof FormatEnum)
    }

    const newImageBuffer = await image.toBuffer()

    if (UrlImageResizer.USE_CACHE) {
      fs.promises.writeFile(path.join(this.imageDiskDir, `${width}.${this.desiredFormat}`), newImageBuffer)
    }

    const format = this.desiredFormat === 'heif' ? 'avif' : this.desiredFormat

    return { buffer: newImageBuffer, format }
  }

  private isSupportedImageFormat (meta: sharp.Metadata) {
    if (meta.format === 'heif') {
      if (!meta.bitsPerSample || meta.bitsPerSample > 8) {
        return false
      }
    }
    return true
  }

  private getImageDiskDirectory (url: string): string {
    const hash = crypto.createHash('sha256').update(url).digest('hex')
    const parts = hash.slice(0, 8).split('')
    const dir = path.join(UrlImageResizer.CACHE_DIR, ...parts, hash)
    return dir
  }

  private async fetchImageBuffer (width: number): Promise<FetchImageBufferResponse> {
    const desiredFormat = this.desiredFormat ?? this.originalFormat
    const desiredExtension = `.${desiredFormat}`

    if (UrlImageResizer.USE_CACHE) {
      const imageFileName = `${width}${desiredExtension}`
      const targetImage = path.join(this.imageDiskDir, imageFileName)
      if (await fileExists(targetImage)) {
        const buffer = await fs.promises.readFile(targetImage, { flag: 'r' })
        return { buffer, format: desiredFormat, width }
      }

      if (this.desiredFormat !== this.originalFormat) {
        const desiredExtension = `.${desiredFormat}`
        const imageFileName = `${width}${desiredExtension}`
        const targetImage = path.join(this.imageDiskDir, imageFileName)
        if (await fileExists(targetImage)) {
          const buffer = await fs.promises.readFile(targetImage, { flag: 'r' })
          return { buffer, format: desiredFormat, width }
        }
      }

      if (await dirExists(this.imageDiskDir)) {
        const files = await fs.promises.readdir(this.imageDiskDir)
        const candidates = files
          .map(fileName => {
            return {
              fileName,
              width: parseInt(fileName.split('.')[0], 10),
              format: fileName.split('.')[1]
            }
          })
          .filter((c) => !isNaN(c.width) && c.width > width)

        if (candidates.length) {
          candidates.sort((a, b) => a.width - b.width)
          const bestCandidate = candidates[0]
          const buffer = await fs.promises.readFile(path.join(this.imageDiskDir, bestCandidate.fileName))
          return { buffer, format: bestCandidate.format, width: bestCandidate.width }
        }
      }
    }

    const originalFilename = `original.${this.originalFormat}`
    const originalImageFullPath = path.join(this.imageDiskDir, originalFilename)

    if (await fileExists(originalImageFullPath)) {
      const buffer = await fs.promises.readFile(originalImageFullPath)
      return { buffer, format: this.originalFormat, width: 99999 }
    }

    const res = await fetch(this.url)
    if (!res.ok) {
      throw new EntityNotFoundException(`Failed to fetch image: ${res.status} ${res.statusText}`)
    }
    const buffer = await res.arrayBuffer()

    await fs.promises.mkdir(this.imageDiskDir, { recursive: true })
    fs.promises.writeFile(originalImageFullPath, Buffer.from(buffer))

    return { buffer, format: this.originalFormat, width: 99999 }
  }
}
