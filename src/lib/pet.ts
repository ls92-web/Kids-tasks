import { Profile, Task, PetMood, petForm, petAccessories } from "./game";

/* Derive the pet's emotional state from the hero's real situation and the
   time of day. Never sad — the lowest state is a hopeful "let's do this". */
export function petMood(
  profile: Profile,
  tasks: Task[],
  opts: { celebrating?: boolean } = {}
): PetMood {
  if (opts.celebrating) return "cheer";
  const hour = new Date().getHours();
  if (hour >= 20 || hour < 6) return "sleepy";
  const today = new Date().toDateString();
  const doneToday = tasks.some(
    (t) => t.status === "completed" && new Date(t.created_at).toDateString() === today
  );
  if (doneToday) return "proud";
  if (profile.streak_days > 0) return "happy";
  return "excited";
}

export function petGear(heroLevel: number): string[] {
  return petAccessories(petForm(heroLevel).index);
}

export function petMoodLabel(mood: PetMood): string {
  return {
    excited: "ready for adventure",
    happy: "happy",
    proud: "so proud of you",
    sleepy: "getting sleepy",
    cheer: "cheering for you",
  }[mood];
}
