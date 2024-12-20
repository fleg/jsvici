'use strict';

const utils = require('./utils');
const {
  ELEMENT_SECTION_START,
  ELEMENT_SECTION_END,
  ELEMENT_KEY_VALUE,
  ELEMENT_LIST_START,
  ELEMENT_LIST_ITEM,
  ELEMENT_LIST_END,
} = require('./const');

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
    if (utils.isArray(val)) return ELEMENT_LIST_START;
    if (utils.isString(val)) return ELEMENT_KEY_VALUE;
    if (utils.isPlainObject(val)) return ELEMENT_SECTION_START;
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
  if (args && !utils.isEmptyObject(args)) {
    writeUInt8(ELEMENT_SECTION_START);
    writeSection(args);
  }

  return makePacket(buf, offset);
};

module.exports = {
  encodePacket,
};
