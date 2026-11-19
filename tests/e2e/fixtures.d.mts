export interface Fixture {
  title: string;
  html: string;
}
export declare const FIXTURES: Record<string, Fixture>;
export declare function fixtureFor(url: string): Fixture | null;
