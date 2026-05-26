import { describe, expect, it } from "vitest";
import type {
  Room,
  WorkspaceRoom,
} from "@corpmeet/design/complex";
import {
  filterActiveRoomsInWorkspace,
  sortRoomsByName,
} from "../src/lib/room-filter";

function makeRoom(over: Partial<Room> = {}): Room {
  return {
    id: 1,
    name: "Переговорная",
    description: null,
    invite_code: null,
    join_mode: "open",
    archived_at: null,
    created_at: "2026-05-26T10:00:00+05:00",
    ...over,
  };
}

function makeWR(over: Partial<WorkspaceRoom> & { room?: Partial<Room> } = {}): WorkspaceRoom {
  const { room: roomOver, ...rest } = over;
  return {
    id: 100,
    workspace_id: 10,
    room: makeRoom(roomOver),
    role: "owner",
    visibility: "full",
    created_at: "2026-05-26T10:00:00+05:00",
    ...rest,
  };
}

describe("filterActiveRoomsInWorkspace", () => {
  it("returns only rooms of given workspace", () => {
    const a = makeWR({ id: 1, workspace_id: 10 });
    const b = makeWR({ id: 2, workspace_id: 20 });
    const c = makeWR({ id: 3, workspace_id: 10 });
    expect(filterActiveRoomsInWorkspace([a, b, c], 10).map((wr) => wr.id)).toEqual([1, 3]);
  });

  it("excludes archived rooms", () => {
    const active = makeWR({ id: 1, workspace_id: 10 });
    const archived = makeWR({
      id: 2,
      workspace_id: 10,
      room: { archived_at: "2026-05-20T10:00:00+05:00" },
    });
    expect(filterActiveRoomsInWorkspace([active, archived], 10).map((wr) => wr.id)).toEqual([1]);
  });

  it("returns empty when workspaceId === null", () => {
    const wr = makeWR({ workspace_id: 10 });
    expect(filterActiveRoomsInWorkspace([wr], null)).toEqual([]);
  });

  it("returns empty when no room matches workspace", () => {
    const wr = makeWR({ workspace_id: 10 });
    expect(filterActiveRoomsInWorkspace([wr], 999)).toEqual([]);
  });

  it("returns empty for empty input", () => {
    expect(filterActiveRoomsInWorkspace([], 10)).toEqual([]);
  });

  it("does not mutate input", () => {
    const wrs = [makeWR({ id: 1, workspace_id: 10 }), makeWR({ id: 2, workspace_id: 20 })];
    filterActiveRoomsInWorkspace(wrs, 10);
    expect(wrs.map((wr) => wr.id)).toEqual([1, 2]);
  });
});

describe("sortRoomsByName", () => {
  it("sorts alphabetically by room.name", () => {
    const wrs = [
      makeWR({ id: 1, room: { name: "Большая" } }),
      makeWR({ id: 2, room: { name: "Аквариум" } }),
      makeWR({ id: 3, room: { name: "Венера" } }),
    ];
    expect(sortRoomsByName(wrs).map((wr) => wr.room.name)).toEqual([
      "Аквариум",
      "Большая",
      "Венера",
    ]);
  });

  it("does not mutate input", () => {
    const wrs = [
      makeWR({ id: 1, room: { name: "Б" } }),
      makeWR({ id: 2, room: { name: "А" } }),
    ];
    const before = wrs.map((wr) => wr.id);
    sortRoomsByName(wrs);
    expect(wrs.map((wr) => wr.id)).toEqual(before);
  });
});
