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

const getType = (val) => {
  if (utils.isArray(val)) return ELEMENT_LIST_START;
  if (utils.isString(val)) return ELEMENT_KEY_VALUE;
  if (utils.isPlainObject(val)) return ELEMENT_SECTION_START;
  throw new Error(`unknown type of value ${val}`);
};

class Encoder {
  constructor() {
    this.length = 1024;
    this.buf = Buffer.alloc(this.length);
    this.offset = 0;
  }

  has(size) {
    if (this.length - this.offset < size) throw new Error('max length of packet is reached');
  }

  writeUInt(size, value) {
    this.has(size);
    this.buf.writeUIntBE(value, this.offset, size);
    this.offset += size;
  };

  writeUInt8(v) {
    this.writeUInt(1, v);
  }

  writeUInt16(v) {
    this.writeUInt(2, v);
  }

  writeUInt32(v) {
    this.writeUInt(4, v);
  }

  writeString(size, value) {
    const len = Buffer.byteLength(value)
    this.has(len);
    this.writeUInt(size, len);
    this.buf.write(value, this.offset, len, 'ascii');
    this.offset += len;
  };

  writeString8(v) {
    this.writeString(1, v);
  }

  writeString16(v) {
    this.writeString(2, v);
  }

  writeSection(sec) {
    for (const [key, val] of Object.entries(sec)) {
      const type = getType(val);
      
      this.writeUInt8(type);
      this.writeString8(key);
      
      switch (type) {
        case ELEMENT_KEY_VALUE: this.writeString16(val); break;
        case ELEMENT_LIST_START: this.writeList(val); break;
        case ELEMENT_SECTION_START: this.writeSection(val); break;
      }
    }

    this.writeUInt8(ELEMENT_SECTION_END);
  };

  writeRoot(sec) {
    this.writeSection(sec);
  }

  writeList(list) {
    for (const item of list) {
      this.writeUInt8(ELEMENT_LIST_ITEM);
      this.writeString16(String(item));
    }
    this.writeUInt8(ELEMENT_LIST_END);
  };

  data() {
    return this.buf.subarray(0, this.offset);
  }
}

const encodePacket = (type, name, args) => {
  const encoder = new Encoder();

  encoder.writeUInt32(0);
  encoder.writeUInt8(type);
  encoder.writeString8(name);
  
  if (args && !utils.isEmptyObject(args)) {
    encoder.writeUInt8(ELEMENT_SECTION_START);
    encoder.writeRoot(args);
  }

  encoder.buf.writeUInt32BE(encoder.offset - 4, 0);

  return encoder.data();
};

module.exports = {
  Encoder,
  encodePacket,
};
