'use strict';

const test = require('node:test');
const assert = require('node:assert');
const {PacketsDecoder} = require('../../lib/decoder');

test('decode single packet', async (t) => {
  const testCases = [
    {
      encoded:
        '000000680103066461656d6f6e0006636861726f6e030776657273696f6e0005352e382e3203077379736e616d6500054c696e757803077' +
        '2656c65617365001b342e31392e3130342d6d6963726f736f66742d7374616e6461726403076d616368696e6500067838365f3634',
      expected: {
        size: 104,
        type: 1,
        event: null,
        payload: {
          daemon: 'charon',
          version: '5.8.2',
          sysname: 'Linux',
          release: '4.19.104-microsoft-standard',
          machine: 'x86_64'
        }
      }
    },
    {
      encoded:
        '0000031a010106757074696d65030772756e6e696e670008333820686f757273030573696e636500144465632032312030303a30393a33352032303234020107' +
        '776f726b6572730305746f74616c00023136030469646c650002313101066163746976650308637269746963616c00013403046869676800013003066d656469' +
        '756d00013103036c6f77000130020201067175657565730308637269746963616c00013003046869676800013003066d656469756d00013003036c6f77000130' +
        '0203097363686564756c65640001300106696b657361730305746f74616c000130030968616c662d6f70656e000130020407706c7567696e7305000663686172' +
        '6f6e05000c746573742d766563746f72730500046c646170050006706b637331310500056165736e690500036165730500037263320500047368613205000473' +
        '6861310500036d64350500046d676631050006726472616e6405000672616e646f6d0500056e6f6e63650500047835303905000a7265766f636174696f6e0500' +
        '0b636f6e73747261696e74730500067075626b6579050005706b637331050005706b637337050005706b637338050006706b6373313205000370677005000664' +
        '6e736b65790500067373686b657905000370656d0500076f70656e73736c05000667637279707405000661662d616c67050008666970732d707266050003676d' +
        '7005000a637572766532353531390500056167656e74050007636861706f6c7905000478636263050004636d6163050004686d61630500036374720500036363' +
        '6d05000367636d0500046e747275050004647262670500046375726c0500046174747205000e6b65726e656c2d6e65746c696e6b0500077265736f6c76650500' +
        '0e736f636b65742d64656661756c74050008636f6e6e6d61726b0500067374726f6b65050004766963690500067570646f776e05000c6561702d6d7363686170' +
        '763205000d78617574682d67656e65726963050008636f756e746572730601086d616c6c696e666f03047362726b00073239353733313203046d6d6170000130' +
        '030475736564000639303132383003046672656500073230353630333202',
      expected: {
        size: 794,
        type: 1,
        event: null,
        payload: {
          uptime: { running: '38 hours', since: 'Dec 21 00:09:35 2024' },
          workers: {
            total: '16',
            idle: '11',
            active: { critical: '4', high: '0', medium: '1', low: '0' }
          },
          queues: { critical: '0', high: '0', medium: '0', low: '0' },
          scheduled: '0',
          ikesas: { total: '0', 'half-open': '0' },
          plugins: [
            'charon',       'test-vectors',   'ldap',
            'pkcs11',       'aesni',          'aes',
            'rc2',          'sha2',           'sha1',
            'md5',          'mgf1',           'rdrand',
            'random',       'nonce',          'x509',
            'revocation',   'constraints',    'pubkey',
            'pkcs1',        'pkcs7',          'pkcs8',
            'pkcs12',       'pgp',            'dnskey',
            'sshkey',       'pem',            'openssl',
            'gcrypt',       'af-alg',         'fips-prf',
            'gmp',          'curve25519',     'agent',
            'chapoly',      'xcbc',           'cmac',
            'hmac',         'ctr',            'ccm',
            'gcm',          'ntru',           'drbg',
            'curl',         'attr',           'kernel-netlink',
            'resolve',      'socket-default', 'connmark',
            'stroke',       'vici',           'updown',
            'eap-mschapv2', 'xauth-generic',  'counters'
          ],
          mallinfo: { sbrk: '2957312', mmap: '0', used: '901280', free: '2056032' }
        }
      }
    },
    {
      encoded: 
        '000001d207096c6973742d636f6e6e01057465737431040b6c6f63616c5f616464727305000425616e7906040c72656d6f74655f616464727305000425616e79' +
        '06030776657273696f6e0007494b4576312f32030b7265617574685f74696d6500053130323630030a72656b65795f74696d650001300306756e69717565000e' +
        '554e495155455f5245504c414345030b6470645f74696d656f7574000331353001076c6f63616c2d310305636c617373000a7075626c6963206b657904066772' +
        '6f75707306040b636572745f706f6c6963790604056365727473060407636163657274730602010872656d6f74652d310305636c617373000a7075626c696320' +
        '6b6579040667726f75707306040b636572745f706f6c696379060405636572747306040763616365727473060201086368696c6472656e010574657374310304' +
        '6d6f6465000654554e4e454c030a72656b65795f74696d65000433303630030b72656b65795f6279746573000130030d72656b65795f7061636b657473000130' +
        '030a6470645f616374696f6e0005636c656172030c636c6f73655f616374696f6e0005636c65617204086c6f63616c2d747305000764796e616d696306040972' +
        '656d6f74652d747305000764796e616d696306020202',
      expected: {
        size: 466,
        type: 7,
        event: 'list-conn',
        payload: {
          test1: {
            local_addrs: [ '%any' ],
            remote_addrs: [ '%any' ],
            version: 'IKEv1/2',
            reauth_time: '10260',
            rekey_time: '0',
            unique: 'UNIQUE_REPLACE',
            dpd_timeout: '150',
            'local-1': {
              class: 'public key',
              groups: [],
              cert_policy: [],
              certs: [],
              cacerts: []
            },
            'remote-1': {
              class: 'public key',
              groups: [],
              cert_policy: [],
              certs: [],
              cacerts: []
            },
            children: {
              test1: {
                mode: 'TUNNEL',
                rekey_time: '3060',
                rekey_bytes: '0',
                rekey_packets: '0',
                dpd_action: 'clear',
                close_action: 'clear',
                'local-ts': [ 'dynamic' ],
                'remote-ts': [ 'dynamic' ]
              }
            }
          }
        }
      }
    },
    {
      encoded: '0000000101`',
      expected: {
        size: 1,
        type: 1,
        event: null,
        payload: {}
      }
    },
    {
      encoded: '0000000102',
      expected: {
        size: 1,
        type: 2,
        event: null,
        payload: {}
      }
    },
    {
      encoded: '0000000105',
      expected: {
        size: 1,
        type: 5,
        event: null,
        payload: {}
      }
    },
  ];

  for (const tc of testCases) {
    await t.test(`packet ${tc.encoded.slice(0, 16)}...`, () => {
      const decoder = new PacketsDecoder();

      assert.deepStrictEqual(
        decoder.decode(Buffer.from(tc.encoded, 'hex')),
        [tc.expected],
      );
    })
  }
});
