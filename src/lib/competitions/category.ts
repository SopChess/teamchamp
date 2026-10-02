export type TournamentCategory = "a_ethniki" | "topiko" | "kypello" | "mathitiko" | "other";

export const TOURNAMENT_CATEGORIES: TournamentCategory[] = ["a_ethniki", "topiko", "kypello", "mathitiko", "other"];

export const CATEGORY_LABEL: Record<TournamentCategory, string> = {
  a_ethniki: "Α΄ Εθνική",
  topiko: "Τοπικό",
  kypello: "Κύπελλο",
  mathitiko: "Μαθητικό",
  other: "Άλλο",
};

export function isTournamentCategory(value: string): value is TournamentCategory {
  return (TOURNAMENT_CATEGORIES as string[]).includes(value);
}
