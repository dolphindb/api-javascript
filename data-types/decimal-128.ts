import { BigInt128Array } from '../shared/bigint-128-array.js'
import { nulls } from '../shared/constants.js'
import { getBigInt128 } from '../shared/data-view-extends.js'

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
