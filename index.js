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
