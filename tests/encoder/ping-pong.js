'use strict';

const test = require('node:test');
const assert = require('node:assert');
const {Encoder} = require('../../lib/encoder');
const {Decoder} = require('../../lib/decoder');

test('ping pong section encode tests', async (t) => {
  const testCases = [
    {},
    {key: 'value'},
    {key: ''},
    {key: {key: 'value'}},
    {key: {key: {key: 'value'}}},
    {list: []},
    {list: ['']},
    {list: ['item']},
    {list: ['item1', 'item2']},
    {key: 'value', list: ['item']},
    {key: {key: ['item']}},
    {
      str: 'foo1',
      obj: {
        a: 'foo2',
        b: 'foo3',
        c: ['foo4', 'foo5'],
        d: {e: 'foo6'},
        f: [],
        g: {},
      },
      list: ['foo7', 'foo8'],
    }
  ];

  for (const tc of testCases) {
    await t.test(JSON.stringify(tc), () => {
      const encoder = new Encoder();
      encoder.writeSection(tc);

      const decoder = new Decoder(encoder.data());
      const decoded = decoder.readSection();

      assert.deepStrictEqual(decoded, tc);
    });
  }
});
