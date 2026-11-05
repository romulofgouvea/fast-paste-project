import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import { LazyThumb } from "./LazyThumb";
import { getThumbnail } from "../../lib/api";
import { MockIntersectionObserver } from "../../setupTests";

vi.mock("../../lib/api", () => ({ getThumbnail: vi.fn() }));

describe("LazyThumb", () => {
  beforeEach(() => vi.clearAllMocks());

  it("não pede a miniatura enquanto está fora da tela", () => {
    render(<LazyThumb id={5} />);
    expect(getThumbnail).not.toHaveBeenCalled();
    expect(screen.getByText("🖼️")).toBeDefined();
  });

  it("ao entrar na área visível busca e mostra a miniatura", async () => {
    vi.mocked(getThumbnail).mockResolvedValue("data:image/png;base64,AAAA");
    const onLoad = vi.fn();
    const { container } = render(<LazyThumb id={5} onLoad={onLoad} />);

    act(() => MockIntersectionObserver.instances[0].trigger(true));

    await waitFor(() => expect(container.querySelector("img")).not.toBeNull());
    expect(getThumbnail).toHaveBeenCalledWith(5);
    expect(container.querySelector("img")?.getAttribute("src")).toBe("data:image/png;base64,AAAA");
    expect(onLoad).toHaveBeenCalledWith("data:image/png;base64,AAAA");
  });

  it("para de observar depois da primeira interseção", () => {
    vi.mocked(getThumbnail).mockResolvedValue("data:image/png;base64,AAAA");
    render(<LazyThumb id={5} />);
    const observer = MockIntersectionObserver.instances[0];
    act(() => observer.trigger(true));
    expect(observer.disconnected).toBe(true);
  });

  it("mostra o aviso se a miniatura falhar", async () => {
    vi.mocked(getThumbnail).mockRejectedValue(new Error("falhou"));
    render(<LazyThumb id={5} />);
    act(() => MockIntersectionObserver.instances[0].trigger(true));
    expect(await screen.findByText("⚠️")).toBeDefined();
  });
});
