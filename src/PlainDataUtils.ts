export function getAmiiboId(plainData: number[]): string {
    return plainData.slice(0x1DC, 0x1E3 + 1).map((a) => a.toString(16).padStart(2, '0')).join('');
}

export function getCharacterId(plainData: number[]): string {
    return plainData.slice(0x1DC, 0x1DD + 1).map((a) => a.toString(16).padStart(2, '0')).join('');
}

export function getGameSeriesId(plainData: number[]): string {
    return plainData.slice(0x1DC, 0x1DD + 1).map((a) => a.toString(16).padStart(2, '0')).join('').substr(0, 3);
}

export function getNickName(plainData: number[]): string {
    let nameBuffer = plainData.slice(0x38, 0x4B + 1);
    for(let i = 0; i < nameBuffer.length; i += 2) {
        let tmp = nameBuffer[i];
        nameBuffer[i] = nameBuffer[i + 1];
        nameBuffer[i + 1] = tmp;
    }
    return decodeUtf16(new Uint16Array(new Uint8Array(nameBuffer).buffer));
}

export function getMiiName(plainData: number[]): string {
    let nameBuffer = plainData.slice(0x66, 0x79 + 1);
    return decodeUtf16(new Uint16Array(new Uint8Array(nameBuffer).buffer));
}

//https://gist.github.com/also/912792
function decodeUtf16(w: Uint16Array): string {
    let i = 0;
    let len = w.length;
    let charCodes = [];
    while (i < len) {
        let w1 = w[i++];
        if (w1 === 0x0)
            break;
        if ((w1 & 0xF800) !== 0xD800) { // w1 < 0xD800 || w1 > 0xDFFF
            charCodes.push(w1);
            continue;
        }
        if ((w1 & 0xFC00) === 0xD800) { // w1 >= 0xD800 && w1 <= 0xDBFF
            throw new RangeError('Invalid octet 0x' + w1.toString(16) + ' at offset ' + (i - 1));
        }
        if (i === len) {
            throw new RangeError('Expected additional octet');
        }
        let w2 = w[i++];
        if ((w2 & 0xFC00) !== 0xDC00) { // w2 < 0xDC00 || w2 > 0xDFFF)
            throw new RangeError('Invalid octet 0x' + w2.toString(16) + ' at offset ' + (i - 1));
        }
        charCodes.push(((w1 & 0x3ff) << 10) + (w2 & 0x3ff) + 0x10000);
    }
    return String.fromCharCode.apply(String, charCodes);
}