const net = require('net');
const {EventEmitter} = require('events');

class ViciClient extends EventEmitter {
  static create(uri) {
    const vici = new ViciClient(uri);

    return new Promise((resolve, reject) => {
      vici.conn.once('connect', () => {
        resolve(vici);
      });
      vici.conn.once('error', reject);
    });
  }

  constructor(uri) {
    super();

    const conn = net.createConnection(parseUri(uri));
    
    conn.on('error', (err) => this.emit('error', err));
    conn.on('data', (data) => {
      const packets = decodePackets(data);

      for (const packet of packets) {
        this.emit('packet', packet);
      }
    });

    this.on('packet', (packet) => {
      if (packet.type === PACKET_EVENT) {
        this.emit(packet.event, packet.payload);
      }
    });

    this.conn = conn;
  }

  close() {
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
    const data = encodePacket(PACKET_EVENT_REGISTER, name);
    await this.write(data);
    const packet = await this.waitFor([PACKET_EVENT_CONFIRM, PACKET_EVENT_UNKNOWN]);

    if (packet.type === PACKET_EVENT_UNKNOWN) {
      throw new Error(`unknown event ${name}`);
    }
  }

  async unregister(name) {
    const data = encodePacket(PACKET_EVENT_UNREGISTER, name);
    await this.write(data);
    const packet = await this.waitFor([PACKET_EVENT_CONFIRM, PACKET_EVENT_UNKNOWN]);

    if (packet.type === PACKET_EVENT_UNKNOWN) {
      throw new Error(`unknown event ${name}`);
    }
  }

  async call(name, args) {
    const data = encodePacket(PACKET_CMD_REQUEST, name, args);
    await this.write(data);
    const packet = await this.waitFor([PACKET_CMD_RESPONSE, PACKET_CMD_UNKNOWN]);

    if (packet.type === PACKET_CMD_UNKNOWN) {
      throw new Error(`unknown command ${name}`);
    }

    return packet.payload;
  }

  async streamingCall(name, eventName, args) {
    try {
      await this.register(eventName);

      const events = [];
      const handler = (event) => events.push(event);

      this.on(eventName, handler);
      await this.call(name, args);
      this.off(eventName, handler);

      return events;
    } finally {
      await this.unregister(eventName);
    }
  }
}

const parseUri = (uri) => {
  const parts = new URL(uri);

  switch (parts.protocol) {
    case 'tcp:': return {host: parts.host, port: parts.port};
    case 'unix:': return {path: parts.pathname};
    default: throw new Error(`unsupported protocol ${parts.protocol}`);
  }
}

// packet types
const PACKET_CMD_REQUEST = 0;
const PACKET_CMD_RESPONSE = 1;
const PACKET_CMD_UNKNOWN = 2;
const PACKET_EVENT_REGISTER = 3;
const PACKET_EVENT_UNREGISTER = 4;
const PACKET_EVENT_CONFIRM = 5;
const PACKET_EVENT_UNKNOWN = 6;
const PACKET_EVENT = 7;

// message elements types
const ELEMENT_SECTION_START = 1;
const ELEMENT_SECTION_END = 2;
const ELEMENT_KEY_VALUE = 3;
const ELEMENT_LIST_START = 4;
const ELEMENT_LIST_ITEM = 5;
const ELEMENT_LIST_END = 6;

const encodePacket = (type, name, args) => {
  const length = 1024;
  const buf = Buffer.alloc(length);
  let offset = 0;

  const has = (size) => {
    if (length - offset < size) throw new Error('max length of packet is reached');
  };

  const writeUInt = (size, value) => {
    has(size);
    buf.writeUIntBE(value, offset, size);
    offset += size;
  };

  const writeUInt8 = (v) => writeUInt(1, v);
  const writeUInt16 = (v) => writeUInt(2, v);
  const writeUInt32 = (v) => writeUInt(4, v);

  const writeString = (size, value) => {
    const len = Buffer.byteLength(value)
    has(len);
    writeUInt(size, len);
    buf.write(value, offset, len, 'ascii');
    offset += len;
  };

  const writeString8 = (v) => writeString(1, v);
  const writeString16 = (v) => writeString(2, v);

  const getType = (val) => {
    if (isArray(val)) return ELEMENT_LIST_START;
    if (isString(val)) return ELEMENT_KEY_VALUE;
    if (isPlainObject(val)) return ELEMENT_SECTION_START;
    throw new Error(`unknown type of value ${val}`);
  };

  const writeSection = (sec) => {
    for (const [key, val] of Object.entries(sec)) {
      const type = getType(val);
      
      writeUInt8(type);
      writeString8(key);
      
      switch (type) {
        case ELEMENT_KEY_VALUE: writeString16(val); break;
        case ELEMENT_LIST_START: writeList(val); break;
        case ELEMENT_SECTION_START: writeSection(val); break;
      }
    }

    writeUInt8(ELEMENT_SECTION_END);
  };

  const writeList = (list) => {
    for (const item of list) {
      writeUInt8(ELEMENT_LIST_ITEM);
      writeString16(String(item));
    }
    writeUInt8(ELEMENT_LIST_END);
  };

  const makePacket = () => {
    const packet = Buffer.concat([
      Buffer.alloc(4),
      buf.subarray(0, offset)
    ]);
    packet.writeUInt32BE(offset);
    return packet;
  };


  writeUInt8(type);
  writeString8(name);
  if (args && !isEmptyObject(args)) {
    writeUInt8(ELEMENT_SECTION_START);
    writeSection(args);
  }

  return makePacket(buf, offset);
};

