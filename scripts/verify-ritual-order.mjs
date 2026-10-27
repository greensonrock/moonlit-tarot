import assert from "node:assert/strict";
import { drawCardsFromRitualSelection } from "../draw-random.js";

const deck = Array.from({ length: 78 }, (_, index) => ({ id: index }));
const forward = deck.map((_, index) => index);
const backward = [...forward].reverse();
const config = { reverseRate: 0 };

const first = drawCardsFromRitualSelection(deck, 3, [0, 17, 77], 39, config, forward);
assert.deepEqual(first.map(({ card }) => card.id), [39, 56, 38]);

const reversed = drawCardsFromRitualSelection(deck, 3, [0, 17, 77], 39, config, backward);
assert.deepEqual(reversed.map(({ card }) => card.id), [38, 21, 39]);

const selected = drawCardsFromRitualSelection(deck, 3, [0, 0, 1, 2], 39, config, forward);
assert.equal(new Set(selected.map(({ card }) => card.id)).size, 3);

console.log("OK 手势牌序、切点与无放回选牌一致");
