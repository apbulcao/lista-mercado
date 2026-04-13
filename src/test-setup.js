import '@testing-library/jest-dom'

// localStorage polyfill para Vitest 4 + jsdom
// vi.unstubAllGlobals() pode remover a implementação nativa em alguns ambientes
const localStorageMock = (() => {
  let store = {}
  return {
    getItem: (key) => store[key] ?? null,
    setItem: (key, value) => { store[key] = String(value) },
    removeItem: (key) => { delete store[key] },
    clear: () => { store = {} },
    key: (index) => Object.keys(store)[index] ?? null,
    get length() { return Object.keys(store).length },
  }
})()

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true,
})
