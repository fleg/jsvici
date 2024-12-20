'use strict';

const isEmptyObject = (obj) => Object.keys(obj).length === 0;
const isString = (str) => typeof str === 'string';
const isArray = (a) => Array.isArray(a);
const isPlainObject = obj => Boolean(obj && obj.constructor === Object);

module.exports = {
  isEmptyObject,
  isString,
  isArray,
  isPlainObject,
};
