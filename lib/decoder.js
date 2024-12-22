'use strict';

const {
  ELEMENT_SECTION_START,
  ELEMENT_SECTION_END,
  ELEMENT_KEY_VALUE,
  ELEMENT_LIST_START,
  ELEMENT_LIST_ITEM,
  ELEMENT_LIST_END,
  PACKET_EVENT,
} = require('./const');

class PacketsDecoder {
  constructor() {
    this.leftover = null;
  }

  decode(data) {
    const chunk = this.leftover ? Buffer.concat([this.leftover, data]) : data;
    const {packets, leftover} = decodePackets(chunk);
    
    this.leftover = leftover;

    return packets;
  }
}

const decodePackets = (buf) => {
  let offset = 0;
  let length = buf.length;
  const packets = [];
  let leftover = null;

  while (offset < length) {
    const packetSize = buf.readUInt32BE(offset);

    if (packetSize > length - offset - 4) {
      leftover = buf.subarray(offset);
      break;
    }

    packets.push(decodePacket(buf.subarray(offset, offset + packetSize + 4)));
    offset += packetSize + 4;
  }

  return {
    packets,
    leftover,
  };
};

class Decoder {
  constructor(buf) {
    this.offset = 0;
    this.buf = buf;
    this.length = buf.length;
  }

  leftover() {
    return this.buf.subarray(this.offset);
  }

  has(size) {
    if (this.length - this.offset < size) throw new Error('unexpected end of packet');
  }

  readUInt(size) {
    this.has(size);
    const val = this.buf.readUIntBE(this.offset, size);
    this.offset += size;
    return val;
  }

  readUInt8() {
    return this.readUInt(1);
  }

  readUInt16() {
    return this.readUInt(2);
  }

  readUInt32() {
    return this.readUInt(4);
  }

  readString(size) {
    const len = this.readUInt(size);
    this.has(len);
    const str = this.buf.toString('ascii', this.offset, this.offset + len);
    this.offset += len;
    return str;
  };

  readString8() {
    return this.readString(1);
  }

  readString16() {
    return this.readString(2);
  }

  readRoot() {
    const root = {};

    while (this.offset < this.length) {
      const type = this.readUInt8();
      
      switch (type) {
        case ELEMENT_KEY_VALUE: root[this.readString8()] = this.readString16(); break;
        case ELEMENT_SECTION_START: root[this.readString8()] = this.readSection(); break;
        case ELEMENT_LIST_START: root[this.readString8()] = this.readList(); break;
        default: throw new Error(`unsupported element in root ${type}`);
      }

    }

    return root;
  };

  readList() {
    const list = [];

    while (this.offset < this.length) {
      const type = this.readUInt8();

      switch (type) {
        case ELEMENT_LIST_ITEM: list.push(this.readString16()); break;
        case ELEMENT_LIST_END: return list;
        default: throw new Error(`unsupported element in list ${type}`);
      }
    }

    throw new Error('invalid list');
  };

  readSection() {
    const sec = {};
    
    while (this.offset < this.length) {
      const type = this.readUInt8();

      switch (type) {
        case ELEMENT_KEY_VALUE: sec[this.readString8()] = this.readString16(); break;
        case ELEMENT_SECTION_START: sec[this.readString8()] = this.readSection(); break;
        case ELEMENT_SECTION_END: return sec;
        case ELEMENT_LIST_START: sec[this.readString8()] = this.readList(); break;
        default: throw new Error(`unsupported element in section ${type}`);
      }
    }

    throw new Error('invalid section')
  }
}

const decodePacket = (buf) => {
  const decoder = new Decoder(buf);

  const size = decoder.readUInt32();
  const type = decoder.readUInt8();

  let event = null;
  if (type === PACKET_EVENT) {
    event = decoder.readString8();
  }

  const payload = decoder.readRoot();

  return {
    size,
    type,
    event,
    payload,
  }; 
};

module.exports = {
  Decoder,
  PacketsDecoder,
};
