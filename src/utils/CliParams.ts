export default class CliParams {
  // eslint-disable-next-line  @typescript-eslint/no-require-imports
  public static cliArguments = require('args-parser')(process.argv)

  public static getNumber (key: string, deflt: number): number {
    const value = CliParams.cliArguments[key]
    if (value === undefined || isNaN(+value)) {
      return deflt
    }
    return +value
  }
}
