import type { Mood } from './progression.ts';
import type { ChatNode, ChatScene } from './types.ts';

// A small script notation for long episodes: lines are written in reading order and
// linked automatically; a choice carries its two branches, which rejoin at the line
// after it. `script()` turns the list into the node graph the chat player runs.
//
//   const k = cast();          // the episode's heroine
//   const y = cast('yuki');    // a second voice
//   script([
//     nar('…'),
//     k('laugh', '…'),
//     ask(k('tease', 'Well?'), ['Bold answer.', 30, [k('blush', '…')]], ['Safe answer.', 15, []]),
//     cg('kaede-g2', k('wink', '…')),   // from here the illustration fills the screen
//     cg(false, nar('…')),              // back to the stage
//     close(k('smile', '…')),           // the camera comes in for this line (far, mid, close)
//     k('smile', 'Her last line.'),
//   ])

/** A line before it has an id and a link. */
export interface Draft extends Omit<ChatNode, 'id' | 'next' | 'choices' | 'end'> {
  options?: [Option, Option];
}
/** Choice text, Bond XP (10 meh … 30 she loves it), the lines that follow it. */
export type Option = [text: string, affection: number, then: Draft[]];

/** Narration: the Commander's eyes, first person, present tense. */
export const nar = (text: string): Draft => ({ speaker: 'narration', text });
/** The Commander speaking aloud. */
export const you = (text: string): Draft => ({ speaker: 'you', text });
/** A line maker for one voice: the episode's heroine by default, another heroine by id. */
export const cast =
  (who?: string) =>
  (mood: Mood, text: string): Draft =>
    who ? { speaker: 'her', who, mood, text } : { speaker: 'her', mood, text };
/** A line that ends in two answers. */
export const ask = (line: Draft, a: Option, b: Option): Draft => ({ ...line, options: [a, b] });
/** From this line on, show a gallery picture instead of the stage (`false`: back to the stage). */
export const cg = (id: string | false, line: Draft): Draft => ({ ...line, cg: id });
/** From this line on, the scene is somewhere else. */
export const at = (scene: ChatScene, line: Draft): Draft => ({ ...line, scene });
// The camera. A line without one of these is framed by her mood: a blush brings the camera
// in, and it stays in while she is shy or sad (ui/chat.ts). These say it for one line.
/** Her whole figure: an arrival, someone across the room. */
export const far = (line: Draft): Draft => ({ ...line, shot: 'far' });
/** The usual framing, from the waist up. */
export const mid = (line: Draft): Draft => ({ ...line, shot: 'mid' });
/** Her face and shoulders: the line that matters. */
export const close = (line: Draft): Draft => ({ ...line, shot: 'close' });

export function script(lines: Draft[]): { start: string; nodes: ChatNode[] } {
  const nodes: ChatNode[] = [];
  let count = 0;
  /** Adds a run of lines that continues at `after`; returns the id the run starts at. */
  const add = (run: Draft[], after?: string): string | undefined => {
    const ids = run.map(() => `n${++count}`);
    run.forEach((draft, i) => {
      const { options, ...line } = draft;
      const node: ChatNode = { id: ids[i], ...line };
      nodes.push(node);
      const next = ids[i + 1] ?? after;
      if (options) {
        const [a, b] = options.map(([text, affection, then]) => {
          const to = add(then, next);
          if (!to) throw new Error(`script: the answer "${text}" leads nowhere`);
          return { text, affection, next: to };
        });
        node.choices = [a, b];
      } else if (next) node.next = next;
      else node.end = true;
    });
    return ids[0] ?? after;
  };
  const start = add(lines);
  if (!start) throw new Error('script: empty');
  return { start, nodes };
}
