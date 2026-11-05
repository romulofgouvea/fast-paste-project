import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { invoke } from "@tauri-apps/api/core";
import { emit } from "@tauri-apps/api/event";
import { enable, disable, isEnabled } from "@tauri-apps/plugin-autostart";
import Settings from "./Settings";

const store = {
  data: {} as Record<string, unknown>,
  get: vi.fn(async (k: string) => store.data[k]),
  set: vi.fn(async (k: string, v: unknown) => {
    store.data[k] = v;
  }),
  save: vi.fn().mockResolvedValue(undefined),
};

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/event", () => ({
  emit: vi.fn().mockResolvedValue(undefined),
  listen: vi.fn().mockResolvedValue(() => {}),
}));
vi.mock("@tauri-apps/plugin-store", () => ({ load: vi.fn(async () => store) }));
vi.mock("@tauri-apps/plugin-autostart", () => ({
  enable: vi.fn().mockResolvedValue(undefined),
  disable: vi.fn().mockResolvedValue(undefined),
  isEnabled: vi.fn().mockResolvedValue(false),
}));

const invokeMock = vi.mocked(invoke);
let responses: Record<string, unknown>;

function calls(command: string) {
  return invokeMock.mock.calls.filter(([c]) => c === command);
}

function openTab(label: string) {
  fireEvent.click(screen.getByText(label));
}

function checkboxOf(text: RegExp): HTMLInputElement {
  const label = screen.getByText(text).closest("label") as HTMLLabelElement;
  return label.querySelector("input") as HTMLInputElement;
}

describe("Settings — janela e abas", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    store.data = {};
    responses = {
      get_hotkey: "CommandOrControl+Quote",
      get_auto_paste: false,
      get_storage_info: { path: "C:\\dados\\fpaste.db", dbSizeBytes: 2048, itemCount: 12 },
    };
    invokeMock.mockImplementation(async (command: string) => {
      const value = responses[command];
      if (value instanceof Error) throw value;
      return value;
    });
    vi.mocked(isEnabled).mockResolvedValue(false);
  });

  it("Escape esconde a janela de configurações", () => {
    render(<Settings />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(calls("hide_settings")).toHaveLength(1);
  });

  it("o botão ✕ esconde a janela", () => {
    render(<Settings />);
    fireEvent.click(screen.getByTitle("Fechar"));
    expect(calls("hide_settings")).toHaveLength(1);
  });

  it("alterna entre as quatro abas", () => {
    render(<Settings />);
    expect(screen.getByText("Modo de Tema")).toBeDefined();
    openTab("Geral");
    expect(screen.getByText("Atalho de Abertura")).toBeDefined();
    openTab("Armazenamento");
    expect(screen.getByText("Limpar histórico")).toBeDefined();
    openTab("Backup");
    expect(screen.getByText("Backup e Restauração")).toBeDefined();
    openTab("Aparência");
    expect(screen.getByText("Cor de Destaque")).toBeDefined();
  });
});

describe("Settings — aparência", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    store.data = {};
    invokeMock.mockResolvedValue(undefined);
  });

  it("escolher o tema grava no store e avisa a janela principal", async () => {
    render(<Settings />);
    fireEvent.click(screen.getByText("Escuro"));
    await waitFor(() => expect(emit).toHaveBeenCalledWith("fpaste://settings-changed"));
    expect(store.set).toHaveBeenCalledWith("theme", "dark");
    expect(store.save).toHaveBeenCalled();
  });

  it("cada opção de tema grava o seu valor", async () => {
    render(<Settings />);
    fireEvent.click(screen.getByText("Claro"));
    await waitFor(() => expect(store.set).toHaveBeenCalledWith("theme", "light"));
    fireEvent.click(screen.getByText("Seguir Sistema"));
    await waitFor(() => expect(store.set).toHaveBeenCalledWith("theme", "system"));
  });

  it("escolher a cor de destaque grava no store", async () => {
    render(<Settings />);
    fireEvent.click(screen.getByTitle("Rosa"));
    await waitFor(() => expect(store.set).toHaveBeenCalledWith("accent", "#ec4899"));
    expect(emit).toHaveBeenCalledWith("fpaste://settings-changed");
  });
});

