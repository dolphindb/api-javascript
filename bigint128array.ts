import { nulls } from './common.js'


/** https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/SharedArrayBuffer#security_requirements
    SharedArrayBuffer is disabled by default in most browsers as a security precaution to avoid Spectre attacks.
    But it's still available in Node.js or some browsers. */
const HAS_SHARED_ARRAY_BUFFER = typeof SharedArrayBuffer !== 'undefined'


export class BigInt128Array {
    static of (...items: bigint[]): BigInt128Array {
        return new BigInt128Array(items)
    }
    
    
    static from (arrayLike: ArrayLike<bigint>): BigInt128Array
    static from<U>(arrayLike: ArrayLike<U>, mapfn: (v: U, k: number) => bigint, thisArg?: any): BigInt128Array
    static from<U>(arrayLike: ArrayLike<U>, mapfn?: (v: U, k: number) => bigint, thisArg?: any) {
        if (mapfn) {
            const array: bigint[] = [ ]
            for (let i = 0;  i < arrayLike.length;  i++) 
                array.push(mapfn.call(thisArg, arrayLike[i], i))
            
            return new BigInt128Array(array)
        } else {
            const v = new BigInt128Array(arrayLike.length)
            v.set(arrayLike as ArrayLike<bigint>)
        }
    }
    
    
    readonly BYTES_PER_ELEMENT: number = 16
    readonly buffer: ArrayBufferLike
    readonly byteLength: number
    readonly byteOffset: number
    
    
    constructor (length?: number)
    constructor (array: Iterable<bigint>)
    constructor (buffer: ArrayBufferLike, byteOffset?: number, length?: number)
    constructor (fisrtArg: number | Iterable<bigint> | ArrayBufferLike, byteOffset?: number, length?: number) {
        if (typeof fisrtArg === 'number') {
            const length = fisrtArg
            this.buffer = new ArrayBuffer(length * this.BYTES_PER_ELEMENT)
            this.byteOffset = 0
            this.byteLength = length * this.BYTES_PER_ELEMENT
        } else if (fisrtArg instanceof ArrayBuffer || (HAS_SHARED_ARRAY_BUFFER && fisrtArg instanceof SharedArrayBuffer)) {
            this.buffer = fisrtArg
            this.byteOffset = byteOffset ?? 0
            
            let byteLength = 0
            if (length !== undefined) {
                byteLength = length * this.BYTES_PER_ELEMENT
                if (byteLength + this.byteOffset > fisrtArg.byteLength) 
                    throw new RangeError(`valid typed array length: ${length}`)
            } else {
                byteLength = fisrtArg.byteLength - this.byteOffset
                if (byteLength % this.BYTES_PER_ELEMENT !== 0) 
                    throw new RangeError('byte length of BigInt128Array should be a multiple of 16')
            }
            
            this.byteLength = byteLength
        } else {
            const array: bigint[] = [ ]
            for (const value of fisrtArg as Iterable<bigint>) 
                array.push(value)
            
            this.buffer = new ArrayBuffer(array.length * this.BYTES_PER_ELEMENT)
            this.byteOffset = 0
            this.byteLength = array.length * this.BYTES_PER_ELEMENT
            this.set(array)
        }
        
        return new Proxy(this, {
            get (target, key) {
                if (typeof key === 'string') {
                    const index = Number(key)
                    // only positive integer index is allowed
                    if (Number.isInteger(index) && index >= 0 && index < target.length) 
                        return target.at(index)
                }
                
                return Reflect.get(target, key)
            },
            
            set (target, key, value) {
                if (typeof key === 'string') {
                    const index = Number(key)
                    if (Number.isInteger(index) && index >= 0 && index < target.length) 
                        target.set([value], index)
                    
                    // ignore invalid number index setter, and never set value to target
                    return true
                }
                
                return Reflect.set(target, key, value)
            }
        })
    }
    
    
    get length () {
        return this.byteLength / this.BYTES_PER_ELEMENT
    }
    
    
    set (array: ArrayLike<bigint>, offset: number = 0) {
        if (offset + array.length > this.length) 
            throw new RangeError('offset is out of bounds')
        
        const dv = new DataView(this.buffer)
        for (let i = 0;  i < array.length;  i++) {
            const byteOffset = this.byteOffset + (offset + i) * this.BYTES_PER_ELEMENT
            setBigInt128(dv, byteOffset, array[i])
        }
    }
    
    
    at (index: number) {
        const length = this.length
        
        if (index < 0) 
            index += length
        
        if (index >= length || index < 0)
            return undefined
        
        const dv = new DataView(this.buffer)
        return getBigInt128(dv, this.byteOffset + index * this.BYTES_PER_ELEMENT)
    }
    
    
    subarray (begin: number = 0, end: number = this.length) {
        const length = this.length
        // subarray arguments should be the same behavior as other TypedArray
        // https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/TypedArray/subarray#%E8%AF%B4%E6%98%8E
        if (begin < 0)
            begin += length
        
        if (end < 0)
            end += length
        
        if (begin < 0)
            begin = 0
        else if (begin > length)
            begin = length
        
        if (end < 0)
            end = 0
        else if (end > length)
            end = length
        
        const newLength = Math.max(end - begin, 0)
        return new BigInt128Array(this.buffer, this.byteOffset + begin * this.BYTES_PER_ELEMENT, newLength)
    }
    
    
    [Symbol.iterator] () {
        let index = 0
        const array = this
        return {
            next () {
                if (index < array.length) 
                    return { value: array.at(index++), done: false }
                else 
                    return { done: true }
            },
        }
    }
    
    
    toString () {
        const values: bigint[] = [ ]
        for (const value of this) 
            values.push(value)
        return values.join(',')
    }
}


