import {assertElement, invariant} from './utils'

/**
 * LinkNavigator handles linking to relative and absolute URLs from a rich file.
 * Mostly used in geojson pins or within mermaid charts
 *
 * @param hasParent boolean Is this class instantiated from within an iframe?
 */
class LinkNavigator {
  private hasParent!: boolean

  constructor({hasParent = false}) {
    this.hasParent = hasParent

    document.addEventListener('click', (event: MouseEvent) => {
      const target = event.target
      invariant(assertElement(target), `Expected click target to be an instance of Element. Got ${target} instead.`)

      if (this.isLinkableNode(target)) {
        this.handleLink(event)
      }
    })
  }

  private isLinkableNode = (node: Element) => {
    return node.matches('a') || node.matches('svg')
  }

  // Handle the clicking of a link in the document in the context-appropriate way
  public handleLink = (e: MouseEvent) => {
    const target = e.target as HTMLAnchorElement | SVGElement
    const href = target.getAttribute('href') || target.getAttribute('xlink:href') || ''

    // Don't bother processing nothing
    if (!href.length) {
      return
    }
    // anchors can just pass through
    if (href.match(/^#/)) {
      return true
    }

    e.preventDefault()
    try {
      return this.navigateTo(href)
    } catch (error) {
      window.debug(`Navigation to '${href}' failed:`, error)
      const failClass = 'failed'
      const failInterval = 500

      target.classList.add(failClass)
      return setTimeout(() => target.classList.remove(failClass), failInterval)
    }
  }

  // Navigate to `href` either by asking the parent for the move, or by
  // performing the navigation myself.
  public navigateTo = (href: string) => {
    if (href.match(/^https?:\/\//) || href.match(/^\/\//)) {
      this.navigateDirect(href)
    } else {
      this.navigateRelative(href)
    }
  }

  public navigateRelative = (relHref: string) => {
    const rootUrl = document.body.getAttribute('data-github-hostname')

    // Using the URL constructor to build a full URL to take advantage of the built-in sanitization.
    const baseUrl = new URL(`https://${rootUrl}`)
    const prefixedRelHref = relHref.startsWith('/') ? relHref : `/${relHref}`
    const fullUrl = new URL(prefixedRelHref, baseUrl)
    const protocolRelativeURL = fullUrl.toString().replace(/^https:/, '')
    return this.navigateDirect(protocolRelativeURL)
  }

  public navigateDirect = (href: string) => {
    if (this.hasParent) {
      window.top!.location.href = href
    } else {
      window.location.href = href
    }
  }
}

export default LinkNavigator
