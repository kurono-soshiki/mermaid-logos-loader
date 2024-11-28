import debounce from 'lodash.debounce'
import {MESSAGE_RESPONSE_TYPES, RENDER_FORMATS, STATUS_TYPES} from '../../render/constants'
import Status from '../../render/status'
import {assertHTMLElement, invariant, getGitHubDocsHostname} from '../../render/utils'
import type MermaidRenderer from './mermaid-renderer'
import octicons from '@primer/octicons'

const DOCS_LINK_PATH =
  '/get-started/writing-on-github/working-with-advanced-formatting/creating-diagrams#creating-mermaid-diagrams'

export type MermaidEventTypes = {onLoadEvent: MESSAGE_RESPONSE_TYPES; loadEvent: STATUS_TYPES}

export abstract class MermaidViewer<CustomEventType extends ContainerResizeEvent | MarkdownResponseEvent> {
  el: HTMLElement
  iframeMessenger: Status
  onLoadEvent: MESSAGE_RESPONSE_TYPES
  loadEvent: STATUS_TYPES

  constructor({onLoadEvent, loadEvent}: MermaidEventTypes) {
    const node = document.querySelector('.mermaid-view')

    invariant(assertHTMLElement(node), `Mermaid render root node does not exist. Got ${document.body.innerHTML}`)

    this.el = node
    this.iframeMessenger = new Status(RENDER_FORMATS.mermaid, {
      allowLinks: true,
    })

    this.loadEvent = loadEvent
    this.onLoadEvent = onLoadEvent

    let renderer: MermaidRenderer
    document.addEventListener(this.onLoadEvent, ((event: CustomEventType) => {
      renderer = this.onLoad(event, renderer)
      this.onAfterLoad(renderer, true)
    }) as EventListener)
    document.addEventListener(MESSAGE_RESPONSE_TYPES.readyAck, (() => {
      this.onAfterLoad(renderer, false)
    }) as EventListener)

    this.#panAndZoom()
  }

  lazyRender = (renderer: MermaidRenderer) =>
    debounce(async () => {
      const newWidth = this.el.getBoundingClientRect().width

      // The width of the element's container hasn't changed.
      if (renderer.width === newWidth) {
        return
      }

      renderer.width = newWidth
      const newHeight = await renderer.render()
      this.iframeMessenger.set(STATUS_TYPES.resize, {
        height: newHeight,
      })
    }, 200)

  protected abstract initialize(): void
  protected abstract onLoad(
    event: ContainerResizeEvent | MarkdownResponseEvent,
    renderer?: MermaidRenderer,
  ): MermaidRenderer

  private async onAfterLoad(renderer: MermaidRenderer, firstLoad = true) {
    try {
      // On initial load, the iframe is not the correct height. We need to
      // render the diagram to calculate the correct height, have the
      // embedding page resize the iframe, and then re-render the diagram.
      // To do this, we will use a two-pass render where we first render the
      // diagram and set the "ready" message and ask for a ready ack. The
      // embedder will ack the ready message once the iframe has been resized
      // _and redrawn on screen_ at the correct size. Once we receive the ack,
      // we will render the diagram again.
      //
      // This is necessary because some mermaid diagrams need the
      // container to be visible in order to calculate the correct positions
      // and dimensions of elements in the diagram.
      // See https://github.com/github/viewscreen/issues/471 for more details.
      const diagramHeight = await renderer.render()

      if (firstLoad) {
        this.iframeMessenger.set(STATUS_TYPES.ready, {
          height: diagramHeight,
          ack: true,
        })
      }
    } catch (error) {
      this.reportError(error as Error)
    }
  }

  protected reportError(error: Error) {
    const url = new URL(DOCS_LINK_PATH, getGitHubDocsHostname())
    const message = `
        ${error.message}
    
        For more information, see ${url.toString()}
      `.trim()
    this.iframeMessenger.set(STATUS_TYPES.error, {error: message})
    window.debug(error)
  }

  #panAndZoom = () => {
    const ZOOM_MIN = 0.5
    const ZOOM_MAX = 8

    let zoomLevel = 1
    const translate = {x: 0, y: 0}

    const reset = () => {
      zoomLevel = 1
      translate.x = 0
      translate.y = 0
      transformSvg(zoomLevel, translate.x, translate.y)
    }

    const doMove = (vertical: number, horizonal: number) => {
      translate.y += vertical
      translate.x += horizonal
      transformSvg(zoomLevel, translate.x, translate.y)
    }

    const doZoom = (value: number) => {
      zoomLevel += value
      zoomLevel = Math.min(Math.max(ZOOM_MIN, zoomLevel), ZOOM_MAX)
      transformSvg(zoomLevel, translate.x, translate.y)
    }

    const transformSvg = (zoom: number, x: number, y: number) => {
      const svg = this.el.getElementsByTagName('svg')[0]
      svg.style.transform = `translate(${x}px, ${y}px) scale(${zoom})`
    }

    const controlPanel = this.#createElement('div', 'mermaid-viewer-control-panel', '', null)
    const df = document.createDocumentFragment()
    df.appendChild(
      this.#createElement('button', 'btn zoom-in', octicons['zoom-in'].toSVG(), () => doZoom(0.1), 'Zoom in'),
    )
    df.appendChild(
      this.#createElement('button', 'btn zoom-out', octicons['zoom-out'].toSVG(), () => doZoom(-0.1), 'Zoom out'),
    )
    df.appendChild(this.#createElement('button', 'btn reset', octicons['sync'].toSVG(), reset, 'Reset view'))
    df.appendChild(
      this.#createElement('button', 'btn up', octicons['chevron-up'].toSVG(), () => doMove(100, 0), 'Pan up'),
    )
    df.appendChild(
      this.#createElement('button', 'btn down', octicons['chevron-down'].toSVG(), () => doMove(-100, 0), 'Pan down'),
    )
    df.appendChild(
      this.#createElement('button', 'btn left', octicons['chevron-left'].toSVG(), () => doMove(0, 100), 'Pan left'),
    )
    df.appendChild(
      this.#createElement('button', 'btn right', octicons['chevron-right'].toSVG(), () => doMove(0, -100), 'Pan right'),
    )

    controlPanel.appendChild(df)
    document.body.appendChild(controlPanel)
  }

  #createElement = (
    tag: string,
    className: string,
    innerHTML: string,
    onClick: ((event: MouseEvent) => void) | null,
    label?: string,
  ): HTMLElement => {
    const element = document.createElement(tag)
    element.className = className
    element.innerHTML = innerHTML
    element.onclick = onClick
    if (label) element.ariaLabel = label
    return element
  }
}
