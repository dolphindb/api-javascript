// DataView Extends for bigint 128 operations
export function getBigUint128 (dataView: DataView, byteOffset: number, littleEndian: boolean = true) {
    let cursor = byteOffset + (littleEndian ? 15 : 0)
    const end = byteOffset + (littleEndian ? -1 : 16)
    const step = littleEndian ? -1 : 1
    let value = 0n
    
    while (cursor !== end) {
        value = value << 8n | BigInt(dataView.getUint8(cursor))
        cursor += step
    }
    
    return value
}

export function getBigInt128 (dataView: DataView, byteOffset: number, littleEndian: boolean = true) {
    return BigInt.asIntN(128, getBigUint128(dataView, byteOffset, littleEndian))
}


export function setBigUint128 (dataView: DataView, byteOffset: number, value: bigint, littleEndian: boolean = true) {
    let cursor = byteOffset + (littleEndian ? 0 : 15)
    const end = byteOffset + (littleEndian ? 16 : -1)
    const step = littleEndian ? 1 : -1
    
    while (cursor !== end) {
        dataView.setUint8(cursor, Number(value & 0xffn))
        value = value >> 8n
        cursor += step
    }
}

export function setBigInt128 (dataView: DataView, byteOffset: number, value: bigint, littleEndian: boolean = true) {
    setBigUint128(dataView, byteOffset, value, littleEndian)
}

// 大端
// const dataBE = new ArrayBuffer(16)
// const dataViewBE = new DataView(dataBE)
// setBigInt128(dataViewBE, 0, -34355n, false)
// console.log(dataViewBE.buffer)
// const bigInt128BE = getBigInt128(dataViewBE, 0, false)
// const bigUint128BE = getBigUint128(dataViewBE, 0, false)
// console.log(bigInt128BE.toString(), bigUint128BE.toString())

// 小端
// const dataLE = new ArrayBuffer(16)
// const dataViewLE = new DataView(dataLE)
// setBigInt128(dataViewLE, 0, -34355n, true)
// console.log(dataViewLE.buffer)
// const bigInt128LE = getBigInt128(dataViewLE, 0, true)
// const bigUint128LE = getBigUint128(dataViewLE, 0, true)
// console.log(bigInt128LE.toString(), bigUint128LE.toString())
