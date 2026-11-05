import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ItemGrid } from "./ItemGrid";
import { useHistory } from "../stores/history";
import { useUi } from "../stores/ui";
import { selectItem, type ClipItem } from "../lib/api";
import { MockIntersectionObserver } from "../setupTests";

vi.mock("../lib/api", () => ({
  selectItem: vi.fn().mockResolvedValue(undefined),
  listGroups: vi.fn().mockResolvedValue([]),
  pasteText: vi.fn(),
  setItemGroup: vi.fn(),
  getThumbnail: vi.fn(),
  getHistory: vi.fn(),
  deleteItem: vi.fn(),
  togglePin: vi.fn(),
}));
vi.mock("@tauri-apps/plugin-store", () => ({ load: vi.fn() }));

function make(id: number, text: string): ClipItem {
  return { id, type: "text", content: text, preview: null, pinned: false, timestamp: Date.now(), hasMedia: false, groupId: null };
}

describe("ItemGrid", () => {
  const actions = {
    loadMore: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
    togglePinned: vi.fn().mockResolvedValue(undefined),
    setSelectedIndex: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    useUi.setState({ viewMode: "modo1" });
    useHistory.setState({
      items: [],
      isLoading: false,
      hasMore: true,
      selectedIndex: 0,
      ...actions,
    });
  });

  it("mostra o estado vazio", () => {
    render(<ItemGrid />);
    expect(screen.getByText("Nada por aqui ainda")).toBeDefined();
  });

  it("não mostra o estado vazio enquanto carrega", () => {
    useHistory.setState({ isLoading: true });
    render(<ItemGrid />);
    expect(screen.queryByText("Nada por aqui ainda")).toBeNull();
  });

  it("clicar em um item cola o item escolhido", () => {
    useHistory.setState({ items: [make(1, "primeiro"), make(2, "segundo")] });
    render(<ItemGrid />);
    fireEvent.click(screen.getByRole("button", { name: /segundo/i }));
    expect(selectItem).toHaveBeenCalledWith(2);
  });

  it("passar o mouse destaca o item", () => {
    useHistory.setState({ items: [make(1, "primeiro"), make(2, "segundo")] });
    render(<ItemGrid />);
    fireEvent.mouseEnter(screen.getByRole("button", { name: /segundo/i }));
    expect(actions.setSelectedIndex).toHaveBeenCalledWith(1);
  });

  it("fixar e excluir chamam as ações do store", () => {
    useHistory.setState({ items: [make(1, "primeiro")] });
    render(<ItemGrid />);
    fireEvent.click(screen.getByTitle("Fixar"));
    fireEvent.click(screen.getByTitle("Excluir"));
    expect(actions.togglePinned).toHaveBeenCalledWith(1);
    expect(actions.remove).toHaveBeenCalledWith(1);
  });

  it("rolar até o fim (sentinela visível) carrega a próxima página", () => {
    useHistory.setState({ items: [make(1, "primeiro")] });
    render(<ItemGrid />);
    const observer = MockIntersectionObserver.instances[0];
    observer.trigger(true);
    expect(actions.loadMore).toHaveBeenCalledTimes(1);
  });

  it("sentinela fora da tela não carrega nada", () => {
    useHistory.setState({ items: [make(1, "primeiro")] });
    render(<ItemGrid />);
    MockIntersectionObserver.instances[0].trigger(false);
    expect(actions.loadMore).not.toHaveBeenCalled();
  });

  it("mostra 'fim do histórico' quando não há mais páginas", () => {
    useHistory.setState({ items: [make(1, "primeiro")], hasMore: false });
    render(<ItemGrid />);
    expect(screen.getByText("fim do histórico")).toBeDefined();
  });

  it("rola o item destacado para a área visível", () => {
    useHistory.setState({ items: [make(1, "a"), make(2, "b")], selectedIndex: 1 });
    render(<ItemGrid />);
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({ block: "nearest" });
  });

  it("no Modo 2 a grade vira região de arraste da janela", () => {
    useUi.setState({ viewMode: "modo2" });
    const { container } = render(<ItemGrid />);
    expect(container.querySelector("[data-tauri-drag-region]")).not.toBeNull();
  });
});
