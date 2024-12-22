'use strict';

const {ViciClient} = require('./lib/client');

const createClient = (opts) => {
  const client = new ViciClient(opts);

  return new Promise((resolve, reject) => {
    client.conn.once('connect', () => {
      client.conn.off('error', reject);
      resolve(client);
    });
    client.conn.once('error', reject);
  });
};

module.exports = {
  createClient,
  ViciClient,
};

const test = async () => {
  const client = await createClient({
    uri: 'tcp://127.0.0.1:4502',
    reconnect: true,
  });

  client.on('error', (err) => {
    if (err.code === 'ECONNREFUSED') return;

    console.log(err.message);
  });

  const version = await client.doCommand('version');
  const stats = await client.doCommand('stats');
  
  try {
    await client.doCommand('unk');
  } catch (err) {
    console.log(err.stack);
  }

  console.log(version);
  console.log(stats);

  const conns = await client.doStreamingCommand('list-conns', 'list-conn', {
    ike: '*'
  });

  console.dir(conns, {depth: null});

  await client.close();
};

test().catch(console.error);
