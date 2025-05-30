import { FastifyError, FastifyReply, FastifyRequest } from 'fastify'
import InvalidArgumentException from '../exceptions/InvalidArgumentException'
import { AuthenticationException } from '../exceptions/AuthenticationException'
import { EntityNotFoundException } from '../exceptions/EntityNotFoundException'
import { UnauthorizedException } from '../exceptions/UnauthorizedException'
import UnsupportedImageFormatException from '../exceptions/UnsupportedImageFormatException'

export default (error: FastifyError, request: FastifyRequest, reply: FastifyReply) => {
  let statusCode = error.statusCode ?? 500
  let errorName = error.constructor.name
  let errorMessage = error.message
  switch (error.constructor) {
    case EntityNotFoundException:
      statusCode = 404
      break
    case UnauthorizedException:
      statusCode = 403
      break
    case AuthenticationException:
      statusCode = 401
      break
    case InvalidArgumentException:
      statusCode = 400
      break
    case UnsupportedImageFormatException:
      statusCode = 415
      break
    default:
      if (statusCode === 500) {
        console.error(error)
        errorName = 'Internal server error'
        errorMessage = 'Internal server error'
      }
  }
  const response = {
    error: errorName,
    message: errorMessage
    // stackTrace: error.stack
  }
  reply.code(statusCode).send(response)
}
