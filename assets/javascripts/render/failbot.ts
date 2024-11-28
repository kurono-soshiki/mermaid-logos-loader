// Reports uncaught JS errors to Sentry
import {isDefined} from './utils'
import {parse} from 'stacktrace-parser'

type NavigationExtraInfo = Record<string, unknown>
type NavigationDetails = {
  type: string
  url: string
  state: History['state']
  info: NavigationExtraInfo
}

const baseContext = {originalHistoryState: JSON.stringify(window.history.state)}
const ERROR_METADATA_KEYS = ['commit', 'repository_id', 'repository_type', 'browser', 'version']

/**
 * Firefox (and perhaps other browsers) will ocassionally return a null
 * value for the error property on an error event.
 * It is unclear why this would happen, but it leads to some confusing error reporting
 * in Sentry
 *
 * @link https://developer.mozilla.org/en-US/docs/Web/API/GlobalEventHandlers/onerror
 */
const errorFallback = {
  name: 'NullErrorEvent',
  stack: '',
  failbotContext: {},
}

/**
 * Parses the url of the renderable being displayed for metadata that can help us
 * troubleshoot client JS errors without exposing PII.
 * This data is currently being proxied to failbotg from the go server.
 *
 * @param {Object} locationData object adhering to the Location interface
 * @returns Map of additional error data we want to supply to sentry
 */
function getErrorMetadata(locationData: Location) {
  const {pathname, search} = locationData
  const pathParts = pathname.split('/')
  const [action, format] = pathParts.slice(1)
  const urlParams = new URLSearchParams(search)

  const paramsMetadata = Array.from(urlParams.entries()).reduce((memo, pair) => {
    if (ERROR_METADATA_KEYS.includes(pair[0])) {
      memo = {
        ...memo,
        [pair[0]]: pair[1],
      }
    }

    return memo
  }, {})

  return {...paramsMetadata, format, action}
}

/**
 * Many errors are emitted from chrome extensions, e.g. users
 * with TexAllTheThings, which attempts to load a version of mathjax.
 * That extension doesn't handle load failures and results in errors
 * being reported to us that we:
 * * cannot control
 * * do not affect the rendering of the notebook
 * So, we ignore them when detected.
 * @param {string} filename
 * @returns boolean
 */
function isChromeExtension(filename = '') {
  return filename.includes('chrome-extension://')
}

const loadTime = new Date().getTime()

// Flag when page is unloaded
let unloaded = false

function flagUnloaded() {
  unloaded = true
}

function flagLoaded() {
  unloaded = false
}

function reportErrors(event: ErrorEvent) {
  // Do this first so we can skip all the extra, unnecessary operations
  if (!reportable(event) && event.type !== 'submit') {
    return
  }
  const {message, filename, lineno, error} = event
  const safeError = error || errorFallback
  const {stack, name, failbotContext} = safeError
  const preprocessedStack = parse(stack)
  const stacktrace = preprocessedStack
    .map(frame => ({
      filename: frame.file || '',
      function: String(frame.methodName),
      lineno: (frame.lineNumber || 0).toString(),
      colno: (frame.column || 0).toString(),
    }))
    .reverse()
  const exceptionDetail = [
    {
      type: name,
      value: message,
      stacktrace,
    },
  ]

  const context = {
    message,
    filename,
    lineno,
    url: window.location.href,
    readyState: document.readyState,
    referrer: document.referrer,
    stack: safeError.stack,
    historyState: JSON.stringify(window.history.state),
    timeSinceLoad: Math.round(new Date().getTime() - loadTime),
    extensionScripts: JSON.stringify(extensionScripts().sort()),
    navigations: JSON.stringify(getNavigations()),
    exceptionDetail,
    platform: 'javascript',
    ...getErrorMetadata(window.location),
    ...failbotContext,
    ...baseContext,
  }

  // Attach any logging info we have
  context.logging = (() => {
    try {
      const debugMessages = (isDefined(window.debug) ? window.debug.buffer() : undefined) || []
      return JSON.stringify(debugMessages)
    } catch {
      return
    }
  })()

  // Report errors to app
  const viewscreenUrl = document.body.getAttribute('data-render-url')

  fetch(`${viewscreenUrl}/_errors`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json; charset=utf-8'},
    body: JSON.stringify(context),
  })
}

const reportable = (function () {
  let errorsReported = 0

  return function (event: ErrorEvent) {
    const {lineno, error, filename} = event
    const errorStack = error ? error.stack : undefined
    // Only report errors if we can get backtraces & line numbers
    if (!errorStack || !lineno) {
      return false
    }

    // Ignore errors raised when browsers cancel loading resources after
    // links are clicked or the page is stopped.
    if (unloaded) {
      return false
    }

    if (isChromeExtension(filename)) {
      return false
    }

    // Report a max of 10 errors per user per page load. This way if something is
    // generating errors continuously, we won't flood Haystack with duplicates.
    if (errorsReported >= 10) {
      return false
    }
    errorsReported++

    return true
  }
})()

const extensionScripts = () =>
  (() => {
    const result = []
    const scripts = Array.from(document.querySelectorAll('script'))
    for (const script of scripts) {
      if (/^(?:chrome-extension|file):/.test(script.src)) {
        result.push(script.src)
      }
    }
    return result
  })()

// Add the just-completed navigation to session storage to be included in
// needles for debugging.
function pushNavigation(loadType: string, info: NavigationExtraInfo = {}) {
  const navigations = getNavigations()
  navigations.push({type: loadType, url: window.location.href, state: window.history.state, info})
  return setNavigations(navigations)
}

const NAVIGATIONS_KEY = 'navigations'

// Retrieve all past navigations from the current session.
function getNavigations() {
  const json = (() => {
    try {
      return sessionStorage.getItem(NAVIGATIONS_KEY)
    } catch {
      return
    }
  })()
  if (json) {
    return JSON.parse(json)
  } else {
    return []
  }
}

// Store the current session's navigations.
function setNavigations(navigations: NavigationDetails[]) {
  try {
    return sessionStorage.setItem(NAVIGATIONS_KEY, JSON.stringify(navigations))
  } catch {
    return
  }
}

// Record all navigations in this session for inclusion in needles.
pushNavigation('load')

window.addEventListener('hashchange', event =>
  pushNavigation('hashchange', {oldURL: event.oldURL, newURL: event.newURL}),
)
window.addEventListener('popstate', event => pushNavigation('popstate', {eventState: event.state}))
window.addEventListener('pageshow', flagLoaded)
window.addEventListener('pagehide', flagUnloaded)
window.addEventListener('error', reportErrors)

document.addEventListener('pjax:success', () => pushNavigation('pjax:success'))
document.addEventListener('pjax:popstate', (event: PJaxPopStateEvent) =>
  pushNavigation('pjax:popstate', {pjaxDirection: event.direction, pjaxState: event.state}),
)

export default reportErrors
