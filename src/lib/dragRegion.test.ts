import { describe, it, expect } from "vitest";
import { dragRegionProps } from "./dragRegion";

describe("dragRegionProps", () => {
  it("ativo (Modo 2) marca a região como arrastável", () => {
    expect(dragRegionProps(true)).toEqual({ "data-tauri-drag-region": true });
  });

  it("inativo (Modo 1) não adiciona atributo", () => {
    expect(dragRegionProps(false)).toEqual({});
  });
});
