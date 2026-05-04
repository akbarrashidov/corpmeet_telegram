import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useTgBackButton } from "../src/hooks/useTgBackButton";

function mockTg() {
  const back = {
    show: vi.fn(),
    hide: vi.fn(),
    onClick: vi.fn(),
    offClick: vi.fn(),
  };
  (window as any).Telegram = {
    WebApp: {
      platform: "ios",
      initData: "",
      MainButton: {},
      BackButton: back,
      HapticFeedback: {},
      ready: () => {},
      expand: () => {},
      close: () => {},
      openLink: () => {},
    },
  };
  return back;
}

describe("useTgBackButton", () => {
  beforeEach(() => {
    delete (window as any).Telegram;
  });
  afterEach(() => {
    delete (window as any).Telegram;
  });

  it("no-op outside Telegram", () => {
    expect(() => renderHook(() => useTgBackButton(vi.fn()))).not.toThrow();
  });

  it("shows and subscribes when callback provided", () => {
    const back = mockTg();
    renderHook(() => useTgBackButton(vi.fn()));
    expect(back.show).toHaveBeenCalled();
    expect(back.onClick).toHaveBeenCalled();
  });

  it("hides when callback is null", () => {
    const back = mockTg();
    renderHook(() => useTgBackButton(null));
    expect(back.hide).toHaveBeenCalled();
    expect(back.show).not.toHaveBeenCalled();
  });

  it("calls offClick + hide on unmount", () => {
    const back = mockTg();
    const { unmount } = renderHook(() => useTgBackButton(vi.fn()));
    unmount();
    expect(back.offClick).toHaveBeenCalled();
    expect(back.hide).toHaveBeenCalled();
  });
});
