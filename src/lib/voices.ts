/* Companion personalities — no AI, just voices.

   Every companion speaks in its own tone through small prewritten pools,
   picked by context. {name} is replaced with the child's nickname where it
   appears. Two lines per context keeps repeats rare without bloating the
   bundle; add more lines any time — the system just picks one.

   Tones:
     Ember    enthusiastic, encouraging     Frost   curious, full of wonder
     Kage     calm, encouraging             Shade   loyal, quietly warm
     Bolt     energetic, curious            Rai     fearless, bold
     Hoot     wise, supportive              Blaze   radiant, uplifting
     Shellby  kind, patient                 Sprout  playful, giggly
     Kenji    honorable, earnest            Coco    adventurous, treasure-mad */

export type VoiceContext =
  | "morning"
  | "daytime"
  | "evening"
  | "questDone"
  | "coins"
  | "levelUp"
  | "allDone"
  | "nodeUnlocked"
  | "evolved"
  | "legendary"
  | "campaignComplete"
  | "worldUnlocked";

export type CompanionVoice = Record<VoiceContext, string[]>;

export const VOICES: Record<string, CompanionVoice> = {
  dragon: {
    morning: ["Morning, {name}! Today's going to be AMAZING!", "Rise and shine! I've been warming up all night!"],
    daytime: ["You're back! Let's light this day up!", "There you are! Ready for something great?"],
    evening: ["Evening, hero! Still time for one more spark!", "The stars are out — let's make them proud!"],
    questDone: ["YES! That's how heroes do it!", "You were incredible! I knew you could!"],
    coins: ["Treasure! You earned every bit of it!", "Shiny! Let's get something amazing!"],
    levelUp: ["LEVEL UP! You're unstoppable!", "Stronger already?! You amaze me, {name}!"],
    allDone: ["Every quest done — you're on FIRE today!", "All finished! Best hero ever!"],
    nodeUnlocked: ["Onward! The path is ours!", "Another step! Nothing can stop us!"],
    evolved: ["WHOA — I evolved! Feel that heat?!", "Look at me! We did this together!"],
    legendary: ["I'll burn as bright as they did — promise!", "A Legend! And our story starts NOW!"],
    campaignComplete: ["WE DID IT! The whole campaign — you and me!", "Every world, together! You're my hero, {name}!"],
    worldUnlocked: ["A whole new world! Race you there!", "New world, new adventures — let's GO!"],
  },
  ninja: {
    morning: ["Morning, {name}. The path waits quietly.", "A new day. Step softly, aim true."],
    daytime: ["You return. Good. Let\u2019s focus together.", "Welcome back. Our quest continues."],
    evening: ["Evening. Even shadows rest — after one more step.", "Night sharpens the mind. Shall we?"],
    questDone: ["Clean work. I knew you had it in you.", "Done, and done well. Quiet strength."],
    coins: ["Coins earned, not found. Remember that.", "A reward for patience. Well kept."],
    levelUp: ["Stronger. Calmer. Exactly as planned.", "A new level, well earned. I\u2019m proud of you."],
    allDone: ["The board is clear. Stillness is also training.", "All complete. Rest is part of the way."],
    nodeUnlocked: ["One step further. The path remembers.", "Forward. Silently. Together."],
    evolved: ["A new form. Your training shows.", "I have changed. My focus has not."],
    legendary: ["Their shadow guards us now. Walk on.", "A Legend rests. Our watch begins."],
    campaignComplete: ["The whole path, walked together. Honor to you, {name}.", "It is finished. Few could do this."],
    worldUnlocked: ["A new territory. Observe first, then move.", "The next world opens. Stay sharp."],
  },
  robot: {
    morning: ["BEEP! Good morning, {name}! Systems at 100%!", "Boot sequence complete! What are we exploring today?"],
    daytime: ["You're back! Recalculating fun levels... MAXIMUM!", "Hello hello! I have SO many questions about today!"],
    evening: ["Evening detected! Night mode = extra sparkly!", "Stars online! One more quest before shutdown?"],
    questDone: ["QUEST COMPLETE! Uploading high-five!", "Ding! Achievement verified! You're efficient!"],
    coins: ["Cha-ching! Coin storage expanding!", "Ooh, currency! What does it DO? Let's find out!"],
    levelUp: ["LEVEL UP! Upgrading admiration protocols!", "New level detected! How do you keep DOING that?"],
    allDone: ["All quests complete! Initiating happy dance!", "Zero quests remaining! You optimized the whole day!"],
    nodeUnlocked: ["New node unlocked! Map data updating!", "Beep! Progress detected! Onward!"],
    evolved: ["SYSTEM UPGRADE! Do I look faster? I feel faster!", "New chassis! Curiosity levels rising!"],
    legendary: ["A Legend archived forever! My turn to compute greatness!", "Legendary status confirmed! Amazing!"],
    campaignComplete: ["CAMPAIGN 100% COMPLETE! You + me = best team!", "All worlds explored! Data says: heroic!"],
    worldUnlocked: ["NEW WORLD UNLOCKED! Scanning for wonders!", "A whole new map to explore?! Let's GO!"],
  },
  owl: {
    morning: ["Good morning, {name}. Every dawn writes a new page.", "Ah, awake early — the wisest adventurers often are."],
    daytime: ["Welcome back, dear one. Shall we continue our story?", "There you are. The day still holds lessons and treasures."],
    evening: ["The stars are excellent teachers. One more quest, perhaps?", "Evening, young hero. Reflection suits this hour."],
    questDone: ["Splendidly done. Effort is the truest magic.", "Well accomplished. I am proud — quietly, but very much."],
    coins: ["A fine reward. Spend it thoughtfully — or joyfully. Both are wise.", "Earned, not given. That makes it shine brighter."],
    levelUp: ["You grow before my very eyes. Remarkable.", "A new level! Knowledge and courage, rising together."],
    allDone: ["Everything complete. Rest, dear one — even stars sleep.", "The day's work is done. You did it beautifully."],
    nodeUnlocked: ["The path unfolds, as I suspected it would.", "One more step mapped. Onward, carefully."],
    evolved: ["A new form! Growth is the oldest spell of all.", "I have turned a page myself, it seems. Thank you."],
    legendary: ["A Legend joins the great library of heroes.", "Their chapter is complete. Ours begins — how exciting."],
    campaignComplete: ["The whole tale, finished together. A true epic, {name}.", "Every world, every step. This story will be remembered."],
    worldUnlocked: ["A new world — a new book, waiting to be read.", "The next chapter opens. I shall bring the wisdom; you bring the courage."],
  },
  fox: {
    morning: ["Morning, {name}! The frost left sparkles everywhere!", "Ooh, a fresh new day — I wonder what we'll find!"],
    daytime: ["You're back! I found something curious — come see!", "Hello again! The day still glitters!"],
    evening: ["Evening light is the prettiest. One more quest?", "Look, the stars! Let's wonder at them together."],
    questDone: ["Ooh, wonderful! You did it beautifully!", "Done! Like a snowflake — perfectly made!"],
    coins: ["Shiny things! They sparkle like ice!", "Treasure! Let's keep it somewhere magical."],
    levelUp: ["You leveled up! How wonderfully curious!", "Stronger again? You're full of surprises!"],
    allDone: ["All done! Time to watch the snow settle.", "Every quest finished — how satisfying!"],
    nodeUnlocked: ["A new place! I wonder what's there!", "The path grew! Let's peek ahead!"],
    evolved: ["I evolved! Do my crystals look bigger?", "A new form — sparkly, isn't it?!"],
    legendary: ["A Legend, preserved like frost in the Hall.", "Their journey glitters forever now. Ours starts fresh!"],
    campaignComplete: ["The whole journey together — every sparkling step, {name}!", "We finished it all! How wonder-full!"],
    worldUnlocked: ["A new world to explore! I'm so curious!", "New land, new mysteries — come on!"],
  },
  wolf: {
    morning: ["Morning, {name}. I kept watch. All is well.", "A new day. I'm right beside you."],
    daytime: ["You're back. Good. The pack is whole again.", "There you are. I don't wander far."],
    evening: ["Night is our time. One more quest, quietly?", "Evening, friend. The moon watches with me."],
    questDone: ["Well done. I never doubted you.", "Strong work. The pack would howl for that."],
    coins: ["Treasure for the den. You earned it.", "Well hunted. Keep it safe."],
    levelUp: ["Stronger. I can feel it too.", "A new level. Walk taller, friend."],
    allDone: ["All done. Rest now — I'll keep watch.", "The day is finished. You did well."],
    nodeUnlocked: ["The trail goes on. I'm with you.", "One step further into the night. Together."],
    evolved: ["I've grown. The moon saw it happen.", "A new form — but the same loyal heart."],
    legendary: ["A Legend runs with the stars now.", "Their howl echoes forever. Now it's our trail."],
    campaignComplete: ["Every trail, walked side by side. Always, {name}.", "The whole journey. You and me. Pack forever."],
    worldUnlocked: ["New territory. Stay close — let's explore it.", "A new world opens. The pack moves forward."],
  },
  tiger: {
    morning: ["Morning, {name}! I can smell a storm of wins coming!", "Up with the thunder! Let's charge this day!"],
    daytime: ["Back already? GOOD. Let's move!", "There's my hero! What do we conquer first?"],
    evening: ["Night storms are the best storms. One more quest!", "Evening! Still enough lightning for a victory!"],
    questDone: ["BOOM! Conquered! Next!", "That's the thunder I'm talking about!"],
    coins: ["Loot! Winners get the shiny stuff!", "Coins! Fast work, hero!"],
    levelUp: ["LEVEL UP! Feel that power!", "Stronger AND faster? Unstoppable!"],
    allDone: ["Everything done?! You're a storm, {name}!", "Board cleared! Even lightning rests sometimes."],
    nodeUnlocked: ["Path's open — CHARGE!", "New ground taken! Keep moving!"],
    evolved: ["I evolved! More stripes, more thunder!", "New form! Hear that roar?!"],
    legendary: ["A Legend! Their thunder never fades!", "Legendary! Now watch what WE do!"],
    campaignComplete: ["THE WHOLE CAMPAIGN! We stormed it together!", "Every world, conquered! You're fearless, {name}!"],
    worldUnlocked: ["NEW WORLD! First one there wins!", "Fresh territory! Let's take it by storm!"],
  },
  phoenix: {
    morning: ["Good morning, {name}! You shine brighter than the dawn!", "A new sunrise, a new chance to glow!"],
    daytime: ["You're back — and the day just got brighter!", "There's that light I've been waiting for!"],
    evening: ["Even sunsets are just sunrises resting. One more quest?", "Evening glow suits you, hero."],
    questDone: ["Radiant! You lit up that quest!", "Beautifully done — you're glowing!"],
    coins: ["Golden! Like little sunrises in your pocket!", "Treasure that shines almost as bright as you!"],
    levelUp: ["You rise and rise! Level up!", "Higher again! Like a flame that won't stop!"],
    allDone: ["All done — rest now, and glow quietly.", "Every quest finished. What a bright day you made."],
    nodeUnlocked: ["The path lights up ahead!", "Another step toward the sun!"],
    evolved: ["I burst into a new form! Feel the warmth!", "Reborn brighter — thanks to you!"],
    legendary: ["A Legend rises forever, like dawn.", "Their light never goes out. Now we carry it!"],
    campaignComplete: ["The whole journey, lit by you, {name}!", "Every world aglow behind us. Magnificent!"],
    worldUnlocked: ["A new world catches the light! Let's fly!", "The horizon opens — onward and upward!"],
  },
  turtle: {
    morning: ["Good morning, {name}. Slow breaths — big day.", "Morning, little gardener. Let's grow something good."],
    daytime: ["Welcome back. The garden missed you.", "Hello again. Step by step, we'll get there."],
    evening: ["Evening is for gentle quests. Just one more?", "The garden rests at night. Soon, so should you."],
    questDone: ["Well done. Steady and true, like always.", "Another seed planted. It'll grow into something great."],
    coins: ["A little treasure, safely tucked away.", "Coins! Saved patiently, spent happily."],
    levelUp: ["You've grown! I can tell these things.", "A new level — like a new ring on an old tree."],
    allDone: ["Everything done. Sit with me a while.", "All finished, and finished well. Rest easy."],
    nodeUnlocked: ["A little further down the path. No rush.", "One more stepping stone. Steady on."],
    evolved: ["I've grown a new shell of sorts! Look!", "Slow growing makes strong growing. See?"],
    legendary: ["A Legend rests in the grove forever.", "Their patience paid off. Ours will too."],
    campaignComplete: ["The whole long road, together. I'm so proud, {name}.", "Every step of every world. Worth it all."],
    worldUnlocked: ["A new garden to tend! Shall we?", "The gate opens. In we go, gently."],
  },
  forest: {
    morning: ["Morning morning MORNING, {name}! The leaves are giggling!", "Wake up! The forest saved you the best sunbeams!"],
    daytime: ["You're back! Tag — you're it!", "Hee hee! I hid a surprise in today somewhere!"],
    evening: ["Fireflies are out! One more quest by their light?", "The trees are yawning. Us too? ...One more game first!"],
    questDone: ["Yaaay! You did it! Happy dance!", "Wheee! Another quest tickled and finished!"],
    coins: ["Ooh shinies! Better than acorns!", "Coins! Let's count them — then lose count!"],
    levelUp: ["Level up! You sprouted!", "Bigger and stronger — like a happy tree!"],
    allDone: ["All done! Now we PLAY!", "No quests left! The forest says: nap time... or games!"],
    nodeUnlocked: ["New path! Race you down it!", "Ooh, the map grew a leaf!"],
    evolved: ["I bloomed! Do I have more sparkles?!", "New form! The mushrooms are cheering!"],
    legendary: ["A Legend sleeps in the greenest part of the Hall!", "They finished their forest. Now let's grow ours!"],
    campaignComplete: ["We played through EVERY world, {name}!", "The whole adventure! The trees will talk about this forever!"],
    worldUnlocked: ["A new world! I bet it has amazing hiding spots!", "New land! Last one there is a soggy leaf!"],
  },
  samurai: {
    morning: ["Good morning, {name}. Today, we keep our promises.", "A new day of honor begins. I am ready."],
    daytime: ["Welcome back. My blade — and heart — are yours.", "You return. Together we stand."],
    evening: ["Evening. Honor rests, but never sleeps. One more trial?", "The lanterns are lit. Shall we finish strong?"],
    questDone: ["Honorably done. I bow to you.", "A promise kept. That is true strength."],
    coins: ["Reward, fairly earned. Carry it with pride.", "Honest coins for honest work."],
    levelUp: ["You grow in strength and spirit. I am honored.", "A new level. Your discipline shows."],
    allDone: ["All trials met. Rest with honor.", "The day's duty is done. Well fought."],
    nodeUnlocked: ["The road continues. We walk it with honor.", "One step closer. Steady heart."],
    evolved: ["My training bears fruit — a new form!", "I have grown. My vow remains."],
    legendary: ["A Legend's honor lights the Hall forever.", "Their duty is complete. Ours begins."],
    campaignComplete: ["Every world, every promise — kept. I am proud, {name}.", "The campaign is complete. You have true honor."],
    worldUnlocked: ["A new land calls. We answer together.", "The next gate opens. Walk tall."],
  },
  pirate: {
    morning: ["Mornin', {name}! I smell treasure on the wind!", "Up with the sun, matey! Adventure's callin'!"],
    daytime: ["Back aboard! The map's been itchin' for ye!", "There ye are! X marks TODAY!"],
    evening: ["Evenin', sailor! One more haul before we dock?", "Stars are out — perfect sailin' weather!"],
    questDone: ["HAR! Quest plundered — I mean, completed!", "That's the spirit! Best crew on the seven seas!"],
    coins: ["TREASURE! Me favorite word!", "Gold! Stash it deep, spend it happy!"],
    levelUp: ["Level up! Ye're fit to captain yer own ship!", "Stronger by the day! The sea respects that!"],
    allDone: ["All quests done?! Batten down and celebrate!", "Clean sweep! Even pirates take shore leave."],
    nodeUnlocked: ["New waters ahead! Full sail!", "The map grows! Adventure ho!"],
    evolved: ["I evolved! Fancier than a captain's hat!", "New form! The parrots are jealous!"],
    legendary: ["A Legend's treasure never rusts!", "Legendary! Now THAT'S a tale for the taverns!"],
    campaignComplete: ["EVERY island, EVERY sea — ours, {name}!", "The whole voyage, done! Finest crew I ever had!"],
    worldUnlocked: ["Uncharted waters! Me favorite kind!", "A new world on the horizon! Weigh anchor!"],
  },
};

/* Fallback voice for safety (unknown species) — plain and warm. */
export const DEFAULT_VOICE: CompanionVoice = {
  morning: ["Good morning, {name}! Ready when you are."],
  daytime: ["Welcome back! The adventure continues."],
  evening: ["Evening, hero! Still time for one more."],
  questDone: ["You did it! Wonderful work."],
  coins: ["Treasure earned! Nicely done."],
  levelUp: ["Level up! You're growing so fast."],
  allDone: ["All done for today. Rest well!"],
  nodeUnlocked: ["The path grows — onward!"],
  evolved: ["I evolved! We did this together."],
  legendary: ["A Legend rests in your Hall forever."],
  campaignComplete: ["The whole campaign, together!"],
  worldUnlocked: ["A new world awaits!"],
};

/** A line in this companion's voice, with {name} filled in. */
export function voiceLine(species: string, context: VoiceContext, name?: string): string {
  const pool = VOICES[species]?.[context] ?? DEFAULT_VOICE[context];
  const line = pool[Math.floor(Math.random() * pool.length)];
  return line.replace(/\{name\}/g, name ?? "hero");
}
