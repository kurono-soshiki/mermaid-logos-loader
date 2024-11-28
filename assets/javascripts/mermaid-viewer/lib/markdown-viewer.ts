import {decodeHTML} from '../../render/utils'
import MermaidRenderer from './mermaid-renderer'
import {MermaidViewer} from './mermaid-viewer'

class MermaidMarkdownViewer<T extends ContainerResizeEvent | MarkdownResponseEvent> extends MermaidViewer<T> {
  initialize() {
    this.iframeMessenger.set(this.loadEvent)
  }

  onLoad(event: MarkdownResponseEvent, renderer?: MermaidRenderer) {
    // the data gets HTML escaped when added to the content node, so we
    // have to unescape it here.
    const decoded = decodeHTML(event.detail.data)
    const width = event.detail.width

    if (!(renderer instanceof MermaidRenderer)) {
      renderer = new MermaidRenderer({data: decoded, el: this.el, width})
      window.addEventListener('resize', this.lazyRender(renderer))
    } else {
      renderer.width = width
    }

    return renderer
  }
}

export {MermaidMarkdownViewer}
