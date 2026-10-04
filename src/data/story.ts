import { ask, at, cast, close, far, nar, script, you } from './script.ts';
import type { ChatEpisode } from './types.ts';

// The main story: ensemble chapters that play by themselves at a point in the game
// and can be replayed from the Story page. They award no Bond and never assume a
// romance with any one heroine (docs/VN_DIRECTION.md 5.1). Canon: docs/LORE.md.
// Narration is the Commander, first person, present tense.

export interface StoryChapter {
  ep: ChatEpisode;
  /** When it plays by itself: before the first battle, after the n-th finished battle, or when a heroine joins. */
  when: { kind: 'start' } | { kind: 'battles'; n: number } | { kind: 'heroine'; id: string };
  /** What the Story page says while it is locked. */
  hint: string;
}

const selene = cast('selene');
const scarlet = cast('scarlet');
const yuki = cast('yuki');
const kaede = cast('kaede');

const chapter = (
  id: string,
  no: string,
  title: string,
  heroine: string,
  scene: ChatEpisode['scene'],
  lines: Parameters<typeof script>[0],
): ChatEpisode => ({ id, heroine, title, level: 1, scene, kicker: `Chapter ${no}`, emptyStage: true, ...script(lines) });

export const STORY: StoryChapter[] = [
  {
    when: { kind: 'start' },
    hint: 'Plays before your first battle',
    ep: chapter('ch1-1', '1-1', 'Nine Hundred and Ninety-Nine Steps', 'selene', 'moongate', [
      nar('Nine hundred and ninety-nine steps. I counted. Counting was easier than wondering why I said yes.'),
      nar('The letter had no name on it. A place, a date, and one line: "A heart the Lady cannot see through. Please hurry."'),
      nar(
        'At the top there is a gate with nothing behind it but sky, and a woman who looks as if she has been waiting for exactly this long.',
      ),
      far(selene('smile', 'Ara~ You came.')),
      selene('tease', 'And just as the prophecy said. At the top of my very long staircase, completely out of breath.'),
      you('The prophecy mentioned the stairs?'),
      selene('laugh', 'It mentioned the breathing.'),
      selene('smile', "I'm Selene, priestess of the Moonlit Shrine. The last one, so please be nice to me."),
      ask(
        selene('wink', 'And you are the one who commands my Sirens tonight. Has anyone told you what you are?'),
        ['Lost, mostly.', 0, [selene('laugh', 'Honest! Good. I can work with honest.')]],
        ['Someone who answers strange letters.', 0, [selene('tease', 'And I am so very glad that you do.')]],
      ),
      close(selene('smile', 'You are an Anchor.')),
      selene(
        'smile',
        "A Siren's power is a song, and a song needs someone to hear it. Most people who listen to one of us for long get burned. Or frozen. Or emptied.",
      ),
      close(selene('wink', "You won't. That is all an Anchor is. Someone who can listen, and stay.")),
      nar('She says "that is all" the way people say "it\'s only a scratch".'),
      selene('sad', 'This is the Moongate. Under it lies the Hollow Sea, where everything the world forgets sinks and goes hungry.'),
      selene(
        'sad',
        'Once a century the moon goes dark for one night, and the hunger climbs the road. We call it the Blight. The dark night is close, and the gate is cracking early.',
      ),
      you('What happened to the last person who had this job?'),
      close(selene('shy', 'Keeper Haruo walked down into the dark ten years ago, to buy us time.')),
      close(selene('smile', 'His lantern is still lit. I check every morning.')),
      nar('She smiles when she says it. I decide not to ask about the morning it is not.'),
      selene('laugh', 'Now! Enough gloom. Come and meet the ones who do the actual work.'),
      at(
        'menu',
        nar(
          'The shrine road runs downhill from the gate between stone lanterns. Two women are waiting on it. Neither looks like she waits for people often.',
        ),
      ),
      far(scarlet('smile', 'So this is the Anchor.')),
      scarlet('tease', 'Smaller than the prophecy implied, darling. I approve. Less to guard.'),
      scarlet('wink', 'Scarlet Vane. I shoot things. One at a time, very hard, from very far away.'),
      you('Do you ever miss?'),
      scarlet('laugh', 'Twice, in four hundred years. Ask me about the second one when I know you better.'),
      nar('The other one stands where the lantern light gives up. There is frost on the stones around her feet.'),
      far(yuki('shy', '...Yuki.')),
      yuki('shy', 'I make them slow. So the others can hit them.'),
      yuki('blush', '...That was all of it. I practised a longer one. It is gone.'),
      scarlet('tease', 'That is more than she has said to me all month. I am trying not to take it personally.'),
      yuki('pout', 'You talk enough for two.'),
      ask(
        selene('smile', 'Two Sirens and one road. Any first orders, Commander?'),
        ['Show me what you can do.', 0, [scarlet('wink', 'With pleasure.')]],
        ['Is two enough?', 0, [yuki('smile', '...No. But it is two more than yesterday.')]],
      ),
      selene(
        'smile',
        'More will come when the road is worth standing on. An oni who has been "on her way" for a month. A dream eater, whenever she wakes up. And me, the first night the seal can hold without my voice.',
      ),
      nar('At the far end of the road the dark begins to glitter. Small lights, drifting uphill. They are almost pretty.'),
      selene('sad', 'There. Each light is something the Hollow Sea has eaten, wrapped in layers. Strike one and a layer peels away.'),
      selene(
        'smile',
        'Set my girls beside the road, wherever you think best. They listen to you now. Whatever reaches this gate, the seal pays for, and it cannot pay for much.',
      ),
      selene('wink', 'I will be up here, singing. And Commander...'),
      close(selene('smile', 'Come back and tell me about it.')),
    ]),
  },
  {
    when: { kind: 'battles', n: 1 },
    hint: 'Plays after your first battle',
    ep: chapter('ch1-2', '1-2', 'What the Lights Were', 'yuki', 'menu', [
      nar('The road is quiet again. My hands are not. Nobody mentions it, which is kind of them.'),
      scarlet('smile', 'Well. The gate still stands, and you only pointed at me once.'),
      you('I did not point.'),
      scarlet('tease', 'You pointed, darling. Emphatically. I have shot people for less.'),
      nar(
        'Above the road, small lights are still floating up out of the grass, slower than sparks. Yuki is watching them with her head tipped back.',
      ),
      ask(
        yuki('smile', '...You are wondering what they are.'),
        ['They look like they are leaving.', 0, [yuki('blush', '...Yes. That is exactly it. And you saw it on the first night.')]],
        ['I had assumed smoke.', 0, [yuki('tease', '...Smoke does not go home.')]],
      ),
      yuki('smile', 'The Blight is made of what the Hollow Sea has eaten. A name. A song. The smell of a kitchen.'),
      yuki('smile', 'When a layer breaks, the thing inside is let go. It goes back to whoever lost it.'),
      close(yuki('shy', '...That is why we do not hate them.')),
      scarlet('smile', 'It is also why the grey ones are such a bore. Grief hardens. Bullets bounce off it.'),
      scarlet('wink', 'Silver does not. Neither does fire. Do remember that when you decide what I learn next, darling.'),
      nar('Selene comes down the steps with her sleeves pushed back and her voice a little hoarse.'),
      selene('smile', 'Did you feel it, Commander? When they fought with you watching?'),
      selene(
        'smile',
        'A song is stronger when someone is listening. The more one of them trusts you, the more she can do. We call it Bond.',
      ),
      selene(
        'tease',
        'It does not grow on the road alone. Talk to them. Bring them the things you find out there. Each of them will pretend not to care.',
      ),
      scarlet('laugh', 'I never pretend. I care about wine, and I am not subtle about it.'),
      yuki('shy', '...Tea is fine.'),
      yuki('blush', '...If it is not a bother.'),
      nar('The two of them drift off toward the baths, arguing about hot water. Selene does not. She has gone back up to the gate.'),
      at('moongate', nar('Her palm is flat on the stone. Under it there is a crack that was not there this morning.')),
      selene('shy', 'Ara. Caught.'),
      close(selene('sad', 'It is early, that is all. The dark night is weeks away, and the gate is cracking as if it were tomorrow.')),
      ask(
        close(selene('smile', 'Do not make that face. I have been singing it shut for ten years. I am very good.')),
        ['What do you need?', 0, [selene('blush', '...Nobody has asked me that in a long time.')]],
        ['What are you not telling me?', 0, [selene('tease', 'A great many things. A priestess needs her mysteries.')]],
      ),
      close(selene('smile', 'A commander who comes back. I seem to have one.')),
      selene('wink', 'Go to bed. Tomorrow the road will be longer.'),
    ]),
  },
  {
    when: { kind: 'heroine', id: 'kaede' },
    hint: 'Plays when Kaede joins (reach wave 10)',
    ep: chapter('ch1-3', '1-3', 'The Oni Is Late', 'kaede', 'menu', [
      nar(
        'The road is still smoking from the last wave when somebody starts singing at the bottom of the stairs. Loudly. Off-key. Getting closer.',
      ),
      far(kaede('laugh', "SNOWBALL! I'm home! Did you miss me? You missed me!")),
      yuki('blush', '...Kaede. You are a month late.'),
      kaede('tease', "I'm not late. The festival ran long. Then there was another festival."),
      scarlet('tease', 'There are three festivals between here and the south coast, darling. She has attended five.'),
      kaede('angry', 'Vane. Still dead, I see.'),
      scarlet('wink', 'Still loud, I see.'),
      nar('They glare at each other for exactly as long as it takes Kaede to hand her a bottle. Then it is apparently over.'),
      kaede('smile', "So you're the Anchor. Lemme look at you."),
      nar('She looks. It is like being weighed by a bonfire.'),
      ask(
        close(kaede('tease', 'Hm. Small. Tired. Lets too many lights near the gate, from what I saw coming up the hill.')),
        ['You watched and did not help?', 0, [kaede('laugh', "Ha! It talks back! Good. I can't follow somebody who doesn't.")]],
        ['Then show me how it is done.', 0, [kaede('laugh', 'HA! Oh, I like you. That was the right answer.')]],
      ),
      kaede('wink', "Kaede Emberhorn. Oni. I do fire: big, loud, and all over whatever's standing close together."),
      kaede('smile', "Put me where the road bends and they bunch up. And those grey armoured ones Vane can't scratch? They melt."),
      kaede('tease', 'Also, you owe me a drink. Late people get welcomed with a drink. Oni law.'),
      you('You were the one who was late.'),
      kaede('laugh', 'And I got welcomed! See? The law works.'),
      yuki('smile', '...She is like this all the time.'),
      close(yuki('shy', '...It is better when she is here.')),
      nar(
        "Kaede pretends not to hear that. She is not good at pretending. She ruffles Yuki's hair, very gently, the way you would touch something that could break.",
      ),
      kaede('smile', "Right. Where's the next wave? I've got a month of festivals to burn off."),
    ]),
  },
];

export const STORY_BY_ID: Record<string, StoryChapter> = Object.fromEntries(STORY.map((c) => [c.ep.id, c]));
