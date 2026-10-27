/** React Query keys in one place, shared by the server prefetch and the client hooks. */
export const searchKeys = {
  view: (id: string) => ["searches", id] as const,
  usage: ["usage"] as const,
};
