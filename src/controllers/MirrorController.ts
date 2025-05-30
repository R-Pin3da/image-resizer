import AbstractController from './AbstractController'
import type { FastifyInstance, FastifyRequest } from 'fastify'

export default class MirrorController extends AbstractController {
  public async handle (request: FastifyRequest) {
    return {
      path: request.params,
      query: request.query,
      body: request.body
    }
  }

  protected registerRoutes (fastify: FastifyInstance): void {
    fastify.route({
      method: 'POST',
      url: '/mirror/:param',
      handler: this.handle.bind(this)
    })
  }
}