describe("Settings — geral", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    store.data = {};
    responses = { get_hotkey: "CommandOrControl+Quote", get_auto_paste: false };
    invokeMock.mockImplementation(async (command: string) => {
      const value = responses[command];
      if (value instanceof Error) throw value;
      return value;
    });
    vi.mocked(isEnabled).mockResolvedValue(false);
  });

  async function renderShortcuts() {
    render(<Settings />);
    openTab("Geral");
    await screen.findByText("Ctrl + '");
  }

  it("mostra o atalho atual formatado", async () => {
    await renderShortcuts();
    expect(screen.getByText("Ctrl + '")).toBeDefined();
  });

  it("gravar um novo atalho: suspende o atual e registra o novo", async () => {
    await renderShortcuts();
    fireEvent.click(screen.getByText("Ctrl + '"));
    await waitFor(() => expect(calls("suspend_hotkey")).toHaveLength(1));
    expect(screen.getByText("Pressione a nova combinação…")).toBeDefined();

    fireEvent.keyDown(window, { key: "k", code: "KeyK", ctrlKey: true });

    await waitFor(() =>
      expect(invokeMock).toHaveBeenCalledWith("set_hotkey", { shortcut: "CommandOrControl+K" }),
    );
    expect(await screen.findByText("Ctrl + K")).toBeDefined();
    expect(calls("resume_hotkey")).toHaveLength(0);
  });

  it("modificadores aparecem em tempo real enquanto grava", async () => {
    await renderShortcuts();
    fireEvent.click(screen.getByText("Ctrl + '"));
    await waitFor(() => expect(calls("suspend_hotkey")).toHaveLength(1));
    fireEvent.keyDown(window, { key: "Control", code: "ControlLeft", ctrlKey: true });
    expect(await screen.findByText("Ctrl +")).toBeDefined();
  });

  it("Escape cancela a gravação e restaura o atalho anterior", async () => {
    await renderShortcuts();
    fireEvent.click(screen.getByText("Ctrl + '"));
    await waitFor(() => expect(calls("suspend_hotkey")).toHaveLength(1));

    fireEvent.keyDown(window, { key: "Escape" });

    await waitFor(() => expect(calls("resume_hotkey")).toHaveLength(1));
    expect(calls("set_hotkey")).toHaveLength(0);
    expect(screen.getByText("Ctrl + '")).toBeDefined();
  });

  it("combinação sem modificador é rejeitada e o atalho antigo volta", async () => {
    await renderShortcuts();
    fireEvent.click(screen.getByText("Ctrl + '"));
    await waitFor(() => expect(calls("suspend_hotkey")).toHaveLength(1));

    fireEvent.keyDown(window, { key: "k", code: "KeyK" });

    expect(await screen.findByText(/Combinação inválida/)).toBeDefined();
    await waitFor(() => expect(calls("resume_hotkey")).toHaveLength(1));
    expect(calls("set_hotkey")).toHaveLength(0);
  });

  it("atalho recusado pelo sistema mostra o erro e restaura o anterior", async () => {
    responses.set_hotkey = new Error("O sistema recusou o atalho");
    await renderShortcuts();
    fireEvent.click(screen.getByText("Ctrl + '"));
    await waitFor(() => expect(calls("suspend_hotkey")).toHaveLength(1));

    fireEvent.keyDown(window, { key: "k", code: "KeyK", ctrlKey: true });

    expect(await screen.findByText(/O sistema recusou o atalho/)).toBeDefined();
    await waitFor(() => expect(calls("resume_hotkey")).toHaveLength(1));
  });

  it("sair da aba no meio da gravação restaura o atalho", async () => {
    await renderShortcuts();
    fireEvent.click(screen.getByText("Ctrl + '"));
    await waitFor(() => expect(calls("suspend_hotkey")).toHaveLength(1));

    openTab("Aparência");

    await waitFor(() => expect(calls("resume_hotkey")).toHaveLength(1));
  });

  it("colar automaticamente liga e desliga no backend", async () => {
    await renderShortcuts();
    const box = checkboxOf(/Após selecionar um item/);
    fireEvent.click(box);
    await waitFor(() => expect(invokeMock).toHaveBeenCalledWith("set_auto_paste", { enabled: true }));
    fireEvent.click(box);
    await waitFor(() => expect(invokeMock).toHaveBeenCalledWith("set_auto_paste", { enabled: false }));
  });

  it("iniciar com o sistema chama enable e disable do plugin", async () => {
    await renderShortcuts();
    const box = checkboxOf(/Abre o FPaste em segundo plano/);
    fireEvent.click(box);
    await waitFor(() => expect(enable).toHaveBeenCalledTimes(1));
    fireEvent.click(box);
    await waitFor(() => expect(disable).toHaveBeenCalledTimes(1));
  });

  it("abrir centralizado grava no store", async () => {
    await renderShortcuts();
    fireEvent.click(checkboxOf(/Abre a janela do FPaste centralizada/));
    await waitFor(() => expect(store.set).toHaveBeenCalledWith("openCentered", true));
    expect(store.save).toHaveBeenCalled();
  });

  it("carrega os valores salvos nos checkboxes", async () => {
    responses.get_auto_paste = true;
    vi.mocked(isEnabled).mockResolvedValue(true);
    store.data.openCentered = true;
    await renderShortcuts();
    await waitFor(() => expect(checkboxOf(/Após selecionar um item/).checked).toBe(true));
    await waitFor(() => expect(checkboxOf(/Abre o FPaste em segundo plano/).checked).toBe(true));
    await waitFor(() => expect(checkboxOf(/Abre a janela do FPaste centralizada/).checked).toBe(true));
  });
});

