export const uploadKeys = {
  all: ["uploads"] as const,
  room: (roomId: string) => ["uploads", roomId] as const,
};
