import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, fireEvent, waitFor, act } from "@testing-library/react";
import { listen } from "@tauri-apps/api/event";
import App from "./App";
import { useHistory } from "./stores/history";
import { useUi } from "./stores/ui";
import { getHistory, hideWindow, selectItem, type ClipItem } from "./lib/api";

vi.mock("./lib/api", () => ({
  getHistory: vi.fn(),
  hideWindow: vi.fn().mockResolvedValue(undefined),
  selectItem: vi.fn().mockResolvedValue(undefined),
  listGroups: vi.fn().mockResolvedValue([]),
  deleteItem: vi.fn(),
  togglePin: vi.fn(),
  pasteText: vi.fn(),
  setItemGroup: vi.fn(),
  getThumbnail: vi.fn(),
  openSettings: vi.fn(),
}));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn() }));
vi.mock("@tauri-apps/plugin-store", () => ({
  load: vi.fn().mockResolvedValue({
    get: vi.fn().mockResolvedValue(undefined),
    set: vi.fn(),
    save: vi.fn(),
  }),
}));

function make(id: number): ClipItem {
  return { id, type: "text", content: `item ${id}`, preview: null, pinned: false, timestamp: id, hasMedia: false, groupId: null };
}

type Handler = () => void;

describe("App — atalhos e eventos da janela principal", () => {
  const handlers = new Map<string, Handler>();

  beforeEach(() => {
    vi.clearAllMocks();
    handlers.clear();
    vi.mocked(listen).mockImplementation(async (name, cb) => {
      handlers.set(name as string, cb as unknown as Handler);
      return () => {};
    });
    vi.mocked(getHistory).mockResolvedValue({ items: [make(1), make(2), make(3)], hasMore: false });
    useUi.setState({ viewMode: "modo1", hydrated: true });
    useHistory.setState({ items: [], page: 0, hasMore: true, isLoading: false, rawQuery: "", groupFilter: null, selectedIndex: 0 });
  });

  afterEach(() => vi.useRealTimers());

  async function mount() {
    const view = render(<App />);
    await waitFor(() => expect(useHistory.getState().items).toHaveLength(3));
    return view;
  }

  it("carrega o histórico ao abrir", async () => {
    await mount();
    expect(getHistory).toHaveBeenCalledWith(0, "", undefined, undefined);
  });

  it("Escape esconde a janela", async () => {
    await mount();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(hideWindow).toHaveBeenCalled();
  });

  it("setas navegam pela lista", async () => {
    await mount();
    fireEvent.keyDown(window, { key: "ArrowDown" });
    expect(useHistory.getState().selectedIndex).toBe(1);
    fireEvent.keyDown(window, { key: "ArrowDown" });
    fireEvent.keyDown(window, { key: "ArrowDown" });
    expect(useHistory.getState().selectedIndex).toBe(2);
    fireEvent.keyDown(window, { key: "ArrowUp" });
    expect(useHistory.getState().selectedIndex).toBe(1);
  });

  it("Enter cola o item destacado", async () => {
    await mount();
    fireEvent.keyDown(window, { key: "ArrowDown" });
    fireEvent.keyDown(window, { key: "Enter" });
    expect(selectItem).toHaveBeenCalledWith(2);
  });

  it("Enter sem itens não cola nada", async () => {
    vi.mocked(getHistory).mockResolvedValue({ items: [], hasMore: false });
    render(<App />);
    await waitFor(() => expect(getHistory).toHaveBeenCalled());
    fireEvent.keyDown(window, { key: "Enter" });
    expect(selectItem).not.toHaveBeenCalled();
  });

  it("evento clipboard://new-item recarrega a lista", async () => {
    await mount();
    vi.mocked(getHistory).mockClear();
    await act(async () => handlers.get("clipboard://new-item")?.());
    expect(getHistory).toHaveBeenCalledWith(0, "", undefined, undefined);
  });

  it("evento fpaste://opened limpa a busca", async () => {
    await mount();
    useHistory.setState({ rawQuery: "algo" });
    await act(async () => handlers.get("fpaste://opened")?.());
    expect(useHistory.getState().rawQuery).toBe("");
  });

  it("Modo 1: perder o foco esconde a janela depois do período de graça", async () => {
    await mount();
    await act(async () => handlers.get("fpaste://opened")?.());
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 1000);
    fireEvent.blur(window);
    expect(hideWindow).toHaveBeenCalled();
  });

  it("Modo 1: blur logo depois de abrir é ignorado", async () => {
    await mount();
    await act(async () => handlers.get("fpaste://opened")?.());
    fireEvent.blur(window);
    expect(hideWindow).not.toHaveBeenCalled();
  });

  it("Modo 2: perder o foco não esconde a janela", async () => {
    useUi.setState({ viewMode: "modo2" });
    await mount();
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 5000);
    fireEvent.blur(window);
    expect(hideWindow).not.toHaveBeenCalled();
  });

  it("remove os listeners ao desmontar", async () => {
    const { unmount } = await mount();
    unmount();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(hideWindow).not.toHaveBeenCalled();
  });
});
