import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import AbstractController from '../AbstractController'
import { ConversionFormat, UrlImageResizer } from '../../services/UrlImageResizer'

interface ResizeQuery {
  w: number
  url: string,
  f?: ConversionFormat
}

export default class ResizerController extends AbstractController {
  public async resizeImage (request: FastifyRequest<{ Querystring: ResizeQuery }>, reply: FastifyReply) {
    const { w, url, f } = request.query
    const imageResizer = new UrlImageResizer(url, f)
    const { buffer, format } = await imageResizer.resize(w)
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
            f: { type: 'string', enum: ['jpg', 'png', 'webp', 'avif'] },
            url: { type: 'string', format: 'uri' }
          }
        }
      }
    })
  }
}
