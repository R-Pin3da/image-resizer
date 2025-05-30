import type { FastifyInstance } from 'fastify'
import fs from 'fs'
import path from 'path'

export default function setRoutes (fastify: FastifyInstance) {
  const controllersPath = path.join(__dirname, '../controllers/')
  const controllerFiles = fs.readdirSync(controllersPath, { recursive: true })
    .map(file => file.toString())
    .filter(file => !file.startsWith('Abstract') && file.match(/\.(ts|js)$/))

  controllerFiles.forEach(file => {
    const controllerPath = path.join(controllersPath, file)
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const controller = require(controllerPath)
    const ControllerClass = controller.default || controller
    // eslint disabled because the first controller created registers the routes automatically
    // eslint-disable-next-line no-new
    new ControllerClass(fastify)
  })

  fastify.register(async (fastify) => {
    // eslint-disable-next-line no-console
    console.log(fastify.printRoutes())
  })
}
