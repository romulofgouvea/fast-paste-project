import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { openSettings } from "./api";
import { openSettingsWindow, registerBlurSuppressor } from "./settingsWindow";

vi.mock("./api", () => ({
  openSettings: vi.fn().mockResolvedValue(undefined),
}));

describe("settingsWindow", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(openSettings).mockClear();
  });
  afterEach(() => vi.useRealTimers());

  it("suprime o blur por 800 ms antes de abrir a janela de configurações", async () => {
    const suppress = vi.fn();
    const unregister = registerBlurSuppressor(suppress);

    const opening = openSettingsWindow();
    expect(suppress).toHaveBeenCalledWith(800);
    expect(openSettings).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(60);
    await opening;
    expect(openSettings).toHaveBeenCalledTimes(1);
    unregister();
  });

  it("abre normalmente sem supressor registrado", async () => {
    const opening = openSettingsWindow();
    await vi.advanceTimersByTimeAsync(60);
    await opening;
    expect(openSettings).toHaveBeenCalledTimes(1);
  });

  it("depois de cancelar o registro o supressor não é mais chamado", async () => {
    const suppress = vi.fn();
    registerBlurSuppressor(suppress)();

    const opening = openSettingsWindow();
    await vi.advanceTimersByTimeAsync(60);
    await opening;
    expect(suppress).not.toHaveBeenCalled();
  });

  it("cancelar um registro antigo não remove o supressor mais novo", async () => {
    const first = vi.fn();
    const second = vi.fn();
    const unregisterFirst = registerBlurSuppressor(first);
    const unregisterSecond = registerBlurSuppressor(second);
    unregisterFirst();

    const opening = openSettingsWindow();
    await vi.advanceTimersByTimeAsync(60);
    await opening;
    expect(second).toHaveBeenCalledWith(800);
    expect(first).not.toHaveBeenCalled();
    unregisterSecond();
  });
});
