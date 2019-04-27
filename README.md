# maboii.js
amiibo™ encryption/decryption library.
This library is a port of the encryption/decryption code from [socram8888/amiitool](https://github.com/socram8888/amiitool).

## How to use
### Install the package
```bash
npm install maboii
```

### Load the keys
```js
const maboii = require('maboii');
const fs = require('fs');

// Read keys from file
let fileBuffer = fs.readFileSync('./keys.bin');
const keys = maboii.loadMasterKeys([...fileBuffer]);
```

### Decrypt dump
```js
// Read dump from file
let dumpFileBuffer = fs.readFileSync('./dumpFile.bin')
let unpackResult = maboii.unpack(keys, [...dumpFileBuffer]);

// If decrypt is successful
if (unpackResult.result) {
    // The plain data is available through unpackResult.unpacked
}
```

### Encrypt plain data
```js
// Read plain dump from file
let plainDumpFileBuffer = fs.readFileSync('./dumpFile.dec.bin')
let packedResult = maboii.pack(keys, [...plainDumpFileBuffer]);
```

### Read information from plain data
```js
const maboii = require('maboii');
const fs = require('fs')

// Read plain dump from file
let plain = [...fs.readFileSync('./dumpFile.dec.bin')]; // Let's read an Inkling dump

maboii.plainDataUtils.getAmiiboId(plain); // Returns '0800010003820002'
maboii.plainDataUtils.getCharacterId(plain); // Returns '0800'
maboii.plainDataUtils.getGameSeriesId(plain); // Returns '080'
maboii.plainDataUtils.getMiiName(plain); // Returns the Mii name as string, in my case 'Holo' from my dump
maboii.plainDataUtils.getNickName(plain); // Returns the amiibo™ name as string, in my case 'Sushy' from my dump
```

## Credits
- socram8888 - Author of amiitool
- AcK77 - Author of AmiiBomb which helped me a lot to test