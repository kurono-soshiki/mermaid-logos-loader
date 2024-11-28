import '../../stylesheets/mermaid.scss'
import '../render'
import {MESSAGE_RESPONSE_TYPES, STATUS_TYPES} from '../render/constants'
import {onDocumentReady} from '../render/utils'
import {MermaidMarkdownViewer} from './lib/markdown-viewer'

function init() {
  const viewer = new MermaidMarkdownViewer<MarkdownResponseEvent>({
    loadEvent: STATUS_TYPES.markdown,
    onLoadEvent: MESSAGE_RESPONSE_TYPES.markdown,
  })

  viewer.initialize()
}

export {init}

onDocumentReady(init)