describe("Settings — armazenamento", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    responses = { get_storage_info: { path: "C:\\dados\\fpaste.db", dbSizeBytes: 2048, itemCount: 12 } };
    invokeMock.mockImplementation(async (command: string) => responses[command]);
  });

  it("mostra caminho, tamanho e quantidade de itens", async () => {
    render(<Settings />);
    openTab("Armazenamento");
    expect(await screen.findByText("C:\\dados\\fpaste.db")).toBeDefined();
    expect(screen.getByText("2.0 KB")).toBeDefined();
    expect(screen.getByText("12")).toBeDefined();
  });

  it("limpar histórico pede confirmação e depois apaga e recarrega", async () => {
    render(<Settings />);
    openTab("Armazenamento");
    await screen.findByText("12");

    fireEvent.click(screen.getByText("Limpar histórico"));
    expect(screen.getByText("Apagar todo o histórico?")).toBeDefined();
    expect(calls("clear_history")).toHaveLength(0);

    responses.get_storage_info = { path: "C:\\dados\\fpaste.db", dbSizeBytes: 512, itemCount: 0 };
    fireEvent.click(screen.getByText("Sim, apagar"));

    await waitFor(() => expect(calls("clear_history")).toHaveLength(1));
    expect(await screen.findByText("0")).toBeDefined();
    expect(screen.getByText("Limpar histórico")).toBeDefined();
  });

  it("cancelar a confirmação não apaga nada", async () => {
    render(<Settings />);
    openTab("Armazenamento");
    await screen.findByText("12");

    fireEvent.click(screen.getByText("Limpar histórico"));
    fireEvent.click(screen.getByText("Cancelar"));

    expect(calls("clear_history")).toHaveLength(0);
    expect(screen.getByText("Limpar histórico")).toBeDefined();
  });
});

