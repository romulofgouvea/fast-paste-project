import { describe, it, expect, beforeEach, vi } from "vitest";
import { useHistory } from "./history";
import { deleteItem, getHistory, togglePin, type ClipItem } from "../lib/api";

vi.mock("../lib/api", () => ({
  getHistory: vi.fn(),
  deleteItem: vi.fn(),
  togglePin: vi.fn(),
}));

const getHistoryMock = vi.mocked(getHistory);

function make(id: number, over: Partial<ClipItem> = {}): ClipItem {
  return {
    id,
    type: "text",
    preview: null,
    content: `item ${id}`,
    pinned: false,
    timestamp: id,
    hasMedia: false,
    groupId: null,
    ...over,
  };
}

const initial = {
  items: [],
  page: 0,
  hasMore: true,
  isLoading: false,
  rawQuery: "",
  groupFilter: null,
  selectedIndex: 0,
};

describe("history store — ações", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useHistory.setState(initial);
    getHistoryMock.mockResolvedValue({ items: [make(1), make(2)], hasMore: true });
  });

  it("refresh carrega a página 0, avança o cursor e zera a seleção", async () => {
    useHistory.setState({ selectedIndex: 5 });
    await useHistory.getState().refresh();

    const s = useHistory.getState();
    expect(getHistoryMock).toHaveBeenCalledWith(0, "", undefined, undefined);
    expect(s.items.map((i) => i.id)).toEqual([1, 2]);
    expect(s.page).toBe(1);
    expect(s.hasMore).toBe(true);
    expect(s.selectedIndex).toBe(0);
    expect(s.isLoading).toBe(false);
  });

  it("refresh libera isLoading mesmo quando a busca falha", async () => {
    getHistoryMock.mockRejectedValueOnce(new Error("falhou"));
    await expect(useHistory.getState().refresh()).rejects.toThrow("falhou");
    expect(useHistory.getState().isLoading).toBe(false);
  });

  it("setQuery extrai o filtro de tipo e reinicia a paginação", async () => {
    useHistory.setState({ page: 3, hasMore: false });
    useHistory.getState().setQuery("tipo:link github");

    expect(useHistory.getState().rawQuery).toBe("tipo:link github");
    expect(useHistory.getState().page).toBe(0);
    await vi.waitFor(() =>
      expect(getHistoryMock).toHaveBeenCalledWith(0, "github", "link", undefined),
    );
  });

  it("setGroupFilter filtra por grupo e volta ao início", async () => {
    useHistory.getState().setGroupFilter(4);
    expect(useHistory.getState().groupFilter).toBe(4);
    await vi.waitFor(() =>
      expect(getHistoryMock).toHaveBeenCalledWith(0, "", undefined, 4),
    );
  });

  it("setGroupFilter(null) limpa o filtro", async () => {
    useHistory.setState({ groupFilter: 4 });
    useHistory.getState().setGroupFilter(null);
    await vi.waitFor(() =>
      expect(getHistoryMock).toHaveBeenCalledWith(0, "", undefined, undefined),
    );
    expect(useHistory.getState().groupFilter).toBeNull();
  });

  it("loadMore acrescenta a próxima página", async () => {
    useHistory.setState({ items: [make(1), make(2)], page: 1, hasMore: true });
    getHistoryMock.mockResolvedValueOnce({ items: [make(3)], hasMore: false });

    await useHistory.getState().loadMore();

    const s = useHistory.getState();
    expect(getHistoryMock).toHaveBeenCalledWith(1, "", undefined, undefined);
    expect(s.items.map((i) => i.id)).toEqual([1, 2, 3]);
    expect(s.page).toBe(2);
    expect(s.hasMore).toBe(false);
  });

  it("loadMore não faz nada sem mais páginas", async () => {
    useHistory.setState({ hasMore: false });
    await useHistory.getState().loadMore();
    expect(getHistoryMock).not.toHaveBeenCalled();
  });

  it("loadMore não dispara requisições concorrentes", async () => {
    useHistory.setState({ isLoading: true });
    await useHistory.getState().loadMore();
    expect(getHistoryMock).not.toHaveBeenCalled();
  });

  it("remove apaga no backend e tira o item da lista", async () => {
    useHistory.setState({ items: [make(1), make(2), make(3)] });
    await useHistory.getState().remove(2);

    expect(deleteItem).toHaveBeenCalledWith(2);
    expect(useHistory.getState().items.map((i) => i.id)).toEqual([1, 3]);
  });

  it("remove mantém o item na lista se o backend falhar", async () => {
    useHistory.setState({ items: [make(1)] });
    vi.mocked(deleteItem).mockRejectedValueOnce(new Error("erro"));
    await expect(useHistory.getState().remove(1)).rejects.toThrow("erro");
    expect(useHistory.getState().items).toHaveLength(1);
  });

  it("togglePinned atualiza o item e coloca os fixados no topo", async () => {
    useHistory.setState({ items: [make(3), make(2), make(1)] });
    vi.mocked(togglePin).mockResolvedValueOnce(true);

    await useHistory.getState().togglePinned(1);

    const items = useHistory.getState().items;
    expect(togglePin).toHaveBeenCalledWith(1);
    expect(items.map((i) => i.id)).toEqual([1, 3, 2]);
    expect(items[0].pinned).toBe(true);
  });

  it("togglePinned usa o valor devolvido pelo backend ao desafixar", async () => {
    useHistory.setState({ items: [make(1, { pinned: true }), make(2)] });
    vi.mocked(togglePin).mockResolvedValueOnce(false);

    await useHistory.getState().togglePinned(1);

    expect(useHistory.getState().items.find((i) => i.id === 1)?.pinned).toBe(false);
  });

  it("setSelectedIndex define o item destacado", () => {
    useHistory.getState().setSelectedIndex(7);
    expect(useHistory.getState().selectedIndex).toBe(7);
  });
});
