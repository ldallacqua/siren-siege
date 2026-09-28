import type { ChatEpisode, ChatNode } from './types.ts';

// Branching chats. Each node either continues (`next`), offers two choices,
// or ends. Choices award bond XP (affection). Tone: flirty, teasing, adult,
// suggestive — never explicit. The player is "Commander".

type N = ChatNode;
const her = (id: string, text: string, next?: string, mood?: string): N => ({ id, speaker: 'her', text, next, mood });
const nar = (id: string, text: string, next?: string): N => ({ id, speaker: 'narration', text, next });
const pick = (id: string, text: string, a: [string, string, number], b: [string, string, number], mood?: string): N => ({
  id,
  speaker: 'her',
  text,
  mood,
  choices: [
    { text: a[0], next: a[1], affection: a[2] },
    { text: b[0], next: b[1], affection: b[2] },
  ],
});
const end = (id: string, text: string, mood?: string): N => ({ id, speaker: 'her', text, mood, end: true });

export const EPISODES: ChatEpisode[] = [
  // ---------------------------------------------------------------- Scarlet
  {
    id: 'scarlet-1',
    heroine: 'scarlet',
    title: 'A Toast at Midnight',
    level: 1,
    start: 'a',
    nodes: [
      nar('a', 'The barracks are quiet. Scarlet sits on the windowsill, spinning a revolver around one gloved finger.', 'b'),
      her('b', "Commander. You're up late. Couldn't sleep, or came looking for me?", 'c', 'tease'),
      pick('c', 'Careful how you answer. I can hear a heartbeat change from across the room.', ["Honestly? I came looking for you.", 'd', 30], ['Just checking the perimeter.', 'e', 10], 'tease'),
      her('d', 'Mm. Honest. I like that in a mortal. It makes you so much easier to read.', 'f', 'smile'),
      her('e', "The perimeter. Of course. And the perimeter happens to be my window. How convenient.", 'f', 'smirk'),
      pick('f', 'Four hundred years, and I still enjoy a good drink with good company. Will you join me?', ['Only if it is wine.', 'g', 20], ["Depends. Whose blood is it?", 'h', 30]),
      her('g', 'A classic. Very well, Commander, wine for you. Something redder for me.', 'z', 'smile'),
      her('h', 'Ha! You have teeth after all. Relax, darling. I only bite people I like.', 'z', 'laugh'),
      end('z', "...And you're starting to make the list. Go to sleep before I change my mind about letting you leave.", 'wink'),
    ],
  },
  {
    id: 'scarlet-2',
    heroine: 'scarlet',
    title: 'Silver and Lace',
    level: 3,
    start: 'a',
    nodes: [
      nar('a', 'Scarlet is polishing her silver rounds at the armory table, her coat draped over the chair.', 'b'),
      her('b', "Silver bullets. Ironic, isn't it? The one thing that could kill me, and I carry it on my hips.", 'c'),
      pick('c', 'Does that frighten you, Commander? Standing this close to something so dangerous?', ['Dangerous is my type.', 'd', 30], ["I trust you.", 'e', 25], 'tease'),
      her('d', 'Oh? Then you picked the right army to command.', 'f', 'smirk'),
      her('e', "Trust. That's a heavier thing to hand me than any gun.", 'f', 'blush'),
      pick('f', "Here — hold it. Feel the weight. Closer, you're holding it like a teacup.", ['Guide my hands, then.', 'g', 30], ['Like this?', 'h', 15]),
      her('g', "Bold. ...Fine. Shoulders back. Breathe out. And stop staring at me instead of the target.", 'z', 'blush'),
      her('h', "Better. You'll never be as good as me, but you'll look very handsome failing.", 'z', 'laugh'),
      end('z', "Keep the round. Consider it a promise that I'll always come back to you.", 'smile'),
    ],
  },
  // ---------------------------------------------------------------- Yuki
  {
    id: 'yuki-1',
    heroine: 'yuki',
    title: 'Frost on the Glass',
    level: 1,
    start: 'a',
    nodes: [
      nar('a', 'Snow drifts through an open door. Yuki is standing outside in far too little clothing for the weather.', 'b'),
      her('b', '...Oh. Commander. You found my hiding spot.', 'c', 'shy'),
      pick('c', "Aren't you cold? ...That's a silly question. Sorry. People ask me that a lot.", ['I was worried about you, not the cold.', 'd', 30], ['You look good in the snow.', 'e', 25], 'shy'),
      her('d', 'Worried... about me? That is... a warm thing to say. Too warm.', 'f', 'blush'),
      her('e', "Y-you shouldn't say things like that so easily. The snow might melt.", 'f', 'blush'),
      pick('f', 'Your hands are freezing. Here, let me see them.', ['Hold them for as long as you like.', 'g', 30], ["Won't that make them colder?", 'h', 10]),
      her('g', "...Humans are strange. Your hands are so hot. I think I could get used to it.", 'z', 'smile'),
      her('h', "Mm. Probably. I just... wanted an excuse. Forget it.", 'z', 'pout'),
      end('z', "Goodnight, Commander. If you dream of snow tonight, that one was me.", 'smile'),
    ],
  },
  {
    id: 'yuki-2',
    heroine: 'yuki',
    title: 'Hot Spring Rules',
    level: 3,
    start: 'a',
    nodes: [
      nar('a', 'Steam rises from the shrine hot spring. Yuki sits at the edge, only her feet in the water, wrapped in a thin towel.', 'b'),
      her('b', "Don't laugh. I've never been in hot water before. It seems... dangerous. For me.", 'c', 'shy'),
      pick('c', "Kaede says it's relaxing. Will you... stay nearby? In case I melt?", ["I'll be right here.", 'd', 30], ['I promise to catch you if you do.', 'e', 30], 'shy'),
      her('d', "Right here. Okay. Don't move. And don't look. ...Okay, you can look a little.", 'f', 'blush'),
      her('e', "Catch me? You'd get very wet. ...I think I'd like to see that.", 'f', 'tease'),
      pick('f', "It's warm. It's actually... nice. Commander, is this what it feels like, being near you?", ["Something like that.", 'g', 25], ["Only you can answer that.", 'h', 30]),
      her('g', "Then I understand why everyone likes you so much. It's unfair.", 'z', 'smile'),
      her('h', "...Then my answer is yes. Don't make me say it twice. My face is already steaming.", 'z', 'blush'),
      end('z', 'Next time... you get in too. That is an order from your ice witch.', 'wink'),
    ],
  },
  // ---------------------------------------------------------------- Kaede
  {
    id: 'kaede-1',
    heroine: 'kaede',
    title: 'Festival Drinks',
    level: 1,
    start: 'a',
    nodes: [
      nar('a', 'Lanterns, drums, and one very loud oni. Kaede spots you from across the festival and waves with her sake gourd.', 'b'),
      her('b', "COMMANDER! Over here! You're late, and late people drink first. Oni law.", 'c', 'laugh'),
      pick('c', "Well? You gonna keep up with me, or do I have to carry you home again?", ["Pour it. I'm not scared of you.", 'd', 30], ['Maybe one cup...', 'e', 10], 'grin'),
      her('d', "HA! Now that's the face of a commander! Bottoms up!", 'f', 'laugh'),
      her('e', "One cup? Aww, how cute. Fine, fine, I'll drink yours for you.", 'f', 'grin'),
      pick('f', "Hey... dance with me. Everyone's watching and I want them jealous.", ["Lead the way.", 'g', 30], ["I can't dance.", 'h', 15]),
      her('g', "Hands here. And here. There we go — see? You move good when you stop thinking.", 'z', 'blush'),
      her('h', "Who cares? Just hold on to me and let me do the work. I'm very good at that.", 'z', 'wink'),
      end('z', "Best festival in a hundred years. Don't tell the others I said so, or they'll get ideas.", 'smile'),
    ],
  },
  {
    id: 'kaede-2',
    heroine: 'kaede',
    title: 'Horns and Honesty',
    level: 3,
    start: 'a',
    nodes: [
      nar('a', 'Kaede is sitting alone on the training ground, unusually quiet, tracing the edge of one of her horns.', 'b'),
      her('b', "Oh. It's you. Don't make that face, I'm not sulking. Oni don't sulk.", 'c', 'pout'),
      pick('c', "A kid at the village said my horns were scary. Stupid, right? Doesn't bother me.", ['I think they suit you.', 'd', 30], ["It clearly bothers you.", 'e', 25], 'pout'),
      her('d', "...Yeah? You think so? You're not just saying that to be nice?", 'f', 'blush'),
      her('e', "Tch. You see through me too easily. That's annoying. ...Stay anyway.", 'f', 'shy'),
      pick('f', "Wanna touch them? Nobody ever asks. Everyone just stares.", ['Can I?', 'g', 30], ["Only if you want me to.", 'h', 30]),
      her('g', "Gently... Hm. Your hands are warm. That tickles. Don't stop.", 'z', 'blush'),
      her('h', "I want you to. Obviously. Why else would I sit here looking pathetic waiting for you?", 'z', 'grin'),
      end('z', "Okay! Mood fixed! Tomorrow I'm blowing up twice as many monsters, just for you.", 'laugh'),
    ],
  },
  // ---------------------------------------------------------------- Selene
  {
    id: 'selene-1',
    heroine: 'selene',
    title: 'Moonlight Recital',
    level: 1,
    start: 'a',
    nodes: [
      nar('a', 'Soft singing drifts from the shrine roof. Selene is up there, bathed in moonlight, and she has noticed you.', 'b'),
      her('b', "Ara~ A private audience. Most people pay offerings for this, Commander.", 'c', 'smile'),
      pick('c', "Did you enjoy the song? Be honest. The moon knows when you lie.", ['It was beautiful. So are you.', 'd', 30], ['I only caught the end.', 'e', 10], 'tease'),
      her('d', "My, my. So smooth. Have you been practicing that line on the others?", 'f', 'tease'),
      her('e', "Then I suppose I'll just have to sing it again. For you only.", 'f', 'smile'),
      pick('f', 'Come up here. The roof is steady, and I promise not to push you. Probably.', ["I'll climb up.", 'g', 30], ['I like the view from here.', 'h', 20]),
      her('g', "Careful — ah. There. Now we're both closer to the moon. And to each other.", 'z', 'blush'),
      her('h', "Is that so? Then I'll stand just a little more in the light. For your view.", 'z', 'wink'),
      end('z', "Goodnight, Commander. I'll be thinking about the song I'll write about you.", 'smile'),
    ],
  },
  {
    id: 'selene-2',
    heroine: 'selene',
    title: 'Fortune Telling',
    level: 3,
    start: 'a',
    nodes: [
      nar('a', 'Selene has laid out moon-cards on a silk cloth. She pats the cushion beside her.', 'b'),
      her('b', "Sit. I've been dying to read your fortune. Give me your hand — palm up.", 'c', 'smile'),
      pick('c', "Hmm... a long life line. A strong fate line. And this one... oh my.", ["What does that one mean?", 'd', 25], ["Are you just holding my hand?", 'e', 30], 'tease'),
      her('d', "It means someone close to you is very interested in you. How curious. Who could it be?", 'f', 'tease'),
      her('e', "Caught. The cards were an excuse. Your hand is much nicer to hold than a deck.", 'f', 'blush'),
      pick('f', 'One last card. Draw it, and it will tell us what happens tonight.', ['Draw it for me.', 'g', 25], ["I'd rather be surprised.", 'h', 30]),
      her('g', "The Lovers. Hmm. The moon has such a sense of humor.", 'z', 'wink'),
      her('h', "A romantic. Then I'll keep it face down... and let you find out slowly.", 'z', 'smile'),
      end('z', 'Thank you, Commander. The moon is kind tonight — and so are you.', 'smile'),
    ],
  },
];

export function episodesFor(heroine: string): ChatEpisode[] {
  return EPISODES.filter((e) => e.heroine === heroine).sort((a, b) => a.level - b.level);
}
