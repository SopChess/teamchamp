export type TournamentFormat = "swiss" | "round_robin" | "knockout" | "groups";

export const TOURNAMENT_FORMATS: TournamentFormat[] = ["swiss", "round_robin", "knockout", "groups"];

export const FORMAT_LABEL: Record<TournamentFormat, string> = {
  swiss: "Ελβετικό",
  round_robin: "Round Robin (όλοι με όλους)",
  knockout: "Νοκ-άουτ",
  groups: "Όμιλοι",
};

export function isTournamentFormat(value: string): value is TournamentFormat {
  return (TOURNAMENT_FORMATS as string[]).includes(value);
}
