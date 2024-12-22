const net = require('net');
const {EventEmitter} = require('events');
const {encodePacket} = require('./encoder');
const {Decoder} = require('./decoder');
const {
  PACKET_CMD_REQUEST,
  PACKET_CMD_RESPONSE,
  PACKET_CMD_UNKNOWN,
  PACKET_EVENT_REGISTER,
  PACKET_EVENT_UNREGISTER,
  PACKET_EVENT_CONFIRM,
  PACKET_EVENT_UNKNOWN,
  PACKET_EVENT,
} = require('./const');

class ViciClient extends EventEmitter {
  constructor(opts) {
    super();

    const {socketOptions, reconnect} = parseOpts(opts);
    const conn = net.createConnection(socketOptions);
    const decoder = new Decoder();

    conn.on('error', (err) => this.emit('error', err));

    conn.on('data', (data) => {
      const packets = decoder.decode(data);

      for (const packet of packets) {
        this.emit('packet', packet);
        
        if (packet.type === PACKET_EVENT) {
          this.emit(packet.event, packet.payload);
        }
      }
    });

    conn.on('close', () => {
      if (!this.reconnect || this.connecting) return;
      console.log('lost connection, trying to reconnect...');

      const errorHandler = (err) => {
        console.log('connection error:', err.message);
        setTimeout(() => this.conn.connect(socketOptions), 1000);
      };

      this.conn.once('connect', () => {
        this.conn.off('error', errorHandler);
        this.connecting = false;
        console.log('successfully reconected');
      });
      this.conn.on('error', errorHandler);
      this.conn.connect(socketOptions);
      this.connecting = true;
    });


    this.conn = conn;
    this.reconnect = reconnect;
    this.calling = false;
  }

  close() {
    this.reconnect = false;

    return new Promise((resolve, reject) => {
      this.conn.destroy();
      this.conn.once('close', resolve);
      this.conn.once('error', reject);
    });
  }

  write(data) {
    return new Promise((resolve, reject) => {
      this.conn.write(data, 'ascii', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  waitFor(packetTypes) {
    return new Promise((resolve, reject) => {
      const handler = (packet) => {
        if (packetTypes.includes(packet.type)) {
          clean();
          resolve(packet);
        }
      };

      const errorHandler = (err) => {
        clean();
        reject(err);
      };

      const clean = () => {
        this.off('packet', handler);
        this.off('error', errorHandler);
      };

      this.on('packet', handler);
      this.on('error', errorHandler);
    });
  }

  async register(name) {
    await this.call(name, {}, {
      req: PACKET_EVENT_REGISTER,
      res: PACKET_EVENT_CONFIRM,
      err: PACKET_EVENT_UNKNOWN,
    });
  }

  async unregister(name) {
    await this.call(name, {}, {
      req: PACKET_EVENT_UNREGISTER,
      res: PACKET_EVENT_CONFIRM,
      err: PACKET_EVENT_UNKNOWN,
    });
  }

  async call(name, args, types) {
    if (this.calling) {
      throw new Error('only one command can be active at a time');
    }
    
    this.calling = true;

    try {
      const data = encodePacket(types.req, name, args);
      await this.write(data);
      const packet = await this.waitFor([types.res, types.err]);

      if (packet.type === types.err) {
        throw new Error(`unknown command or event: ${name}`);
      }

      return packet.payload;
    } finally {
      this.calling = false;
    }
  }

  async doCommand(name, args) {
    const payload = await this.call(name, args, {
      req: PACKET_CMD_REQUEST,
      res: PACKET_CMD_RESPONSE,
      err: PACKET_CMD_UNKNOWN,
    });

    return payload;
  }

  async doStreamingCommand(name, eventName, args) {
    try {
      await this.register(eventName);

      const payloads = [];
      const handler = (payload) => payloads.push(payload);

      this.on(eventName, handler);
      await this.doCommand(name, args);
      this.off(eventName, handler);

      return payloads;
    } finally {
      await this.unregister(eventName);
    }
  }
}

const parseOpts = ({uri, reconnect}) => ({
  socketOptions: parseUri(uri),
  reconnect: Boolean(reconnect),
})

const parseUri = (uri) => {
  const parts = new URL(uri);

  switch (parts.protocol) {
    case 'tcp:': return {host: parts.hostname, port: parts.port};
    case 'unix:': return {path: parts.pathname};
    default: throw new Error(`unsupported protocol ${parts.protocol}`);
  }
}

module.exports = {
  ViciClient,
  parseOpts,
  parseUri,
};
