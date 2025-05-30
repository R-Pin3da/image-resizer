import { FastifyListenOptions } from 'fastify'
import EnvUtils from '../utils/EnvUtils'
import CliParams from '../utils/CliParams'

export default function getServerConfig (): FastifyListenOptions {
  let port = EnvUtils.getNumber('PORT', 3000)
  port = CliParams.getNumber('port', port)
  return {
    host: '0.0.0.0',
    port
  }
}