describe("Settings — backup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    responses = {};
    invokeMock.mockImplementation(async (command: string) => {
      const value = responses[command];
      if (value instanceof Error) throw value;
      return value;
    });
  });

  function passwordField() {
    return screen.getByPlaceholderText("Deixe em branco para não proteger") as HTMLInputElement;
  }

  it("gerar backup sem senha manda password null e mostra o caminho", async () => {
    responses.export_backup = "C:\\bk\\fpaste-backup.zip";
    render(<Settings />);
    openTab("Backup");

    fireEvent.click(screen.getByText("Gerar Backup"));

    expect(await screen.findByText("Backup salvo em C:\\bk\\fpaste-backup.zip")).toBeDefined();
    expect(invokeMock).toHaveBeenCalledWith("export_backup", { password: null });
  });

  it("gerar backup com senha repassa a senha", async () => {
    responses.export_backup = "C:\\bk\\x.zip";
    render(<Settings />);
    openTab("Backup");

    fireEvent.change(passwordField(), { target: { value: "segredo" } });
    fireEvent.click(screen.getByText("Gerar Backup"));

    await screen.findByText(/Backup salvo em/);
    expect(invokeMock).toHaveBeenCalledWith("export_backup", { password: "segredo" });
  });

  it("importar backup mostra o resumo", async () => {
    responses.import_backup = { imported: 3, skipped: 1 };
    render(<Settings />);
    openTab("Backup");

    fireEvent.click(screen.getByText("Importar Backup"));

    expect(
      await screen.findByText("Importação concluída — 3 novo(s) item(ns), 1 já existiam."),
    ).toBeDefined();
    expect(invokeMock).toHaveBeenCalledWith("import_backup", { password: null });
  });

  it("senha errada na importação mostra o erro do backend", async () => {
    responses.import_backup = "backup inválido ou senha incorreta";
    invokeMock.mockImplementation(async (command: string) => {
      if (command === "import_backup") throw "backup inválido ou senha incorreta";
      return undefined;
    });
    render(<Settings />);
    openTab("Backup");

    fireEvent.change(passwordField(), { target: { value: "errada" } });
    fireEvent.click(screen.getByText("Importar Backup"));

    const message = await screen.findByText("backup inválido ou senha incorreta");
    expect(message.className).toContain("text-red-500");
  });

  it("falha na exportação mostra o erro", async () => {
    invokeMock.mockImplementation(async (command: string) => {
      if (command === "export_backup") throw "Exportação cancelada";
      return undefined;
    });
    render(<Settings />);
    openTab("Backup");

    fireEvent.click(screen.getByText("Gerar Backup"));

    expect(await screen.findByText("Exportação cancelada")).toBeDefined();
  });

  it("os botões ficam desabilitados enquanto o backup roda", async () => {
    let finish: (value: string) => void = () => {};
    invokeMock.mockImplementation(
      (command: string) =>
        (command === "export_backup"
          ? new Promise<string>((resolve) => {
              finish = resolve;
            })
          : Promise.resolve(undefined)) as Promise<never>,
    );
    render(<Settings />);
    openTab("Backup");

    fireEvent.click(screen.getByText("Gerar Backup"));

    await waitFor(() => expect((screen.getByText("Importar Backup") as HTMLButtonElement).disabled).toBe(true));
    expect((screen.getByText("Gerar Backup") as HTMLButtonElement).disabled).toBe(true);

    finish("C:\\bk\\x.zip");
    await screen.findByText(/Backup salvo em/);
    expect((screen.getByText("Importar Backup") as HTMLButtonElement).disabled).toBe(false);
  });

  it("o campo de senha é do tipo password", () => {
    render(<Settings />);
    openTab("Backup");
    expect(passwordField().type).toBe("password");
    expect(within(document.body).getByText("Senha do backup (opcional)")).toBeDefined();
  });
});
