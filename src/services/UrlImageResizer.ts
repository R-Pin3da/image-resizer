import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import sharp from 'sharp'
import UnsupportedImageFormatException from '../exceptions/UnsupportedImageFormatException'
import { EntityNotFoundException } from '../exceptions/EntityNotFoundException'
import AbstractService from './AbstractService'
import FileType from 'file-type'

interface ResizeResponse {
  buffer: ArrayBuffer
  format: string
}

enum ImageSourceType {
  EXACT = 'EXACT',
  BIGGER = 'BIGGER',
  ORIGINAL = 'ORIGINAL'
}

interface FetchImageBufferResponse {
  type: ImageSourceType.EXACT | ImageSourceType.ORIGINAL | ImageSourceType.BIGGER
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
  private static CACHE_DIR = path.join(process.cwd(), 'images')
  private static ADJUST_QUALITY_ABOVE = 800
  private static FORMATS_WITH_QUALITY = ['jpeg', 'png', 'webp', 'avif']
  private static OUTPUT_QUALITY = 94

  private url: URL

  private imageDiskDir: string

  private extension: string = ''

  private extensionString: string = ''

  public constructor (url: string) {
    super()
    this.url = new URL(url)
    this.imageDiskDir = this.getImageDiskDirectory(url)
    this.setExtension(path.extname(this.url.pathname))
  }

  private setExtension (extension: string): UrlImageResizer {
    extension = extension.replace('.', '')
    this.extension = extension
    this.extensionString = extension.length ? `.${extension}` : ''
    return this
  }

  async resize (width: number): Promise<ResizeResponse> {
    const imageBuffer = await this.fetchImageBuffer(width)

    if (imageBuffer.type === ImageSourceType.EXACT) {
      if (!this.extension) {
        const extension = await FileType.fileTypeFromBuffer(imageBuffer.buffer)
        if (extension) {
          this.setExtension(extension.ext as string)
        }
      }
      return { buffer: imageBuffer.buffer, format: this.extension }
    }

    let image = sharp(imageBuffer.buffer)
    const meta = await image.metadata()

    if (!this.isSupportedImageFormat(meta)) {
      throw new UnsupportedImageFormatException('Only HEIF/AVIF images up to 8-bit are supported')
    }

    image = image.resize(width)
    if (width > UrlImageResizer.ADJUST_QUALITY_ABOVE && UrlImageResizer.FORMATS_WITH_QUALITY.includes(meta.format)) {
      image = image.toFormat(meta.format, { quality: UrlImageResizer.OUTPUT_QUALITY })
    }
    const newImageBuffer = await image.toBuffer()
    fs.promises.writeFile(path.join(this.imageDiskDir, `${width}${this.extensionString}`), newImageBuffer)

    const format = meta.format === 'heif' ? 'avif' : meta.format

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
    const imageFileName = `${width}${this.extensionString}`
    const targetImage = path.join(this.imageDiskDir, imageFileName)
    if (await fileExists(targetImage)) {
      const buffer = await fs.promises.readFile(targetImage, { flag: 'r' })
      return { buffer, type: ImageSourceType.EXACT }
    }

    if (await dirExists(this.imageDiskDir)) {
      const files = await fs.promises.readdir(this.imageDiskDir)
      const candidates = files
        .map(f => {
          return parseInt(f.split('.')[0], 10)
        })
        .filter(f => !isNaN(f) && f > width)

      if (candidates.length) {
        candidates.sort((a, b) => a - b)
        const best = candidates[0]
        const buffer = await fs.promises.readFile(path.join(this.imageDiskDir, `${best}${this.extensionString}`))
        return { buffer, type: ImageSourceType.BIGGER }
      }
    }

    const originalFilename = `original${this.extensionString}`
    const originalImageFullPath = path.join(this.imageDiskDir, originalFilename)

    if (await fileExists(originalImageFullPath)) {
      const buffer = await fs.promises.readFile(originalImageFullPath)
      return { buffer, type: ImageSourceType.ORIGINAL }
    }

    const res = await fetch(this.url)
    if (!res.ok) {
      throw new EntityNotFoundException(`Failed to fetch image: ${res.status} ${res.statusText}`)
    }
    const buffer = await res.arrayBuffer()

    await fs.promises.mkdir(this.imageDiskDir, { recursive: true })
    fs.promises.writeFile(originalImageFullPath, Buffer.from(buffer))

    return { buffer, type: ImageSourceType.ORIGINAL }
  }
}
