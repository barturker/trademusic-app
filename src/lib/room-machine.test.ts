import { describe, it, expect } from "vitest";

import { canTransition, transition, getNextStates, isTerminal, canCancel } from "./room-machine";

import type { RoomStatus } from "@/types/room";

const ALL_STATUSES: RoomStatus[] = [
  "created",
  "waiting_for_peer",
  "processing",
  "ready_for_review",
  "a_approved",
  "b_approved",
  "completed",
  "cancelled",
  "disputed",
  "expired",
];

describe("room-machine", () => {
  describe("canTransition", () => {
    const validPairs: [RoomStatus, RoomStatus][] = [
      ["created", "waiting_for_peer"],
      ["created", "cancelled"],
      ["created", "expired"],
      ["waiting_for_peer", "processing"],
      ["waiting_for_peer", "cancelled"],
      ["waiting_for_peer", "expired"],
      ["processing", "ready_for_review"],
      ["processing", "cancelled"],
      ["processing", "expired"],
      ["ready_for_review", "a_approved"],
      ["ready_for_review", "b_approved"],
      ["ready_for_review", "cancelled"],
      ["ready_for_review", "disputed"],
      ["ready_for_review", "expired"],
      ["a_approved", "completed"],
      ["a_approved", "cancelled"],
      ["a_approved", "expired"],
      ["b_approved", "completed"],
      ["b_approved", "cancelled"],
      ["b_approved", "expired"],
      ["completed", "expired"],
      ["disputed", "cancelled"],
      ["disputed", "expired"],
    ];

    it.each(validPairs)("allows %s -> %s", (from, to) => {
      expect(canTransition(from, to)).toBe(true);
    });

    const invalidPairs: [RoomStatus, RoomStatus][] = [
      ["created", "processing"],
      ["created", "completed"],
      ["waiting_for_peer", "created"],
      ["waiting_for_peer", "ready_for_review"],
      ["processing", "waiting_for_peer"],
      ["processing", "completed"],
      ["ready_for_review", "processing"],
      ["ready_for_review", "completed"],
      ["a_approved", "b_approved"],
      ["b_approved", "a_approved"],
      ["completed", "cancelled"],
      ["completed", "created"],
      ["cancelled", "created"],
      ["cancelled", "completed"],
      ["cancelled", "expired"],
      ["expired", "created"],
      ["expired", "completed"],
      ["disputed", "completed"],
      ["disputed", "ready_for_review"],
    ];

    it.each(invalidPairs)("rejects %s -> %s", (from, to) => {
      expect(canTransition(from, to)).toBe(false);
    });

    it("rejects self-transitions for all states", () => {
      for (const status of ALL_STATUSES) {
        expect(canTransition(status, status)).toBe(false);
      }
    });
  });

  describe("transition", () => {
    it("returns the target status for valid transitions", () => {
      expect(transition("created", "waiting_for_peer")).toBe("waiting_for_peer");
      expect(transition("a_approved", "completed")).toBe("completed");
    });

    it("returns null for invalid transitions", () => {
      expect(transition("created", "completed")).toBeNull();
      expect(transition("cancelled", "created")).toBeNull();
    });
  });

  describe("getNextStates", () => {
    it("returns valid next states for created", () => {
      const next = getNextStates("created");
      expect(next).toEqual(["waiting_for_peer", "cancelled", "expired"]);
    });

    it("returns valid next states for ready_for_review", () => {
      const next = getNextStates("ready_for_review");
      expect(next).toEqual(["a_approved", "b_approved", "cancelled", "disputed", "expired"]);
    });

    it("returns empty array for terminal states", () => {
      expect(getNextStates("cancelled")).toEqual([]);
      expect(getNextStates("expired")).toEqual([]);
    });

    it("returns only expired for completed", () => {
      expect(getNextStates("completed")).toEqual(["expired"]);
    });
  });

  describe("isTerminal", () => {
    it("returns true for cancelled and expired", () => {
      expect(isTerminal("cancelled")).toBe(true);
      expect(isTerminal("expired")).toBe(true);
    });

    it("returns false for non-terminal states", () => {
      const nonTerminal: RoomStatus[] = [
        "created",
        "waiting_for_peer",
        "processing",
        "ready_for_review",
        "a_approved",
        "b_approved",
        "completed",
        "disputed",
      ];
      for (const status of nonTerminal) {
        expect(isTerminal(status)).toBe(false);
      }
    });
  });

  describe("canCancel", () => {
    it("returns true for states that allow cancellation", () => {
      const cancellable: RoomStatus[] = [
        "created",
        "waiting_for_peer",
        "processing",
        "ready_for_review",
        "a_approved",
        "b_approved",
        "disputed",
      ];
      for (const status of cancellable) {
        expect(canCancel(status)).toBe(true);
      }
    });

    it("returns false for states that do not allow cancellation", () => {
      expect(canCancel("completed")).toBe(false);
      expect(canCancel("cancelled")).toBe(false);
      expect(canCancel("expired")).toBe(false);
    });
  });
});
