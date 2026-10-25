import assert from 'node:assert/strict';
import { test } from 'node:test';

import { extractDrafts } from './extract.js';

test('heading-named sensory room picks up gate, side and hours', () => {
  const drafts = extractDrafts([
    {
      heading: 'Sensory Room',
      text:
        'The Sensory Room is located in Harvey Milk Terminal 1, post-security, near Gate C2. ' +
        'Open daily from 5:00 a.m. to 11:00 p.m. It has a quiet area, an active area and a cabin experience.',
    },
  ]);

  const sensory = drafts.find((d) => d.key === 'sensory-room');
  assert.ok(sensory);
  assert.equal(sensory.type, 'quiet');
  assert.equal(sensory.name, 'Sensory Room');
  assert.equal(sensory.gateHint, 'C2');
  assert.equal(sensory.terminalHint, 'Terminal 1');
  assert.equal(sensory.securitySide, 'post');
  assert.equal(sensory.hours, '5:00 a.m. to 11:00 p.m.');
});

test('mentions inside body text become one draft per kind', () => {
  const drafts = extractDrafts([
    {
      heading: 'Services',
      text:
        'There are three service animal relief areas. Two are outside, and one is post-security in Concourse A near Gate A2. ' +
        'All restrooms are accessible.',
    },
    { heading: 'More', text: 'A pet relief area is also listed on the airport map.' },
  ]);

  const relief = drafts.filter((d) => d.key === 'animal-relief');
  assert.equal(relief.length, 1);
  assert.equal(relief[0].gateHint, 'A2');
  assert.equal(relief[0].terminalHint, 'Concourse A');
  assert.match(relief[0].excerpt, /pet relief/);
});

test('pages without matching services produce no drafts', () => {
  assert.deepEqual(extractDrafts([{ heading: 'Parking', text: 'Garage rates start at $20 per day.' }]), []);
});
