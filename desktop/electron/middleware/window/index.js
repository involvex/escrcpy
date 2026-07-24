function open() {
  console.warn('[window] open() called but module is not implemented')
}

function close() {
  console.warn('[window] close() called but module is not implemented')
}

function destroy() {
  console.warn('[window] destroy() called but module is not implemented')
}

function focus() {
  console.warn('[window] focus() called but module is not implemented')
}

export default {
  open,
  close,
  destroy,
  focus,
}
