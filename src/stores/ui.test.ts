import { describe, it, expect, beforeEach, vi } from "vitest";
import { load } from "@tauri-apps/plugin-store";
import { useUi } from "./ui";

const store = {
  get: vi.fn(),
  set: vi.fn().mockResolvedValue(undefined),
  save: vi.fn().mockResolvedValue(undefined),
};

vi.mock("@tauri-apps/plugin-store", () => ({
  load: vi.fn(),
}));

describe("ui store", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(load).mockResolvedValue(store as never);
    useUi.setState({ viewMode: "modo1", hydrated: false });
  });

  it("começa no Modo 1", () => {
    expect(useUi.getState().viewMode).toBe("modo1");
  });

  it("toggleViewMode alterna entre os modos e persiste no settings.json", async () => {
    useUi.getState().toggleViewMode();
    expect(useUi.getState().viewMode).toBe("modo2");
    await vi.waitFor(() => expect(store.save).toHaveBeenCalledTimes(1));
    expect(load).toHaveBeenCalledWith("settings.json");
    expect(store.set).toHaveBeenCalledWith("viewMode", "modo2");

    useUi.getState().toggleViewMode();
    expect(useUi.getState().viewMode).toBe("modo1");
    await vi.waitFor(() => expect(store.set).toHaveBeenCalledWith("viewMode", "modo1"));
  });

  it("hydrate restaura o modo salvo", async () => {
    store.get.mockResolvedValueOnce("modo2");
    await useUi.getState().hydrate();
    expect(useUi.getState().viewMode).toBe("modo2");
    expect(useUi.getState().hydrated).toBe(true);
  });

  it("hydrate ignora valores desconhecidos e volta ao Modo 1", async () => {
    store.get.mockResolvedValueOnce("qualquer-coisa");
    await useUi.getState().hydrate();
    expect(useUi.getState().viewMode).toBe("modo1");
  });

  it("hydrate só lê o store uma vez", async () => {
    store.get.mockResolvedValue("modo2");
    await useUi.getState().hydrate();
    await useUi.getState().hydrate();
    expect(load).toHaveBeenCalledTimes(1);
  });
});
