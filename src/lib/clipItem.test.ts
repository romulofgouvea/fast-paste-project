import { describe, it, expect, vi, afterEach } from "vitest";
import { TYPE_LABEL, domainOf, faviconOf, relativeTime, titleOf } from "./clipItem";
import type { ClipItem } from "./api";

function item(type: ClipItem["type"]): ClipItem {
  return { id: 1, type, preview: null, content: null, pinned: false, timestamp: 0, hasMedia: false, groupId: null };
}

describe("relativeTime", () => {
  afterEach(() => vi.useRealTimers());

  it("formata agora, minutos, horas e dias", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-10T12:00:00Z"));
    const ago = (ms: number) => Date.now() - ms;
    expect(relativeTime(ago(10_000))).toBe("agora");
    expect(relativeTime(ago(5 * 60_000))).toBe("5 min");
    expect(relativeTime(ago(3 * 3_600_000))).toBe("3 h");
    expect(relativeTime(ago(2 * 86_400_000))).toBe("2 d");
  });
});

describe("domainOf", () => {
  it("extrai o host sem www", () => {
    expect(domainOf("https://www.example.com/a?b=1")).toBe("example.com");
    expect(domainOf("www.example.org")).toBe("example.org");
  });

  it("cai no texto truncado quando não é URL", () => {
    expect(domainOf("x".repeat(50))).toBe("x".repeat(32));
  });
});

describe("faviconOf", () => {
  it("não monta URL externa (evita vazar o host de cada link copiado)", () => {
    expect(faviconOf("https://example.com")).toBe("");
    expect(faviconOf("www.example.com")).toBe("");
    expect(faviconOf("não é url")).toBe("");
  });
});

describe("titleOf", () => {
  it("link usa o domínio", () => {
    expect(titleOf(item("link"), "https://www.tauri.app/start")).toBe("tauri.app");
  });

  it("imagem e arquivos têm rótulo fixo", () => {
    expect(titleOf(item("image"), "")).toBe("Imagem");
    expect(titleOf(item("files"), "")).toBe("Arquivo");
  });

  it("texto usa a primeira linha não vazia", () => {
    expect(titleOf(item("text"), "\n\n  \nprimeira\nsegunda")).toBe("primeira");
  });

  it("trunca linhas longas em 48 caracteres com reticências", () => {
    const title = titleOf(item("code"), "a".repeat(60));
    expect(title).toBe("a".repeat(48) + "…");
  });
});

describe("TYPE_LABEL", () => {
  it("cobre todos os tipos de item", () => {
    for (const t of ["text", "link", "code", "image", "files"]) {
      expect(TYPE_LABEL[t]).toBeTruthy();
    }
  });
});
