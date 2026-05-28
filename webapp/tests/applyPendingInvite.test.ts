import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@corpmeet/design/complex", () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
}));

import { apiClient } from "@corpmeet/design/complex";
import { applyPendingInvite, parseInviteParams } from "../src/lib/applyPendingInvite";

function setLocationSearch(search: string) {
  const path = search ? "?" + search : window.location.pathname;
  window.history.replaceState({}, "", path);
}

beforeEach(() => {
  vi.mocked(apiClient.post).mockReset();
  setLocationSearch("");
});

describe("parseInviteParams", () => {
  it("returns nulls when no params", () => {
    setLocationSearch("");
    expect(parseInviteParams()).toEqual({ inviteToken: null, wsCode: null });
  });

  it("reads invite_token from URL", () => {
    setLocationSearch("invite_token=ABC123");
    expect(parseInviteParams()).toEqual({ inviteToken: "ABC123", wsCode: null });
  });

  it("reads ws_code from URL", () => {
    setLocationSearch("ws_code=XYZ789");
    expect(parseInviteParams()).toEqual({ inviteToken: null, wsCode: "XYZ789" });
  });
});

describe("applyPendingInvite", () => {
  it("no-op when no params", async () => {
    setLocationSearch("");
    await applyPendingInvite();
    expect(apiClient.post).not.toHaveBeenCalled();
  });

  it("calls /workspaces/claim-invite with invite_token", async () => {
    setLocationSearch("invite_token=ABC123");
    vi.mocked(apiClient.post).mockResolvedValue({ data: {} });

    await applyPendingInvite();

    expect(apiClient.post).toHaveBeenCalledWith(
      "/api/v1/workspaces/claim-invite",
      { invite_token: "ABC123" },
    );
  });

  it("calls /workspaces/join with ws_code", async () => {
    setLocationSearch("ws_code=XYZ789");
    vi.mocked(apiClient.post).mockResolvedValue({ data: {} });

    await applyPendingInvite();

    expect(apiClient.post).toHaveBeenCalledWith(
      "/api/v1/workspaces/join",
      { invite_code: "XYZ789" },
    );
  });

  it("invite_token takes priority over ws_code", async () => {
    setLocationSearch("invite_token=ABC&ws_code=XYZ");
    vi.mocked(apiClient.post).mockResolvedValue({ data: {} });

    await applyPendingInvite();

    expect(apiClient.post).toHaveBeenCalledTimes(1);
    expect(apiClient.post).toHaveBeenCalledWith(
      "/api/v1/workspaces/claim-invite",
      { invite_token: "ABC" },
    );
  });

  it("silently swallows API errors", async () => {
    setLocationSearch("invite_token=BADTOKEN");
    vi.mocked(apiClient.post).mockRejectedValue(new Error("422"));

    await expect(applyPendingInvite()).resolves.toBeUndefined();
  });

  it("clears params from URL after attempt", async () => {
    setLocationSearch("invite_token=ABC&other=keep");
    vi.mocked(apiClient.post).mockResolvedValue({ data: {} });

    await applyPendingInvite();

    expect(window.location.search).toBe("?other=keep");
  });

  it("clears params even on API error", async () => {
    setLocationSearch("invite_token=BAD");
    vi.mocked(apiClient.post).mockRejectedValue(new Error("fail"));

    await applyPendingInvite();

    expect(window.location.search).toBe("");
  });
});
