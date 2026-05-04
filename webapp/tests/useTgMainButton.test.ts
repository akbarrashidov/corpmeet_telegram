import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useTgMainButton } from "../src/hooks/useTgMainButton";

function mockTg() {
  const main = {
    show: vi.fn(),
    hide: vi.fn(),
    setText: vi.fn(),
    onClick: vi.fn(),
    offClick: vi.fn(),
    enable: vi.fn(),
    disable: vi.fn(),
  };
  (window as any).Telegram = {
    WebApp: {
      platform: "ios",
      initData: "",
      MainButton: main,
      BackButton: {},
      HapticFeedback: {},
      ready: () => {},
      expand: () => {},
      close: () => {},
      openLink: () => {},
    },
  };
  return main;
}

describe("useTgMainButton", () => {
  beforeEach(() => {
    delete (window as any).Telegram;
  });
  afterEach(() => {
    delete (window as any).Telegram;
  });

  it("no-op when not in Telegram", () => {
    const { unmount } = renderHook(() =>
      useTgMainButton({ text: "X", onClick: vi.fn() })
    );
    expect(() => unmount()).not.toThrow();
  });

  it("sets text, shows, subscribes onClick", () => {
    const main = mockTg();
    const onClick = vi.fn();
    renderHook(() => useTgMainButton({ text: "Создать", onClick }));

    expect(main.setText).toHaveBeenCalledWith("Создать");
    expect(main.show).toHaveBeenCalled();
    expect(main.onClick).toHaveBeenCalled();
  });

  it("hides when visible=false", () => {
    const main = mockTg();
    renderHook(() =>
      useTgMainButton({ text: "X", onClick: vi.fn(), visible: false })
    );
    expect(main.hide).toHaveBeenCalled();
    expect(main.show).not.toHaveBeenCalled();
  });

  it("disable() when disabled=true", () => {
    const main = mockTg();
    renderHook(() =>
      useTgMainButton({ text: "X", onClick: vi.fn(), disabled: true })
    );
    expect(main.disable).toHaveBeenCalled();
  });

  it("calls offClick + hide on unmount", () => {
    const main = mockTg();
    const { unmount } = renderHook(() =>
      useTgMainButton({ text: "X", onClick: vi.fn() })
    );
    unmount();
    expect(main.offClick).toHaveBeenCalled();
    expect(main.hide).toHaveBeenCalled();
  });

  it("invokes the latest onClick when MainButton fires", () => {
    const main = mockTg();
    let captured: (() => void) | null = null;
    main.onClick.mockImplementation((cb: () => void) => {
      captured = cb;
    });
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = renderHook(
      ({ cb }) => useTgMainButton({ text: "X", onClick: cb }),
      { initialProps: { cb: first } }
    );
    rerender({ cb: second });
    captured!();
    expect(second).toHaveBeenCalled();
    expect(first).not.toHaveBeenCalled();
  });
});
