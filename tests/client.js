'use strict';

const test = require('node:test');
const assert = require('node:assert');
const {createClient} = require('../index');

// TODO add strongswan running inside docker

const defaultOpts = {
  uri: 'tcp://127.0.0.1:4502',
  reconnect: false,
};

test('client integration', async (t) => {
  await t.test('can connect and disconnect', async () => {
    const client = await createClient(defaultOpts);

    await client.close();
  });

  await t.test('do unknown command', async () => {
    const client = await createClient(defaultOpts);

    t.after(() => client.close());

    await assert.rejects(
      client.doCommand('foobar'),
      /unknown command or event: foobar/
    );
  });

  await t.test('do version command', async (t) => {
    const client = await createClient(defaultOpts);

    t.after(() => client.close());

    const version = await client.doCommand('version');

    assert.ok(version.daemon);
    assert.ok(version.version);
    assert.ok(version.sysname);
    assert.ok(version.release);
    assert.ok(version.machine);
  });

  await t.test('do stats command', async (t) => {
    const client = await createClient(defaultOpts);

    t.after(() => client.close());

    const stats = await client.doCommand('stats');

    assert.ok(stats.uptime);
    assert.ok(stats.workers);
    assert.ok(stats.queues);
    assert.ok(stats.scheduled);
    assert.ok(stats.ikesas);
    assert.ok(stats.plugins);
    assert.ok(stats.mallinfo);
  });

  await t.test('do list-conns command', async (t) => {
    const client = await createClient(defaultOpts);

    t.after(() => client.close());

    const conns = await client.doStreamingCommand('list-conns', 'list-conn', {ike: '*'});

    assert.strictEqual(conns.length, 2);
    assert.ok(conns[0].test1);
    assert.ok(conns[1].test2);
  });
});
