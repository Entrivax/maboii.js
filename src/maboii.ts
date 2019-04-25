import { MasterKeys, MasterKey } from './MasterKeys';
import { DerivedKeys } from './DerivedKeys';
import crypto from 'crypto';

const HMAC_POS_DATA = 0x008
const HMAC_POS_TAG = 0x1B4
const NFC3D_AMIIBO_SIZE = 540;

export function loadMasterKeys(key: number[]): MasterKeys|null {
    let dataKey = readMasterKey(key, 0);
    let tagKey = readMasterKey(key, 80);

    if (dataKey.magicBytesSize > 16
        || tagKey.magicBytesSize > 16) {
            return null;
        }
    
    return new MasterKeys(dataKey, tagKey);
}

function readMasterKey(buffer: number[], offset: number): MasterKey {
    let hmacKey = [];
    let typeString = [];
    let rfu;
    let magicBytesSize;
    let magicBytes = [];
    let xorPad = [];

    let reader = new ArrayReader(buffer);

    for (let i = 0; i < 16; i++)
        hmacKey[i] = reader.readUInt8(offset + i);
    for (let i = 0; i < 14; i++)
        typeString[i] = reader.readInt8(offset + i + 16);
    rfu = reader.readUInt8(offset + 16 + 14);
    magicBytesSize = reader.readUInt8(offset + 16 + 14 + 1);
    for (let i = 0; i < 16; i++)
        magicBytes[i] = reader.readUInt8(offset + i + 16 + 14 + 1 + 1);
    for (let i = 0; i < 32; i++)
        xorPad[i] = reader.readUInt8(offset + i + 16 + 14 + 1 + 1 + 16);

    return {
        hmacKey,
        typeString,
        rfu,
        magicBytesSize,
        magicBytes,
        xorPad,
    }
}

class ArrayReader {
    private uint8: Uint8Array;
    private int8: Int8Array;
    constructor(buffer: number[]) {
        this.uint8 = new Uint8Array(buffer);
        this.int8 = new Int8Array(buffer);
    }

    readUInt8(index: number): number {
        return this.uint8[index];
    }

    readInt8(index: number): number {
        return this.int8[index];
    }
}

export function unpack(amiiboKeys: MasterKeys, tag: number[]) {
    let unpacked = new Array(NFC3D_AMIIBO_SIZE).fill(0);
    let result = false;
    let internal = new Array(NFC3D_AMIIBO_SIZE).fill(0);
    let dataKeys = new DerivedKeys();
    let tagKeys = new DerivedKeys();

    // Convert format
    tagToInternal(tag, internal);

    // Generate keys
    amiiboKeygen(amiiboKeys.data, internal, dataKeys);
    amiiboKeygen(amiiboKeys.tag, internal, tagKeys);

    // Decrypt
    amiiboCipher(dataKeys, internal, unpacked);

    // Regenerate tag HMAC. Note: order matters, data HMAC depends on tag HMAC!
    computeHmac(tagKeys.hmacKey, unpacked, 0x1D4, 0x34, unpacked, HMAC_POS_TAG);

    // Regenerate data HMAC
    computeHmac(dataKeys.hmacKey, unpacked, 0x029, 0x1DF, unpacked, HMAC_POS_DATA);

    memcpy(unpacked, 0x208, tag, 0x208, 0x14);

    result = memcmp(unpacked, HMAC_POS_DATA, internal, HMAC_POS_DATA, 32) == 0 &&
        memcmp(unpacked, HMAC_POS_TAG, internal, HMAC_POS_TAG, 32) == 0;

    return {
        unpacked,
        result,
    }
}

