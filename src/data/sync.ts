import { decodePerson, encodePerson, type Person } from '../engine';

/**
 * How the team exchanges favorites. V1: codes and links, no server.
 * V2 (Supabase, for example): implement the same interface with `live: true`,
 * push on every change and pull friends' lists, then swap the instance in App.
 * Positions stay estimated from each person's plan: no live GPS tracking is shared.
 */
export interface TeamSync {
  /** True when lists refresh by themselves. */
  readonly live: boolean;
  /** What the person sends to friends (V1: a link). */
  share(me: Person, baseUrl: string): string;
  /** Reads what a friend sent. Throws a French message if unreadable. */
  receive(text: string): Person;
  /** V2: publishes my list. V1 does nothing. */
  push(me: Person): Promise<void>;
  /** V2: latest lists of the team. V1 returns nothing new. */
  pull(): Promise<Person[]>;
}

export const codeSync: TeamSync = {
  live: false,
  share: (me, baseUrl) => `${baseUrl}#ami=${encodePerson(me)}`,
  receive(text) {
    const code = text.includes('#ami=') ? text.slice(text.indexOf('#ami=') + 5) : text;
    return decodePerson(decodeURIComponent(code.trim()));
  },
  push: async () => undefined,
  pull: async () => [],
};
