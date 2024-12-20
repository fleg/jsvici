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

const decodePackets = (buf) => {
  let offset = 0;
  let length = buf.length;
  const packets = [];
  let leftover = null;

  while (offset < length) {
    const packetSize = buf.readUInt32BE(offset);
    offset += 4;

    if (packetSize > length - offset) {
      // revert offset to pass size to leftover chunk
      leftover = buf.subarray(offset - 4);
      break;
    }

    packets.push(decodePacket(buf.subarray(offset, offset + packetSize)));
    offset += packetSize;
  }

  return {
    packets,
    leftover,
  };
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

module.exports = {
  decodePacket,
  decodePackets,
};