export function pack(amiiboKeys: MasterKeys, plain: number[]): number[] {
    let packed = new Array(NFC3D_AMIIBO_SIZE).fill(0);
    let cipher = new Array(NFC3D_AMIIBO_SIZE).fill(0);
    let dataKeys = new DerivedKeys();
    let tagKeys = new DerivedKeys();

    // Generate keys
    amiiboKeygen(amiiboKeys.tag, plain, tagKeys);
    amiiboKeygen(amiiboKeys.data, plain, dataKeys);

    // Generated tag HMAC
    computeHmac(tagKeys.hmacKey, plain, 0x1D4, 0x34, cipher, HMAC_POS_TAG);

    // Generate data HMAC
    let hmacBuffer = ([] as number[]).concat(
        plain.slice(0x029, 0x029 + 0x18B),
        cipher.slice(HMAC_POS_TAG, HMAC_POS_TAG + 0x20),
        plain.slice(0x1D4, 0x1D4 + 0x34));
    computeHmac(dataKeys.hmacKey, hmacBuffer, 0, hmacBuffer.length, cipher, HMAC_POS_DATA);

    // Encrypt
    amiiboCipher(dataKeys, plain, cipher);

    // Convert back to hardware
    internalToTag(cipher, packed);

    memcpy(packed, 0x208, plain, 0x208, 0x14);

    return packed;
}

function memcmp(s1: any[], s1Offset: number, s2: any[], s2Offset: number, size: number): number {
    for (let i = 0; i < size; i++) {
        if (s1[s1Offset + i] !== s2[s2Offset + i]) {
            return s1[s1Offset + i] - s2[s2Offset + i];
        }
    }
    return 0;
}

function memcpy(destination: any[]|DerivedKeys, destinationOffset: number, source: any[], sourceOffset: number, length: number) {
    let setDestinationByte: (destination: any[] & DerivedKeys, i: number, value: any) => void = Array.isArray(destination) ?
        (destination: any[], i: number, value: any): void => {
            destination[i] = value;
        } : (destination: DerivedKeys, i: number, value: any): void => {
            destination.setByte(i, value);
        };
    let getSourceByte: (destination: any[] & DerivedKeys, i: number) => any = Array.isArray(source) ?
        (source: any[], i: number): any => {
            return source[i];
        } : (source: DerivedKeys, i: number): number => {
            return source.getByte(i);
        };

    for (let i = 0; i < length; i++) {
        setDestinationByte(<any>destination, destinationOffset + i, getSourceByte(<any>source, sourceOffset + i));
    }
}

function memccpy(destination: any[], destinationOffset: number, source: any[], sourceOffset: number, character: any, length: number) {
    for (let i = 0; i < length; i++) {
        destination[destinationOffset + i] = source[sourceOffset + i];
        if (source[sourceOffset + i] == character) {
            return destinationOffset + i + 1;
        }
    }
    return null;
}

function memset(destination: any[], destinationOffset: number, data: any, length: number) {
    for (let i = 0; i < length; i++) {
        destination[destinationOffset + i] = data;
    }
}

function amiiboKeygen(masterKey: MasterKey, internalDump: number[], derivedKeys: DerivedKeys) {
    let seed: number[] = [];

    amiiboCalcSeed(internalDump, seed);
    keygen(masterKey, seed, derivedKeys);
}

function amiiboCalcSeed(internaldump: number[], seed: number[]) {
    memcpy(seed, 0x00, internaldump, 0x029, 0x02);
	memset(seed, 0x02, 0x00, 0x0E);
	memcpy(seed, 0x10, internaldump, 0x1D4, 0x08);
	memcpy(seed, 0x18, internaldump, 0x1D4, 0x08);
	memcpy(seed, 0x20, internaldump, 0x1E8, 0x20);
}

function tagToInternal(tag: number[], internal: number[]) {
	memcpy(internal, 0x000, tag, 0x008, 0x008);
	memcpy(internal, 0x008, tag, 0x080, 0x020);
	memcpy(internal, 0x028, tag, 0x010, 0x024);
	memcpy(internal, 0x04C, tag, 0x0A0, 0x168);
	memcpy(internal, 0x1B4, tag, 0x034, 0x020);
	memcpy(internal, 0x1D4, tag, 0x000, 0x008);
	memcpy(internal, 0x1DC, tag, 0x054, 0x02C);
}

function internalToTag(internal: number[], tag: number[]) {
	memcpy(tag, 0x008, internal, 0x000, 0x008);
	memcpy(tag, 0x080, internal, 0x008, 0x020);
	memcpy(tag, 0x010, internal, 0x028, 0x024);
	memcpy(tag, 0x0A0, internal, 0x04C, 0x168);
	memcpy(tag, 0x034, internal, 0x1B4, 0x020);
	memcpy(tag, 0x000, internal, 0x1D4, 0x008);
	memcpy(tag, 0x054, internal, 0x1DC, 0x02C);
}

