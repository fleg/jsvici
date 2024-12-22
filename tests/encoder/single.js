'use strict';

const test = require('node:test');
const assert = require('node:assert');
const {encodePacket} = require('../../lib/encoder');

test('encode single packet', async (t) => {
  const testCases = [
    {
      packet: {type: 0, name: 'version'},
      expected: '00000009000776657273696f6e',
    },
    {
      packet: {type: 0, name: 'stats'},
      expected: '0000000700057374617473',
    },
    {
      packet: {type: 0, name: 'unk'},
      expected: '000000050003756e6b',
    },
    {
      packet: {type: 3, name: 'list-conn'},
      expected: '0000000b03096c6973742d636f6e6e',
    },
    {
      packet: {type: 0, name: 'list-conns', args: { ike: '*'}},
      expected: '00000016000a6c6973742d636f6e6e73010303696b6500012a02',
    },
    {
      packet: {type: 4, name: 'list-conn'},
      expected: '0000000b04096c6973742d636f6e6e',
    }
  ];

  for (const tc of testCases) {
    await t.test(`packet ${tc.expected.slice(0, 16)}...`, () => {
      assert.deepStrictEqual(
        encodePacket(tc.packet.type, tc.packet.name, tc.packet.args).toString('hex'),
        tc.expected,
      );
    })
  }
});
