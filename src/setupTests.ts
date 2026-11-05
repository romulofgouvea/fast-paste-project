import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

// A auto-limpeza do Testing Library só se registra quando `afterEach` é global
// (vitest com globals: true). Como os testes importam os helpers explicitamente,
// registramos a limpeza manualmente — sem isso, cada render vaza para o teste
// seguinte e queries como getByTitle/getByRole encontram elementos duplicados.
afterEach(() => {
  cleanup();
});

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// jsdom não implementa IntersectionObserver nem scrollIntoView. O mock guarda
// as instâncias para os testes dispararem a interseção manualmente.
export class MockIntersectionObserver {
  static instances: MockIntersectionObserver[] = [];
  observed: Element[] = [];
  disconnected = false;
  constructor(public callback: IntersectionObserverCallback, public options?: IntersectionObserverInit) {
    MockIntersectionObserver.instances.push(this);
  }
  observe(el: Element) {
    this.observed.push(el);
  }
  unobserve() {}
  disconnect() {
    this.disconnected = true;
  }
  takeRecords() {
    return [];
  }
  trigger(isIntersecting = true) {
    this.callback([{ isIntersecting } as IntersectionObserverEntry], this as unknown as IntersectionObserver);
  }
}
(globalThis as unknown as { IntersectionObserver: unknown }).IntersectionObserver = MockIntersectionObserver;
Element.prototype.scrollIntoView = vi.fn();

afterEach(() => {
  MockIntersectionObserver.instances = [];
});
