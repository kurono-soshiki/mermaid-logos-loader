import {DEFAULT_DOCS_LINK_HOSTNAME} from './constants'

/**
 * Determine if a value is nullish (undefined or null)
 * @param {*} value The value to check
 * @returns boolean
 */
export function isDefined<T = unknown>(value?: T): value is NonNullable<T> {
  return value !== null && value !== undefined && typeof value !== 'undefined'
}

export function onDocumentReady(initializer: () => void) {
  if (document.readyState === 'complete') {
    initializer()
  } else {
    document.addEventListener('DOMContentLoaded', initializer)
  }
}

export function decodeHTML(html: string) {
  // DOMParser won't run javascript and just returns text,
  // so this should be safe.
  const doc = new DOMParser().parseFromString(html, 'text/html')
  return doc.documentElement.textContent ?? ''
}

class InvariantViolationError extends Error {}

export function invariant(condition: any, message?: string): asserts condition {
  if (condition) return

  throw new InvariantViolationError(message ?? 'Invariant violation')
}

export const assertElement = (node: any): node is Element => node instanceof Element

export const assertHTMLElement = (node: Element | ParentNode | HTMLElement | null): node is HTMLElement =>
  node instanceof HTMLElement

export const assertSVGElement = (node: SVGElement | SVGSVGElement | null): node is SVGElement =>
  node instanceof SVGElement

export const getGitHubDocsHostname = () =>
  document.body.getAttribute('data-github-docs-hostname') || DEFAULT_DOCS_LINK_HOSTNAME

const getDomainName = (hostname: string) => hostname.split('.').slice(-2).join('.').toLowerCase()

/**
 * Determine if the source domain has the same origin as the host domain. To match, the source domain must contain
 * have the same domain name (ignoring subdomains) as the host domain.
 */
export const isSameOrigin = (targetHostname: string, sourceHostname: string) =>
  getDomainName(targetHostname) === getDomainName(sourceHostname)

/** Adds `target="_parent"` (if not already set to something else) to all links in this node. */
export const openLinksInParent = (node: Element) => {
  for (const link of node.querySelectorAll('a'))
    if (!link.hasAttribute('_target')) link.setAttribute('target', '_parent')
}