Object.defineProperty(BigInt128Array.prototype, Symbol.toStringTag, {
    configurable: false,
    writable: false,
    enumerable: false,
    value: 'BigInt128Array',
})


export interface DdbDecimal128Value {
    /** int32, data 需要除以 10^scale 得到原值  data needs to be divided by 10^scale to get the original value */
    scale: number
    
    /** int128, 空值为 null  empty value is null */
    data: bigint | null
}

export interface DdbDecimal128VectorValue {
    scale: number
    
    data: BigInt128Array
}


export const DdbDecimal128Serializor = {
    /** 解析为标量 */
    parse_as_scalar (buf: Uint8Array, le: boolean): [number, DdbDecimal128Value] {
        const dv = new DataView(buf.buffer, buf.byteOffset)
                
        const data = getBigInt128(dv, 4, le)
        
        return [20, { scale: dv.getInt32(0, le), data: data === nulls.int128 ? null : data }]
    },
    
    
    /** 解析为仅由同类数据组成的 vector 的值 */
    parse_as_same_type_vector_values (buf: Uint8Array, byte_offset: number, items_length: number): [number, BigInt128Array] {
        const bytes_length = items_length * 16
        const data = new BigInt128Array(buf.buffer.slice(buf.byteOffset + byte_offset, buf.byteOffset + byte_offset + bytes_length))
        return [bytes_length, data]
    },
    
    
    /** 解析为 vector 中的单独项 */
    parse_as_vector_items (buf: Uint8Array, length: number, le: boolean): [number, DdbDecimal128VectorValue] {
        const dv = new DataView(
            buf.buffer,
            buf.byteOffset
        )
        
        return [
            4 + 16 * length,
            {
                scale: dv.getInt32(0, le),
                data: new BigInt128Array(
                    buf.buffer.slice(
                        buf.byteOffset + 4,
                        buf.byteOffset + 4 + 16 * length
                    )
                )
            } as DdbDecimal128VectorValue
        ]
    },
    
    
    /** 序列化 */
    pack (value: DdbDecimal128Value): [Int32Array, BigInt128Array] {
        const { scale, data } = value
        return [Int32Array.of(scale), BigInt128Array.of(data === null ? nulls.int128 : data)]
    }
}


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

