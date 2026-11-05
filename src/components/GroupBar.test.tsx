import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { GroupBar } from "./GroupBar";
import { useHistory } from "../stores/history";
import { listGroups } from "../lib/api";

vi.mock("../lib/api", () => ({
  listGroups: vi.fn(),
  getHistory: vi.fn(),
  deleteItem: vi.fn(),
  togglePin: vi.fn(),
}));
vi.mock("@tauri-apps/plugin-store", () => ({ load: vi.fn() }));

describe("GroupBar", () => {
  const setGroupFilter = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    useHistory.setState({ groupFilter: null, setGroupFilter });
  });

  it("não renderiza nada quando não há grupos", async () => {
    vi.mocked(listGroups).mockResolvedValue([]);
    const { container } = render(<GroupBar />);
    await waitFor(() => expect(listGroups).toHaveBeenCalled());
    expect(container.firstChild).toBeNull();
  });

  it("lista 'Tudo' e os grupos", async () => {
    vi.mocked(listGroups).mockResolvedValue([
      { id: 1, name: "Trabalho" },
      { id: 2, name: "Casa" },
    ]);
    render(<GroupBar />);
    expect(await screen.findByText("Trabalho")).toBeDefined();
    expect(screen.getByText("Casa")).toBeDefined();
    expect(screen.getByText("Tudo")).toBeDefined();
  });

  it("clicar em um grupo filtra por ele", async () => {
    vi.mocked(listGroups).mockResolvedValue([{ id: 7, name: "Trabalho" }]);
    render(<GroupBar />);
    fireEvent.click(await screen.findByText("Trabalho"));
    expect(setGroupFilter).toHaveBeenCalledWith(7);
  });

  it("clicar em 'Tudo' remove o filtro", async () => {
    useHistory.setState({ groupFilter: 7 });
    vi.mocked(listGroups).mockResolvedValue([{ id: 7, name: "Trabalho" }]);
    render(<GroupBar />);
    fireEvent.click(await screen.findByText("Tudo"));
    expect(setGroupFilter).toHaveBeenCalledWith(null);
  });
});
