/**
 * The sim's view of the game database. The data loader fills the real tables;
 * this core only needs the hash the version stamp mixes in.
 */
export interface GameDatabase {
  readonly dataHash: number;
}

export const EMPTY_GAME_DATABASE: GameDatabase = { dataHash: 0 };
