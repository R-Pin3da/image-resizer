import { FastifyInstance } from 'fastify'

export default abstract class AbstractController {
  private static routesRegistered = false

  public constructor (fastify: FastifyInstance) {
    if (!(this.constructor as typeof AbstractController).routesRegistered) {
      this.registerRoutes(fastify)
    }
  }

  protected abstract registerRoutes (fastify: FastifyInstance): void
}