const decodePackets = (buf) => {
  let offset = 0;
  let length = buf.length;
  const packets = [];

  while (offset < length) {
    const packetSize = buf.readUInt32BE(offset);
    offset += 4;

    if (packetSize > length - offset) {
      throw new Error('segmented packets are not supported');
    }

    packets.push(decodePacket(buf.subarray(offset, offset + packetSize)));
    offset += packetSize;
  }

  return packets;
};

const decodePacket = (buf) => {
  let offset = 0;
  let length = buf.length;

  const has = (size) => {
    if (length - offset < size) throw new Error('unexpected end of packet');
  };

  const readUInt = (size) => {
    has(size);
    const val = buf.readUIntBE(offset, size);
    offset += size;
    return val;
  };

  const readUInt8 = () => readUInt(1);
  const readUInt16 = () => readUInt(2);
  const readUInt32 = () => readUInt(4);

  const readString = (size) => {
    const len = readUInt(size);
    has(len);
    const str = buf.toString('ascii', offset, offset + len);
    offset += len;
    return str;
  };

  const readString8 = () => readString(1);
  const readString16 = () => readString(2);

  const readRoot = () => {
    const root = {};

    while (offset < length) {
      const type = readUInt8();
      
      switch (type) {
        case ELEMENT_KEY_VALUE: root[readString8()] = readString16(); break;
        case ELEMENT_SECTION_START: root[readString8()] = readSection(); break;
        case ELEMENT_LIST_START: root[readString8()] = readList(); break;
        default: throw new Error(`unsupported element in root ${type}`);
      }

    }

    return root;
  };

  const readList = () => {
    const list = [];

    while (offset < length) {
      const type = readUInt8();

      switch (type) {
        case ELEMENT_LIST_ITEM: list.push(readString16()); break;
        case ELEMENT_LIST_END: return list;
        default: throw new Error(`unsupported element in list ${type}`);
      }
    }

    throw new Error('invalid list');
  };

  const readSection = () => {
    const sec = {};
    
    while (offset < length) {
      const type = readUInt8();

      switch (type) {
        case ELEMENT_KEY_VALUE: sec[readString8()] = readString16(); break;
        case ELEMENT_SECTION_START: sec[readString8()] = readSection(); break;
        case ELEMENT_SECTION_END: return sec;
        case ELEMENT_LIST_START: sec[readString8()] = readList(); break;
        default: throw new Error(`unsupported element in section ${type}`);
      }
    }

    throw new Error('invalid section')
  }

  const type = readUInt8();
  let event = null;
  if (type === PACKET_EVENT) {
    event = readString8();
  }

  const payload = readRoot();

  return {
    type,
    event,
    payload,
  };
};

const isEmptyObject = (obj) => Object.keys(obj).length === 0;
const isString = (str) => typeof str === 'string';
const isArray = (a) => Array.isArray(a);
const isPlainObject = obj => obj && obj.constructor === Object;


const main = async () => {
  const client = await ViciClient.create('unix:///var/run/charon.vici');

  // const version = await client.call('version');
  // const stats = await client.call('stats');
  // //const unk = await client.call('unk');

  // console.log(version);
  // console.log(stats);

  const conns = await client.streamingCall('list-conns', 'list-conn', {
    ike: 'test'
  });

  console.log(conns);

  //await client.close();
};

main().catch(console.error);