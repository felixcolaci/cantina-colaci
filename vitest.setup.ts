import '@testing-library/jest-dom'

// cmdk (used by shadcn Command) requires ResizeObserver which jsdom doesn't provide
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

// cmdk uses scrollIntoView which jsdom doesn't implement
window.HTMLElement.prototype.scrollIntoView = function () {}
