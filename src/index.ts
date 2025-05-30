import dotenv from 'dotenv'
import createFastifyInstance from 'fastify'
import setRoutes from './config/routes'
import getServerConfig from './config/server'
import fastifyErrorHandler from './config/fastifyErrorHandler'
import cluster from 'cluster'
import { cpus } from 'os'
import EnvUtils from './utils/EnvUtils'
import CliParams from './utils/CliParams'

dotenv.config()

async function startWebserver () {
  const threads = getServerThreads()
  if (cluster.isPrimary) {
    // eslint-disable-next-line no-console
    console.log(`Using ${threads} threads`)
  }
  if (threads > 1 && cluster.isPrimary) {
    for (let i = 0; i < threads; i++) {
      const worker = cluster.fork()
      worker.on('message', (msg) => {
        if (msg === 'terminate') {
          process.exit(0)
        }
      })
    }
    cluster.on('exit', (worker) => {
      console.error(`Worker ${worker.process.pid} died`)
      cluster.fork()
    })
  } else {
    const fastifyInstance = await createFastifyInstance()
    fastifyInstance.setErrorHandler(fastifyErrorHandler)
    setRoutes(fastifyInstance)
    fastifyInstance.listen(getServerConfig(), (err: Error | null, address: string) => {
      if (err) {
        onError(err)
      }
      // eslint-disable-next-line no-console
      console.log(`Server listening at ${address}`)
    })
  }
}

function getServerThreads (): number {
  let threads = EnvUtils.getNumber('SERVER_THREADS', cpus().length)
  threads = CliParams.getNumber('threads', threads)
  return (threads < 1) ? 1 : threads
}

function onError (e: Error) {
  console.error(e)
  process.exit(1)
}

startWebserver()
