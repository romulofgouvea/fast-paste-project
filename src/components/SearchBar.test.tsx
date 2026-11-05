import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SearchBar } from "./SearchBar";
import { useHistory } from "../stores/history";

vi.mock("../lib/api", () => ({
  getHistory: vi.fn(),
  deleteItem: vi.fn(),
  togglePin: vi.fn(),
}));
vi.mock("@tauri-apps/plugin-store", () => ({ load: vi.fn() }));

describe("SearchBar", () => {
  const setQuery = vi.fn();

  beforeEach(() => {
    setQuery.mockClear();
    useHistory.setState({ rawQuery: "", setQuery });
  });

  it("digitar envia o texto para o store", () => {
    render(<SearchBar />);
    fireEvent.change(screen.getByPlaceholderText(/Buscar/), { target: { value: "tipo:link foo" } });
    expect(setQuery).toHaveBeenCalledWith("tipo:link foo");
  });

  it("não mostra o botão de limpar com a busca vazia", () => {
    render(<SearchBar />);
    expect(screen.queryByText("✕")).toBeNull();
  });

  it("o botão de limpar zera a busca", () => {
    useHistory.setState({ rawQuery: "abc" });
    render(<SearchBar />);
    fireEvent.click(screen.getByText("✕"));
    expect(setQuery).toHaveBeenCalledWith("");
  });

  it("mostra o valor atual da busca", () => {
    useHistory.setState({ rawQuery: "abc" });
    render(<SearchBar />);
    expect((screen.getByPlaceholderText(/Buscar/) as HTMLInputElement).value).toBe("abc");
  });
});
