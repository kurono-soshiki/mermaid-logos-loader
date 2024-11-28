type LogMessage = {
  args: any[]
  time: number
}

export type LoggerFn = (message?: any, ...data: any[]) => void

function logMessage(...messageArgs: any[]): LogMessage {
  return {
    args: messageArgs,
    time: Date.now(),
  }
}

class Logger {
  private _loggerFn: LoggerFn
  public buffer: LogMessage[] = []
  private bufferSize = 50
  private quiet = false

  constructor(options = {loggerFn: window.console.log, quiet: false}) {
    this._loggerFn = options.loggerFn
    this.quiet = options.quiet
  }

  debug(...args: any[]) {
    this.storeMessage(...args)

    if (!this.quiet) {
      this._loggerFn(...args)
    }
  }

  /**
   * Store the most recent log message at the end of the message buffer.
   * Resizes the buffer to bufferSize, removing older messages.
   * All operations performed on copies of the buffer array
   * @param {*} Any
   */
  storeMessage(...args: any[]) {
    const bufCopy = this.buffer
    bufCopy.push(logMessage(...args))
    const nextBuffer = bufCopy.slice(-this.bufferSize)

    this.buffer = nextBuffer
  }

  /**
   * Helper to replay the most recent numMessages in the log buffer
   * @param {number} numMessages? The number of debug / log messages to replay. Defaults to 1
   * @returns the total number of messages in the buffer
   */
  replayMessages(numMessages = 1) {
    const messagesToRead = this.buffer.slice(-numMessages)
    for (const message of messagesToRead) {
      this._loggerFn(`${new Date(message.time)}: `, ...message.args)
    }

    return this.buffer.length
  }
}

export default Logger
