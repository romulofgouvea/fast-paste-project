import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ItemCard } from "./ItemCard";
import { listGroups, pasteText, setItemGroup, type ClipItem } from "../lib/api";

vi.mock("../lib/api", () => ({
  listGroups: vi.fn(),
  pasteText: vi.fn().mockResolvedValue(undefined),
  setItemGroup: vi.fn().mockResolvedValue(undefined),
  getThumbnail: vi.fn(),
}));

const base: ClipItem = {
  id: 1,
  type: "text",
  content: "Olá Mundo\nsegunda linha",
  preview: null,
  pinned: false,
  timestamp: Date.now(),
  hasMedia: false,
  groupId: null,
};

function setup(item: ClipItem = base) {
  const handlers = {
    onSelect: vi.fn(),
    onDelete: vi.fn(),
    onTogglePin: vi.fn(),
    onHover: vi.fn(),
  };
  render(<ItemCard item={item} selected={false} {...handlers} />);
  const card = screen.getByRole("button", { name: new RegExp(item.content?.split("\n")[0] ?? "Imagem", "i") });
  return { ...handlers, card };
}

async function openMenu(card: HTMLElement) {
  fireEvent.contextMenu(card, { clientX: 30, clientY: 40 });
  await waitFor(() => expect(listGroups).toHaveBeenCalled());
}

describe("ItemCard — ações", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listGroups).mockResolvedValue([{ id: 3, name: "Trabalho" }]);
  });

  it("clicar no cartão seleciona o item", () => {
    const { card, onSelect } = setup();
    fireEvent.click(card);
    expect(onSelect).toHaveBeenCalledWith(1);
  });

  it("passar o mouse avisa o pai para destacar o item", () => {
    const { card, onHover } = setup();
    fireEvent.mouseEnter(card);
    expect(onHover).toHaveBeenCalled();
  });

  it("o botão de fixar não seleciona o item", () => {
    const { onSelect, onTogglePin } = setup();
    fireEvent.click(screen.getByTitle("Fixar"));
    expect(onTogglePin).toHaveBeenCalledWith(1);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("item fixado oferece 'Desafixar'", () => {
    setup({ ...base, pinned: true });
    expect(screen.getByTitle("Desafixar")).toBeDefined();
  });

  it("o botão de excluir não seleciona o item", () => {
    const { onSelect, onDelete } = setup();
    fireEvent.click(screen.getByTitle("Excluir"));
    expect(onDelete).toHaveBeenCalledWith(1);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("menu de contexto → Fixar", async () => {
    const { card, onTogglePin } = setup();
    await openMenu(card);
    fireEvent.click(await screen.findByText("Fixar", { selector: "button" }));
    expect(onTogglePin).toHaveBeenCalledWith(1);
  });

  it("menu de contexto → Excluir", async () => {
    const { card, onDelete } = setup();
    await openMenu(card);
    fireEvent.click(await screen.findByText("Excluir", { selector: "button" }));
    expect(onDelete).toHaveBeenCalledWith(1);
  });

  it("menu de contexto → Colar como texto puro", async () => {
    const { card } = setup();
    await openMenu(card);
    fireEvent.click(await screen.findByText("Colar como texto puro"));
    expect(pasteText).toHaveBeenCalledWith("Olá Mundo\nsegunda linha");
  });

  it("menu de contexto → Inverter maiúsculas/minúsculas", async () => {
    const { card } = setup();
    await openMenu(card);
    fireEvent.click(await screen.findByText("Inverter maiúsculas/minúsculas"));
    expect(pasteText).toHaveBeenCalledWith("oLÁ mUNDO\nSEGUNDA LINHA");
  });

  it("menu de contexto → Remover quebras de linha", async () => {
    const { card } = setup();
    await openMenu(card);
    fireEvent.click(await screen.findByText("Remover quebras de linha"));
    expect(pasteText).toHaveBeenCalledWith("Olá Mundo segunda linha");
  });

  it("menu de contexto → Mover para um grupo", async () => {
    const { card } = setup();
    await openMenu(card);
    fireEvent.click(await screen.findByText('Mover para "Trabalho"'));
    expect(setItemGroup).toHaveBeenCalledWith(1, 3);
  });

  it("menu de contexto → Sem grupo", async () => {
    const { card } = setup();
    await openMenu(card);
    fireEvent.click(await screen.findByText("Sem grupo"));
    expect(setItemGroup).toHaveBeenCalledWith(1, null);
  });

  it("itens de imagem não oferecem transformações de texto", async () => {
    const image: ClipItem = { ...base, id: 2, type: "image", content: null, hasMedia: true };
    render(<ItemCard item={image} selected={false} onSelect={vi.fn()} onDelete={vi.fn()} onTogglePin={vi.fn()} />);
    const card = screen.getAllByRole("button", { name: /Imagem/i })[0];
    await openMenu(card);
    await screen.findByText("Sem grupo");
    expect(screen.queryByText("Colar como texto puro")).toBeNull();
  });

  it("arrastar texto cria um arquivo .txt via DownloadURL", () => {
    const { card } = setup();
    const setData = vi.fn();
    fireEvent.dragStart(card, { dataTransfer: { setData, effectAllowed: "" } });
    expect(setData).toHaveBeenCalledWith(
      "DownloadURL",
      expect.stringContaining("text/plain:fpaste-1.txt:data:text/plain;charset=utf-8,"),
    );
  });

  it("link usa o ícone padrão e mostra o domínio (sem favicon remoto)", () => {
    const link: ClipItem = { ...base, id: 4, type: "link", content: "https://www.example.com/x" };
    render(<ItemCard item={link} selected={false} onSelect={vi.fn()} onDelete={vi.fn()} onTogglePin={vi.fn()} />);
    expect(screen.getAllByText("example.com").length).toBeGreaterThan(0);
    expect(document.querySelector('img[src*="google.com"]')).toBeNull();
  });

  it("código é renderizado com o HTML escapado do highlight.js (sem tags do clipboard)", () => {
    const code: ClipItem = {
      ...base,
      id: 5,
      type: "code",
      content: "const a = '<img src=x onerror=alert(1)>';\nreturn a;",
    };
    render(<ItemCard item={code} selected={false} onSelect={vi.fn()} onDelete={vi.fn()} onTogglePin={vi.fn()} />);
    expect(document.querySelector("img[onerror]")).toBeNull();
    expect(document.querySelector('img[src="x"]')).toBeNull();
  });
});
