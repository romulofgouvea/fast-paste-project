import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ContextMenu, type MenuAction } from "./ContextMenu";

function setup(actions: MenuAction[]) {
  const onClose = vi.fn();
  render(
    <div>
      <button>fora</button>
      <ContextMenu x={10} y={20} actions={actions} onClose={onClose} />
    </div>,
  );
  return onClose;
}

describe("ContextMenu", () => {
  it("renderiza uma entrada por ação", () => {
    setup([
      { label: "Fixar", onClick: vi.fn() },
      { label: "Excluir", onClick: vi.fn(), danger: true, divider: true },
    ]);
    expect(screen.getByText("Fixar")).toBeDefined();
    expect(screen.getByText("Excluir")).toBeDefined();
  });

  it("clicar executa a ação e fecha o menu", () => {
    const onClick = vi.fn();
    const onClose = setup([{ label: "Fixar", onClick }]);
    fireEvent.click(screen.getByText("Fixar"));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("Escape fecha o menu sem executar ações", () => {
    const onClick = vi.fn();
    const onClose = setup([{ label: "Fixar", onClick }]);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("clique fora fecha o menu", () => {
    const onClose = setup([{ label: "Fixar", onClick: vi.fn() }]);
    fireEvent.mouseDown(screen.getByText("fora"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("clique dentro do menu não o fecha por conta própria", () => {
    const onClose = setup([{ label: "Fixar", onClick: vi.fn() }]);
    const menu = screen.getByText("Fixar").parentElement as HTMLElement;
    fireEvent.mouseDown(menu);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("outras teclas não fecham o menu", () => {
    const onClose = setup([{ label: "Fixar", onClick: vi.fn() }]);
    fireEvent.keyDown(window, { key: "a" });
    expect(onClose).not.toHaveBeenCalled();
  });
});
