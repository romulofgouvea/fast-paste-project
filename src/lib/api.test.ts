import { describe, it, expect, vi, beforeEach } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import * as api from "./api";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockResolvedValue(undefined),
}));

const invokeMock = vi.mocked(invoke);

describe("api — cada ação do front-end chama o comando Rust certo", () => {
  beforeEach(() => {
    invokeMock.mockClear();
  });

  it("getHistory manda página, tamanho fixo e normaliza filtros vazios para null", async () => {
    await api.getHistory(2, "", "", undefined);
    expect(invokeMock).toHaveBeenCalledWith("get_history", {
      page: 2,
      pageSize: api.PAGE_SIZE,
      query: null,
      typeFilter: null,
      groupId: null,
    });
  });

  it("getHistory repassa busca, tipo e grupo", async () => {
    await api.getHistory(0, "foo", "link", 7);
    expect(invokeMock).toHaveBeenCalledWith("get_history", {
      page: 0,
      pageSize: api.PAGE_SIZE,
      query: "foo",
      typeFilter: "link",
      groupId: 7,
    });
  });

  it("getHistory preserva groupId 0 (grupo válido, não 'sem grupo')", async () => {
    await api.getHistory(0, undefined, undefined, 0);
    expect(invokeMock).toHaveBeenCalledWith(
      "get_history",
      expect.objectContaining({ groupId: 0 }),
    );
  });

  const simple: [string, () => Promise<unknown>, string, Record<string, unknown> | undefined][] = [
    ["selectItem", () => api.selectItem(5), "select_item", { id: 5 }],
    ["pasteText", () => api.pasteText("abc"), "paste_text", { text: "abc" }],
    ["deleteItem", () => api.deleteItem(9), "delete_item", { id: 9 }],
    ["hideWindow", () => api.hideWindow(), "hide_window", undefined],
    ["setHotkey", () => api.setHotkey("CommandOrControl+K"), "set_hotkey", { shortcut: "CommandOrControl+K" }],
    ["getHotkey", () => api.getHotkey(), "get_hotkey", undefined],
    ["suspendHotkey", () => api.suspendHotkey(), "suspend_hotkey", undefined],
    ["resumeHotkey", () => api.resumeHotkey(), "resume_hotkey", undefined],
    ["getThumbnail", () => api.getThumbnail(3), "get_thumbnail", { id: 3 }],
    ["togglePin", () => api.togglePin(4), "toggle_pin", { id: 4 }],
    ["listGroups", () => api.listGroups(), "list_groups", undefined],
    ["createGroup", () => api.createGroup("Trabalho"), "create_group", { name: "Trabalho" }],
    ["deleteGroup", () => api.deleteGroup(2), "delete_group", { id: 2 }],
    ["setItemGroup (com grupo)", () => api.setItemGroup(1, 2), "set_item_group", { id: 1, groupId: 2 }],
    ["setItemGroup (sem grupo)", () => api.setItemGroup(1, null), "set_item_group", { id: 1, groupId: null }],
    ["setAutoPaste", () => api.setAutoPaste(true), "set_auto_paste", { enabled: true }],
    ["getAutoPaste", () => api.getAutoPaste(), "get_auto_paste", undefined],
    ["openSettings", () => api.openSettings(), "open_settings", undefined],
    ["openLinuxKeyboardSettings", () => api.openLinuxKeyboardSettings(), "open_linux_keyboard_settings", undefined],
    ["macosAccessibilityTrusted", () => api.macosAccessibilityTrusted(), "macos_accessibility_trusted", undefined],
    ["openMacosAccessibilitySettings", () => api.openMacosAccessibilitySettings(), "open_macos_accessibility_settings", undefined],
    ["hideSettings", () => api.hideSettings(), "hide_settings", undefined],
  ];

  it.each(simple)("%s → %s", async (_name, call, command, args) => {
    await call();
    if (args === undefined) {
      expect(invokeMock).toHaveBeenCalledWith(command);
    } else {
      expect(invokeMock).toHaveBeenCalledWith(command, args);
    }
  });

  it("exportBackup sem senha manda null (zip sem proteção)", async () => {
    await api.exportBackup();
    expect(invokeMock).toHaveBeenCalledWith("export_backup", { password: null });
  });

  it("exportBackup trata senha vazia como ausente", async () => {
    await api.exportBackup("");
    expect(invokeMock).toHaveBeenCalledWith("export_backup", { password: null });
  });

  it("exportBackup/importBackup repassam a senha informada", async () => {
    await api.exportBackup("segredo");
    await api.importBackup("segredo");
    expect(invokeMock).toHaveBeenNthCalledWith(1, "export_backup", { password: "segredo" });
    expect(invokeMock).toHaveBeenNthCalledWith(2, "import_backup", { password: "segredo" });
  });

  it("importBackup sem senha manda null", async () => {
    await api.importBackup();
    expect(invokeMock).toHaveBeenCalledWith("import_backup", { password: null });
  });

  it("propaga o erro do backend para quem chamou", async () => {
    invokeMock.mockRejectedValueOnce("backup inválido ou senha incorreta");
    await expect(api.importBackup("x")).rejects.toBe("backup inválido ou senha incorreta");
  });
});
