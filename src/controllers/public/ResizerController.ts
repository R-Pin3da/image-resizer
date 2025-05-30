import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import AbstractController from '../AbstractController'
import ImageResizeService from '../../services/ImageResizeService'

interface ResizeQuery {
  w: number
  h?: number
  url: string
}

export default class ResizerController extends AbstractController {
  private imageResizeService: ImageResizeService

  public constructor (fastify: FastifyInstance) {
    super(fastify)
    this.imageResizeService = new ImageResizeService()
  }

  public async resizeImage (request: FastifyRequest<{ Querystring: ResizeQuery }>, reply: FastifyReply) {
    const { w, h, url } = request.query
    const { buffer, format } = await this.imageResizeService.resizeFromUrl(url, w, h)
    reply.header('Content-Type', `image/${format}`)
      .send(buffer)
  }

  protected registerRoutes (fastify: FastifyInstance): void {
    fastify.route({
      method: 'GET',
      url: '/',
      handler: this.resizeImage.bind(this),
      schema: {
        querystring: {
          type: 'object',
          required: ['w', 'url'],
          properties: {
            w: { type: 'integer', minimum: 1, maximum: 2048 },
            h: { type: 'integer', minimum: 1, maximum: 2048 },
            url: { type: 'string', format: 'uri' }
          }
        }
      }
    })
  }
}
