import { describe, expect, it, beforeEach, beforeAll } from "vitest";

// localStorage в нашем vitest jsdom env работает нестабильно
// (--localstorage-file warning). Подменяем на in-memory реализацию
// чтобы тесты были детерминированными.
beforeAll(() => {
  const memStore: Record<string, string> = {};
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      getItem: (k: string) => memStore[k] ?? null,
      setItem: (k: string, v: string) => { memStore[k] = String(v); },
      removeItem: (k: string) => { delete memStore[k]; },
      clear: () => { for (const k of Object.keys(memStore)) delete memStore[k]; },
      key: (i: number) => Object.keys(memStore)[i] ?? null,
      get length() { return Object.keys(memStore).length; },
    },
  });
});

import {
  saveInviteDeepLink,
  getInviteDeepLink,
  removeInviteDeepLink,
  _clearInviteCache,
} from "../src/lib/inviteCache";

beforeEach(() => {
  _clearInviteCache();
});

describe("inviteCache", () => {
  it("returns null for unknown member", () => {
    expect(getInviteDeepLink(123)).toBeNull();
  });

  it("save then get returns same link", () => {
    saveInviteDeepLink(42, "https://t.me/bot?start=invite_X");
    expect(getInviteDeepLink(42)).toBe("https://t.me/bot?start=invite_X");
  });

  it("save multiple ids independently", () => {
    saveInviteDeepLink(1, "link-A");
    saveInviteDeepLink(2, "link-B");
    expect(getInviteDeepLink(1)).toBe("link-A");
    expect(getInviteDeepLink(2)).toBe("link-B");
  });

  it("save overwrites previous link for same id", () => {
    saveInviteDeepLink(7, "old");
    saveInviteDeepLink(7, "new");
    expect(getInviteDeepLink(7)).toBe("new");
  });

  it("remove deletes link", () => {
    saveInviteDeepLink(5, "link");
    removeInviteDeepLink(5);
    expect(getInviteDeepLink(5)).toBeNull();
  });

  it("remove of unknown id is no-op", () => {
    saveInviteDeepLink(1, "link-A");
    removeInviteDeepLink(999);
    expect(getInviteDeepLink(1)).toBe("link-A");
  });

  it("survives serialization (data persists across reads)", () => {
    saveInviteDeepLink(10, "persistent-link");
    // read() парсит из localStorage заново — проверяем что JSON круглит
    expect(getInviteDeepLink(10)).toBe("persistent-link");
  });
});
