export default class EnvUtils {
  public static getNumber (key: string, deflt?: number): number {
    const value = process.env[key]
    if (value === undefined) {
      if (deflt === undefined) {
        throw EnvUtils.createMissingKeyException(key)
      }
      return deflt
    }
    if (isNaN(+value)) {
      throw EnvUtils.createInvalidKeyException(key, 'number')
    }
    return +value
  }

  public static getString (key: string, deflt?: string): string {
    const value = process.env[key]
    if (value === undefined) {
      if (deflt === undefined) {
        throw EnvUtils.createMissingKeyException(key)
      }
      return deflt
    }
    return value
  }

  private static createMissingKeyException (key: string) {
    return new Error(`Missing environment variable "${key}" and a default value was not provided.`)
  }

  private static createInvalidKeyException (key: string, type: string) {
    return new Error(`Invalid environment variable "${key}" of type "${type}".`)
  }
}