function keygen(baseKey: MasterKey, baseSeed: number[], derivedKeys: DerivedKeys) {
    let preparedSeed: number[] = [];
    keygenPrepareSeed(baseKey, baseSeed, preparedSeed);
    drbgGenerateBytes(baseKey.hmacKey, preparedSeed, derivedKeys);
}

function keygenPrepareSeed(baseKey: MasterKey, baseSeed: number[], output: number[]) {
    // 1: Copy whole type string
    let outputOffset = <number>memccpy(output, 0, baseKey.typeString, 0, 0, 14);

    // 2: Append (16 - magicBytesSize) from the input seed
    let leadingSeedBytes = 16 - baseKey.magicBytesSize;
    memcpy(output, outputOffset, baseSeed, 0, leadingSeedBytes);
    outputOffset += leadingSeedBytes;

    // 3: Append all bytes from magicBytes
    memcpy(output, outputOffset, baseKey.magicBytes, 0, baseKey.magicBytesSize);
    outputOffset += baseKey.magicBytesSize;

    // 4: Append bytes 0x10-0x1F from input seed
    memcpy(output, outputOffset, baseSeed, 0x10, 16);
    outputOffset += 16;

    // 5: Xor last bytes 0x20-0x3F of input seed with AES XOR pad and append them
    for (let i = 0; i < 32; i++) {
        output[outputOffset + i] = baseSeed[i + 32] ^ baseKey.xorPad[i];
    }
    outputOffset += 32;

    return outputOffset;
}

function drbgGenerateBytes(hmacKey: number[], seed: number[], output: DerivedKeys) {
    const DRBG_OUTPUT_SIZE = 32;
    let outputSize = 48;
    let outputOffset = 0;
    let temp: number[] = [];

    let iterationCtx = { iteration: 0 };
    while (outputSize > 0) {
        if (outputSize < DRBG_OUTPUT_SIZE) {
            drbgStep(initHmac(hmacKey, iterationCtx.iteration, seed), temp, 0, iterationCtx);
            memcpy(output, outputOffset, temp, 0, outputSize);
            break;
        }

        drbgStep(initHmac(hmacKey, iterationCtx.iteration, seed), output, outputOffset, iterationCtx);
        outputOffset += DRBG_OUTPUT_SIZE;
        outputSize -= DRBG_OUTPUT_SIZE;
    }
}

function initHmac(hmacKey: number[], iteration: number, seed: number[]): crypto.Hmac {
    let hmac = crypto.createHmac('sha256', new Uint8Array(hmacKey));
    hmac.update(new Uint8Array([(iteration >> 8) & 0x0f, (iteration >> 0) & 0x0f].concat(seed)));
    return hmac;
}

function drbgStep(hmac: crypto.Hmac, output: DerivedKeys|number[], outputOffset: number, iterationCtx: { iteration: number }) {
    iterationCtx.iteration++;
    let buf = hmac.digest('latin1');
    memcpy(output, outputOffset, Array.from(buf).map((a) => '' + a.charCodeAt(0)), 0, buf.length);
}

function amiiboCipher(keys: DerivedKeys, input: number[], output: number[]) {
    let cipher = crypto.createCipheriv('aes-128-ctr', new Uint8Array(keys.aesKey), new Uint8Array(keys.aesIV));
    let buf = Array.from(cipher.update(new Uint8Array(input).subarray(0x02C, 0x02C + 0x188)));

    memcpy(output, 0x02C, buf, 0, 0x188);

    memcpy(output, 0, input, 0, 0x008);
    memcpy(output, 0x028, input, 0x028, 0x004);
    memcpy(output, 0x1D4, input, 0x1D4, 0x034);
}

function computeHmac(hmacKey: number[], input: number[], inputOffset: number, inputLength: number, output: number[], outputOffset: number) {
    let hmac = crypto.createHmac('sha256', new Uint8Array(hmacKey));
    let result = Array.from(hmac.update(new Uint8Array(input).subarray(inputOffset, inputOffset + inputLength)).digest());
    memcpy(output, outputOffset, result, 0, result.length);
}