import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { load } from "@tauri-apps/plugin-store";
import { listen } from "@tauri-apps/api/event";
import { ACCENT_PRESETS, useTheme } from "./useTheme";

vi.mock("@tauri-apps/plugin-store", () => ({ load: vi.fn() }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn() }));

const settings: Record<string, string | undefined> = {};

describe("useTheme", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const k of Object.keys(settings)) delete settings[k];
    document.documentElement.classList.remove("dark");
    document.documentElement.style.removeProperty("--accent-color");
    vi.mocked(load).mockResolvedValue({ get: vi.fn(async (k: string) => settings[k]) } as never);
    vi.mocked(listen).mockResolvedValue(() => {});
  });

  it("aplica o tema escuro e a cor de destaque salvos", async () => {
    settings.theme = "dark";
    settings.accent = "#ec4899";
    renderHook(() => useTheme());

    await waitFor(() => expect(document.documentElement.classList.contains("dark")).toBe(true));
    expect(document.documentElement.style.getPropertyValue("--accent-color")).toBe("#ec4899");
  });

  it("tema claro remove a classe dark", async () => {
    document.documentElement.classList.add("dark");
    settings.theme = "light";
    renderHook(() => useTheme());

    await waitFor(() => expect(document.documentElement.classList.contains("dark")).toBe(false));
  });

  it("sem configuração usa 'sistema' e o accent padrão", async () => {
    renderHook(() => useTheme());
    await waitFor(() =>
      expect(document.documentElement.style.getPropertyValue("--accent-color")).toBe(
        ACCENT_PRESETS["GNOME (Adwaita)"],
      ),
    );
    // matchMedia mockado devolve matches=false → sistema claro
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("recarrega quando a janela de configurações emite settings-changed", async () => {
    renderHook(() => useTheme());
    await waitFor(() => expect(listen).toHaveBeenCalledWith("fpaste://settings-changed", expect.any(Function)));

    settings.theme = "dark";
    settings.accent = "#10b981";
    const reload = vi.mocked(listen).mock.calls[0][1] as () => Promise<void>;
    await reload();

    await waitFor(() => expect(document.documentElement.classList.contains("dark")).toBe(true));
    expect(document.documentElement.style.getPropertyValue("--accent-color")).toBe("#10b981");
  });

  it("desfaz o listener ao desmontar", async () => {
    const unlisten = vi.fn();
    vi.mocked(listen).mockResolvedValue(unlisten);
    const { unmount } = renderHook(() => useTheme());
    await waitFor(() => expect(listen).toHaveBeenCalled());

    unmount();
    await waitFor(() => expect(unlisten).toHaveBeenCalled());
  });
});
