import dayjs from 'dayjs'
import DayjsCustomParseFormat from 'dayjs/plugin/customParseFormat.js'
dayjs.extend(DayjsCustomParseFormat)

import ipaddrjs from 'ipaddr.js'
const { fromByteArray: buf2ipaddr } = ipaddrjs

import 'xshell/prototype.browser.js'
import { blue, cyan, green, grey, magenta } from 'xshell/chalk.browser.js'
import { concat, assert, Lock, genid } from 'xshell/utils.browser.js'
import { connect_websocket, type WebSocketConnectionError } from 'xshell/net.browser.js'

import { t } from './i18n/index.js'

import { DdbDecimal128Serializor, type DdbDecimal128Value, type DdbDecimal128VectorValue } from './data-types/decimal-128.js'
import type { BigInt128Array } from './shared/bigint-128-array.js'
import { is_decimal_type, is_decimal_null_value } from './shared/utils/decimal-type.js'

import { nulls, DdbChartType, DdbDurationUnit, DdbForm, DdbFunctionType, DdbType } from './shared/constants.js'
export * from './shared/constants.js'

export type { DdbDecimal128Value, DdbDecimal128VectorValue } from './data-types/decimal-128.js'

export interface DdbFunctionDefValue {
    type: DdbFunctionType
    name: string
}

export interface DdbDurationValue {
    unit: DdbDurationUnit
    
    /** int32 */
    data: number
}


export interface DdbDecimal32Value {
    /** int32, data 需要除以 10^scale 得到原值  data needs to be divided by 10^scale to get the original value */
    scale: number
    
    /** int32, 空值为 null  ddb null is js null */
    data: number | null
}

export interface DdbDecimal64Value {
    /** int32, data 需要除以 10^scale 得到原值  data needs to be divided by 10^scale to get the original value */
    scale: number
    
    /** int64, 空值为 null  empty value is null */
    data: bigint | null
}

export interface DdbDecimal32VectorValue {
    scale: number
    
    data: Int32Array
}

export interface DdbDecimal64VectorValue {
    scale: number
    
    data: BigInt64Array
}

export type DdbDurationVectorValue = DdbDurationValue[]

export interface DdbSymbolExtendedValue {
    base_id: number
    base: string[]
    data: Uint32Array
}

export interface DdbArrayVectorBlock {
    unit: 1 | 2 | 4
    rows: number
    lengths: Uint8Array | Uint16Array | Uint32Array
    data: Int8Array | Int16Array | Int32Array | Float32Array | Float64Array | BigInt64Array | BigInt128Array
}

export type DdbArrayVectorValue = DdbArrayVectorBlock[] & /* decimal 数据会有这个属性 */ { scale?: number }

export interface DdbMatrixValue {
    rows: DdbVectorObj
    cols: DdbVectorObj
    data: DdbVectorValue
}

export type DdbDictValue = [DdbVectorObj, DdbVectorObj]

export interface DdbChartValue {
    /** 原属性 chartType  original: chartType */
    type: DdbChartType
    
    stacking: boolean
    
    /** 直方图 (Histogram), plotHist 函数返回的 chart 可能具有该属性  
        原属性 binStart  
        数值类型的 DdbObj 都有可能？  
    */
    bin_start?: DdbObj
    
    /** 原属性 binEnd */
    bin_end?: DdbObj
    
    /** 原属性 binCount */
    bin_count?: DdbObj
    
    titles: {
        chart: string
        x_axis: string
        y_axis: string
    }
    
    extras?: {
        multi_y_axes: boolean
    }
    
    data: DdbMatrixObj
}

export type DdbScalarValue = 
    null | boolean | number | bigint | string |
    Uint8Array | // uuid, ipaddr, int128, blob
    [number, number] | // complex, point
    DdbFunctionDefValue |
    DdbDurationValue | 
    DdbDecimal32Value | DdbDecimal64Value | DdbDecimal128Value

export type DdbVectorValue = 
    null |
    Uint8Array | Int8Array | Int16Array | Int32Array | Float32Array | Float64Array | BigInt64Array | BigInt128Array |
    string[] | // string[]
    Uint8Array[] | // blob
    DdbObj[] | // any
    DdbSymbolExtendedValue | 
    DdbArrayVectorValue |
    DdbDecimal32VectorValue | DdbDecimal64VectorValue | DdbDecimal128VectorValue |
    DdbDurationVectorValue

export type DdbValue = DdbScalarValue | DdbVectorValue | DdbMatrixValue | DdbDictValue | DdbChartValue


export type DdbStringObj = DdbObj<string>

export type DdbVectorObj <TValue extends DdbVectorValue = DdbVectorValue> = DdbObj<TValue>

export type DdbVectorAnyObj = DdbVectorObj<DdbObj[]>
export type DdbVectorStringObj = DdbVectorObj<string[]>

export type DdbTableObj <TColumns extends DdbVectorObj[] = DdbVectorObj[]> = DdbObj<TColumns>

export type DdbDictObj <TKeys extends DdbVectorObj = DdbVectorObj, TValues extends DdbVectorObj = DdbVectorObj> = DdbObj<[TKeys, TValues]>

export type DdbMatrixObj <TValue extends DdbMatrixValue = DdbMatrixValue> = DdbObj<TValue>

export type DdbChartObj = DdbObj<DdbChartValue>


/** 可以表示所有 DolphinDB 数据库中的数据类型  Can represent data types in all DolphinDB databases */
export class DdbObj <TValue extends DdbValue = DdbValue> {
    static dec = new TextDecoder('utf-8')
    
    static enc = new TextEncoder()
    
    /** 维护已解析的 symbol base，比如流数据中后续的 symbol 向量可能只发送一个 base.id, base.size == 0, 依赖之前发送的 symbol base ？
        只是暂存，如果一张表有多个 symbol 列，可能这个 symbol base 会被复用，不同的对象之间 symbol base 一般不复用
    */
    static symbol_bases: Record<number, string[]> = { }
    
    /** little endian (client) */
    static le_client = Boolean(
        new Uint8Array(
            Uint32Array.of(1).buffer
        )[0]
    )
    
    /** 是否为小端 (little endian) */
    le = DdbObj.le_client
    
    /** 数据形式 https://www.dolphindb.cn/cn/help/DataTypesandStructures/DataForms/index.html */
    form: DdbForm
    
    /** 数据类型 https://www.dolphindb.cn/cn/help/DataTypesandStructures/DataTypes/index.html */
    type: DdbType
    
    /** 占用 parse 时传入的 buf 的长度 */
    length: number
    
    /** table name / column name */
    name?: string
    
    /**
        最低维、第 1 维
        - vector: rows = n, cols = 1
        - pair:   rows = 2, cols = 1
        - matrix: rows = n, cols = m
        - set:    同 vector
        - dict:   包含 keys, values 向量
        - table:  同 matrix
    */
    rows?: number
    
    /** 第 2 维 */
    cols?: number
    
    /** 实际数据。不同的 DdbForm, DdbType 使用 DdbValue 中不同的类型来表示实际数据  
        The actual data. Different DdbForm, DdbType use different types in DdbValue to represent actual data */
    value: TValue
    
    /** 原始二进制数据，仅在 parse_object 为 false 时通过 parse_message 生成的顶层对象有这个属性 */
    buffer?: Uint8Array
    
    
    constructor (data: Partial<DdbObj> & { form: DdbForm, type: DdbType /* (parse 对象时必须设置) , length: number */ }) {
        Object.assign(this, data)
    }
    
    
    static parse (buf: Uint8Array, le: boolean) {
        if (!buf.length)
            return new this({
                le,
                form: DdbForm.scalar,
                type: DdbType.void,
                length: 0,
                value: null
            })
        
        const type = buf[0]
        const form = buf[1]
        
        if (buf.length <= 2) 
            return new this({
                le,
                form,
                type,
                length: 2,
                value: null,
            })
        
        
        // set 里面 data 嵌套了一个 vector, 跳过 vector 的 type 和 form
        const i_data = form === DdbForm.set ? 4 : 2
        const buf_data = buf.subarray(i_data)
        
        switch (form) {
            case DdbForm.scalar: {
                const [length, value] = this.parse_scalar(buf_data, le, type)
                return new this({
                    le,
                    form, 
                    type,
                    length: i_data + length,
                    value,
                })
            }
            
            case DdbForm.vector:
            case DdbForm.pair:
            case DdbForm.set: {
                let vector = this.parse_vector(buf_data, le, type)
                vector.length += i_data
                vector.form = form
                return vector
            }
            
            
            case DdbForm.table: {
                // table([
                //     [1, 2] as a,
                //     [1, 2] as b
                // ])
                
                // <Buffer 
                // 00 06 form = table
                // 02 00 00 00 02 00 00 00 rows = 2, cols = 2
                // 00 行名称
                // 61 00 62 00 列名称 a, b
                
                // 04 01 form = vector, type = int
                // 02 00 00 00 01 00 00 00 cols = 2, rows = 1
                // 01 00 00 00 02 00 00 00 
                
                // 04 01 
                // 02 00 00 00 01 00 00 00 
                // 01 00 00 00 02 00 00 00>
                
                const dv = new DataView(buf.buffer, buf.byteOffset + i_data)
                
                const rows = dv.getUint32(0, le)
                const cols = dv.getUint32(4, le)
                const i_name_tail = buf_data.indexOf(0, 8)
                const name = this.dec.decode(
                    buf_data.subarray(8, i_name_tail)
                )
                
                const i_items_start = i_name_tail + 1
                
                const [len_items, colnames] = this.parse_vector_items(
                    buf_data.subarray(i_items_start),
                    le,
                    DdbType.string,
                    cols
                ) as [number, string[]]
                
                let value = new Array(cols)
                let i_start = i_items_start + len_items
                for (let i = 0;  i < cols;  i++) {
                    const type = buf_data[i_start] as DdbType
                    
                    let col = this.parse_vector(
                        buf_data.subarray(i_start + 2),
                        le,
                        type
                    )
                    
                    col.length += 2
                    
                    col.name = colnames[i]
                    
                    value[i] = col
                    
                    i_start += col.length
                }
                
                return new this({
                    le,
                    form,
                    type,
                    length: i_data + i_start,
                    name,
                    rows,
                    cols,
                    value,
                })
            }
            
            
            case DdbForm.dict: 
            case DdbForm.chart: {
                // <Buffer 19 05 type = any, form = dict
                // 12 01 keys.type = string, keys.form = vector
                // 03 00 00 00 01 00 00 00 keys.cols = 3, keys.rows = 1
                // 63 00 62 00 61 00 
                
                // 19 01 values.type = any, values.form = vector
                // 03 00 00 00 01 00 00 00 values.cols = 3, values.rows = 1
                // 04 00 03 00 00 00 04 00 02 00 00 00 04 00 01 00 00 00>
                
                let keys = this.parse_vector(
                    buf_data.subarray(2),
                    le,
                    buf_data[0]
                )
                
                keys.length += 2
                
                let values = this.parse_vector(
                    buf_data.subarray(keys.length + 2),
                    le,
                    buf_data[keys.length]
                )
                
                values.length += 2
                
                let dict = new this({
                    le,
                    form: DdbForm.dict,
                    type,
                    length: i_data + keys.length + values.length,
                    rows: keys.rows,
                    cols: 2,
                    value: [
                        keys,
                        values
                    ],
                })
                
                if (form === DdbForm.dict)
                    return dict
                else {
                    const {
                        chartType: type,
                        stacking,
                        binStart: bin_start,
                        binEnd: bin_end,
                        binCount: bin_count,
                        title: titles,
                        extras,
                        data,
                        ... others
                    } = dict.to_dict<{
                        chartType: DdbObj<DdbChartType>
                        stacking: DdbBool
                        binStart: DdbObj
                        binEnd: DdbObj
                        binCount: DdbObj
                        title: DdbVectorString
                        extras?: DdbObj
                        data: DdbMatrixObj
                    }>()
                    
                    const [chart, x_axis, y_axis] = titles.value
                    
                    dict.form = DdbForm.chart
                    
                    dict.value = {
                        type: type.value,
                        stacking: stacking.value,
                        titles: {
                            chart,
                            x_axis,
                            y_axis,
                        },
                        ... bin_start ? { bin_start, bin_end, } : { },
                        ... bin_count ? { bin_count } : { },
                        ... extras ? (() => {
                            const { multiYAxes: multi_y_axes = false, ...extras_others } = extras.to_dict<{ multiYAxes: boolean }>({ strip: true })
                            
                            return {
                                extras: {
                                    multi_y_axes,
                                    ...extras_others,
                                }
                            }
                        })() : { },
                        data,
                        ...others,
                    }
                    
                    return dict
                }
            }
            
            
            case DdbForm.matrix: {
                // rename!(
                //     1..9$3:3,
                //     [1, 2, 3],
                //     ['c1', 'c2', 'c3']
                // )
                
                // <Buffer 04 03 type = int, form = matrix
                // 03 has_row_label (& 0x01) = 1, has_col_label (& 0x02) = 1
                
                // row labels
                // 04 01 type = int, form = vector
                // 03 00 00 00 01 00 00 00 rows = 3, cols = 1
                // 01 00 00 00 02 00 00 00 03 00 00 00 vector values
                
                // col labels
                // 12 01 type = string, form = vector
                // 03 00 00 00 01 00 00 00 rows = 3, cols = 1
                // 63 31 00 63 32 00 63 33 00 
                
                // matrix data
                // 04 03 type = matrix.type, form = matrix
                // 03 00 00 00 03 00 00 00 rows = 3, cols = 3
                
                const dv = new DataView(buf.buffer, buf.byteOffset + i_data)
                
                const label_flags = buf_data[0]
                const has_row_labels = Boolean(label_flags & 0x01)
                const has_col_labels = Boolean(label_flags & 0x02)
                
                let row_labels: DdbVectorObj | null = null
                let col_labels: DdbVectorObj | null = null
                
                let offset = 1
                
                if (has_row_labels) {
                    row_labels = this.parse_vector(
                        buf_data.subarray(offset + 2),
                        le,
                        buf_data[offset] as DdbType
                    )
                    row_labels.length += 2
                    offset += row_labels.length
                }
                
                if (has_col_labels) {
                    col_labels = this.parse_vector(
                        buf_data.subarray(offset + 2),
                        le,
                        buf_data[offset] as DdbType
                    )
                    col_labels.length += 2
                    offset += col_labels.length
                }
                
                assert(buf_data[offset] === type, 'matrix.datatype === matrix.type')
                
                const rows = dv.getUint32(offset + 2, le)
                const cols = dv.getUint32(offset + 6, le)
                
                const [len_items, data] = this.parse_vector_items(
                    buf_data.subarray(offset + 10),
                    le,
                    type,
                    rows * cols  // 假设小于 2**32
                )
                
                offset += 10 + len_items
                
                return new this({
                    le,
                    form, 
                    type,
                    length: i_data + offset,
                    rows,
                    cols,
                    value: {
                        rows: row_labels,
                        cols: col_labels,
                        data,
                    },
                })
            }
            
            
            default:
                return new this({
                    le,
                    form,
                    type,
                    length: i_data + buf_data.length,
                    value: buf_data
                })
        }
    }
    
    
    static parse_scalar (buf: Uint8Array, le: boolean, type: DdbType): [number, DdbScalarValue] {
        switch (type) {
            case DdbType.void:
                return [1, null]
            
            
            case DdbType.bool: {
                const dv = new DataView(buf.buffer, buf.byteOffset)
                const value = dv.getInt8(0)
                return [1, value === nulls.int8 ? null : Boolean(value)]
            }
            
            
            case DdbType.char: {
                const dv = new DataView(buf.buffer, buf.byteOffset)
                const value = dv.getInt8(0)
                return [1, value === nulls.int8 ? null : value]
            }
            
            
            case DdbType.short: {
                const dv = new DataView(buf.buffer, buf.byteOffset)
                const value = dv.getInt16(0, le)
                return [2, value === nulls.int16 ? null : value]
            }
            
            
            case DdbType.int:
            // datetime
            case DdbType.date:
            case DdbType.month:
            case DdbType.time:
            case DdbType.minute:
            case DdbType.second:
            case DdbType.datetime: 
            case DdbType.datehour: {
                const dv = new DataView(buf.buffer, buf.byteOffset)
                const value = dv.getInt32(0, le)
                return [4, value === nulls.int32 ? null : value]
            }
            
            
            case DdbType.float: {
                const dv = new DataView(buf.buffer, buf.byteOffset)
                const value = dv.getFloat32(0, le)
                return [4, value === nulls.float32 ? null : value]
            }
            
            
            case DdbType.double: {
                const dv = new DataView(buf.buffer, buf.byteOffset)
                const value = dv.getFloat64(0, le)
                return [8, value === nulls.double ? null : value]
            }
            
            
            case DdbType.long:
            // timestamp
            case DdbType.timestamp:
            case DdbType.nanotime:
            case DdbType.nanotimestamp: {
                const dv = new DataView(buf.buffer, buf.byteOffset)
                const value = dv.getBigInt64(0, le)
                return [8, value === nulls.int64 ? null : value]
            }
            
            
            case DdbType.string:
            case DdbType.symbol:
            case DdbType.code:
            case DdbType.handle:
                
            // sqlDS 函数会返回包含 datasource 的 any vector
            case DdbType.datasource:
            
            case DdbType.functiondef: 
            
            // mysql 插件 connect 方法会返回 resource 类型的对象
            case DdbType.resource: {
                const i_head = type === DdbType.functiondef ? 1 : 0
                let i_zero = buf.indexOf(0, i_head)
                let i_end: number  // 整个字符串（包括 0）的末尾，excluding
                if (i_zero === -1)
                    i_end = i_zero = buf.length
                else
                    i_end = i_zero + 1
                // 调整了 i_zero 到字符串（不包括 0）的末尾，excluding
                
                const str = this.dec.decode(
                    buf.subarray(i_head, i_zero)
                )
                
                return [
                    i_end,
                    type === DdbType.functiondef ?
                        {
                            type: buf[0] as DdbFunctionType,
                            name: str
                        }
                    :
                        str
                ]
            }
            
            
            case DdbType.uuid:
            case DdbType.ipaddr:
            case DdbType.int128:
                return [16, buf.slice(0, 16)]
            
            
            case DdbType.blob: {
                const dv = new DataView(buf.buffer, buf.byteOffset)
                const length = dv.getUint32(0, le)
                
                return [4 + length, buf.slice(4, 4 + length)]
            }
            
            
            case DdbType.complex:
            case DdbType.point: {
                const dv = new DataView(buf.buffer, buf.byteOffset)
                return [16, [dv.getFloat64(0, le), dv.getFloat64(8, le)]]
            }
            
            
            case DdbType.duration: {
                const dv = new DataView(buf.buffer, buf.byteOffset)
                return [8, { unit: dv.getUint32(4, le), data: dv.getInt32(0, le) } as DdbDurationValue]
            }
            
            
            case DdbType.decimal32: {
                const dv = new DataView(buf.buffer, buf.byteOffset)
                const data = dv.getInt32(4, le)
                return [8, { scale: dv.getInt32(0, le), data: data === nulls.int32 ? null : data } as DdbDecimal32Value]
            }
            
            case DdbType.decimal64: {
                const dv = new DataView(buf.buffer, buf.byteOffset)
                
                const data = dv.getBigInt64(4, le)
                
                return [12, { scale: dv.getInt32(0, le), data: data === nulls.int64 ? null : data } as DdbDecimal64Value]
            }
            
            case DdbType.decimal128: {
                return DdbDecimal128Serializor.parse_as_scalar(buf, le)
            }
            
            
            default:
                throw new Error(String(DdbType[type] || type) + t(' 暂时不支持解析'))
        }
    }
    
    
    /** parse: rows, cols, items  
        返回的 ddbobj.length 不包括 vector 的 type 和 form
    */
    static parse_vector (buf: Uint8Array, le: boolean, type: DdbType): DdbVectorObj {
        const dv = new DataView(buf.buffer, buf.byteOffset)
        
        const rows = dv.getUint32(0, le)
        
        let i_items_start = 8
        
        if (type < 64 || type >= 128) {
            const [len_items, value] = this.parse_vector_items(
                buf.subarray(i_items_start),
                le,
                type,
                rows
            )
            
            return new this({
                le,
                form: DdbForm.vector,
                type,
                length: i_items_start + len_items,
                cols: 1,
                rows,
                value,
            })
        }
        
        
        // array vector
        
        // av = array(INT[], 0, 3)
        // append!(av, [1..4])
        // append!(av, [1..70000])
        // av
        
        // <Buffer 44 01  type = array vector, form = vector
        // 02 00 00 00 74 11 01 00 rows = 2, cols = 70004 (0x011174)
        
        // block 0
        // 01 00 block.rows = 1
        // 04 block.unit = 4
        // 00 reserved
        // 04 00 00 00 block.lengths = [4]
        // 01 00 00 00 02 00 00 00 03 00 00 00 04 00 00 00 block.data
        
        // block 1
        // 01 00 block.rows = 1
        // 04 block.unit = 4
        // 00 reserved
        // 70 11 01 00 block.lengths = [70000 (0x00011170)]
        // 01 00 00 00 02 00 00 00 ... 279992 more bytes> block.data
        
        
        // decimal array vector
        
        // a = array(DECIMAL32(2)[], 0, 10)
        // append!(a, [
        //     [1, 2, 3], 
        //     [4, 5], 
        //     [6, 7, 8],
        //     [9, 10]
        // ])
        // print(a)
        // a
        
        // [[1.00,2.00,3.00],[4.00,5.00],[6.00,7.00,8.00],[9.00,10.00]]
        
        // <Buffer 65 01 type = 101 = 64 + 37 (decimal32) , form = vector
        // 04 00 00 00 0a 00 00 00 rows = 4, cols = 10
        
        // scale (只有 decimal32 才有)
        // 02 00 00 00 scale = 2
        
        // block 0
        // 04 00 block.rows = 4
        // 01 block.unit = 1
        // 00 reserved
        // 03 02 03 02 block.lengths = [3, 2, 3, 2]
        // 64 00 00 00 c8 00 00 00 2c 01 00 00 90 01 00 00 f4 01 00 00 58 02 00 00 bc 02 00 00 ... 12 more bytes> [100, 200, 300, ...]
        
        // block 1
        // ...
        
        const type_ = type - 64
        
        const cols = dv.getUint32(4, le)
        
        let blocks: DdbArrayVectorValue = [ ]
        
        // decimal 会在所有 blocks 之前多一个 scale
        if (is_decimal_type(type_)) {
            blocks.scale = dv.getInt32(i_items_start, le)
            i_items_start += 4
        }
        
        let i_block_start = i_items_start
        
        // 解析一个 block
        for (let i_row = 0;  i_row < rows;  ) {
            /** 对应 array vector 中元素个数 */
            const rows = dv.getUint16(i_block_start, le)
            
            /** 每个 length 占用的字节数 */
            const unit = dv.getUint8(i_block_start + 2)
            
            /** array vector 每个元素的子元素长度 */
            let lengths: Uint32Array | Uint16Array | Uint8Array
            
            const i_lengths_start = i_block_start + 4
            const i_data_start = i_lengths_start + rows * unit
            
            const lengths_buf = buf.slice(i_lengths_start, i_data_start)
            
            switch (unit) {
                case 1:
                    lengths = lengths_buf
                    break
                
                case 2:
                    lengths = new Uint16Array(lengths_buf.buffer)
                    break
                
                case 4:
                    lengths = new Uint32Array(lengths_buf.buffer)
                    break
                
                default:
                    throw new Error(t('array vector 存在非法 unit: {{unit}}', { unit }))
            }
            
            let total_length = 0
            for (const x of lengths)
                total_length += x
            
            let len_items: number
            let data: DdbVectorValue
            
            switch (type_) {
                case DdbType.decimal32:
                    len_items = total_length * 4
                    data = new Int32Array(buf.buffer.slice(buf.byteOffset + i_data_start, buf.byteOffset + i_data_start + len_items))
                    break
                case DdbType.decimal64:
                    len_items = total_length * 8
                    data = new BigInt64Array(buf.buffer.slice(buf.byteOffset + i_data_start, buf.byteOffset + i_data_start + len_items))
                    break
                case DdbType.decimal128:
                    [len_items, data] = DdbDecimal128Serializor.parse_as_same_type_vector_values(buf, i_data_start, total_length)
                    break
                default:
                    [len_items, data] = this.parse_vector_items(buf.subarray(i_data_start), le, type - 64, total_length)
            }
            
            blocks.push({
                unit,
                rows,
                lengths,
                data: data as Int8Array | Int16Array | Int32Array | Float32Array | Float64Array | BigInt64Array | BigInt128Array
            })
            
            i_block_start = i_data_start + len_items
            
            i_row += rows
        }
        
        
        return new this({
            le,
            form: DdbForm.vector,
            type,
            length: i_block_start,
            cols,
            rows,
            value: blocks
        })
    }
    
    
    /** 有可能没有字节对齐，不能直接使用原有 message 的 arraybuffer, 统一复制出来，让原有 arraybuffer 被回收掉比较好 */
    static parse_vector_items (
        buf: Uint8Array, 
        le: boolean,
        type: DdbType, 
        length: number
    ): [
        number, 
        DdbVectorValue
    ] {
        switch (type) {
            case DdbType.void:
                return [0, null]
            
            case DdbType.bool:
            case DdbType.char:
                return [
                    length,
                    new Int8Array(
                        buf.buffer.slice(
                            buf.byteOffset,
                            buf.byteOffset + length
                        )
                    )
                ]
            
            case DdbType.short:
                return [
                    2 * length,
                    new Int16Array(
                        buf.buffer.slice(
                            buf.byteOffset,
                            buf.byteOffset + 2 * length
                        )
                    )
                ]
            
            
            case DdbType.int:
            // datetime
            case DdbType.date:
            case DdbType.month:
            case DdbType.time:
            case DdbType.minute:
            case DdbType.second:
            case DdbType.datetime:
            case DdbType.datehour:
                return [
                    4 * length,
                    new Int32Array(
                        buf.buffer.slice(
                            buf.byteOffset,
                            buf.byteOffset + 4 * length
                        )
                    )
                ]
            
            
            case DdbType.float:
                return [
                    4 * length,
                    new Float32Array(
                        buf.buffer.slice(
                            buf.byteOffset,
                            buf.byteOffset + 4 * length
                        )
                    )
                ]
            
            
            case DdbType.double:
                return [
                    8 * length,
                    new Float64Array(
                        buf.buffer.slice(
                            buf.byteOffset, 
                            buf.byteOffset + 8 * length
                        )
                    )
                ]
            
            
            case DdbType.long:
            // timestamp
            case DdbType.timestamp:
            case DdbType.nanotime:
            case DdbType.nanotimestamp:
                return [
                    8 * length,
                    new BigInt64Array(
                        buf.buffer.slice(
                            buf.byteOffset,
                            buf.byteOffset + 8 * length
                        )
                    )
                ]
            
            
            case DdbType.string:
            case DdbType.symbol:
            case DdbType.handle:
            case DdbType.datasource:
            case DdbType.code: {
                let value = new Array<string>(length)
                let i_head = 0, i_tail = i_head
                for (let i = 0;  i < length;  i++) {
                    i_tail = buf.indexOf(0, i_head)
                    value[i] = this.dec.decode(
                        buf.subarray(i_head, i_tail)
                    )
                    i_head = i_tail + 1
                }
                return [i_head, value]
            }
            
            
            case DdbType.symbol_extended: {
                // <Buffer 91 01 type = symbol extended, form = vector
                // 05 00 00 00 01 00 00 00 row = 5, col = 1
                
                // buf:
                // 00 00 00 00 symbol base id = 0 (uint32)
                // 02 00 00 00 symbol base size = 2
                // 00 61 61 00 以 \0 分割的字符串
                // 01 00 00 00 01 00 00 00 01 00 00 00 01 00 00 00 01 00 00 00>
                
                const dv = new DataView(buf.buffer, buf.byteOffset)
                const base_id = dv.getUint32(0, le)
                const base_size = dv.getUint32(4, le)
                
                let base_length = 0
                let base = this.symbol_bases[base_id]
                
                // base_size 为 0 时复用之前的 symbol base
                if (base_size) {
                    [base_length, base] = this.parse_vector_items(
                        buf.subarray(8),
                        le,
                        DdbType.string,
                        base_size
                    ) as [number, string[]]
                    
                    this.symbol_bases[base_id] = base
                }
                
                const value_start = 8 + base_length
                const value_end = value_start + length * 4
                
                const data = new Uint32Array(
                    buf.buffer.slice(
                        buf.byteOffset + value_start,
                        buf.byteOffset + value_end
                    )
                )
                
                return [
                    value_end,
                    {
                        base_id,
                        base,
                        data
                    }
                ]
            }
            
            
            case DdbType.uuid:
            case DdbType.ipaddr:
            case DdbType.int128:
                return [
                    16 * length,
                    new Uint8Array(
                        buf.buffer.slice(
                            buf.byteOffset,
                            buf.byteOffset + 16 * length
                        )
                    )
                ]
            
            
            case DdbType.blob: {
                // <Buffer 20 01 type = blob, form = vector
                // 02 00 00 00 01 00 00 00 cols = 2, rows = 1
                // 04 00 00 00 61 62 63 64 
                // 04 00 00 00 61 62 63 64>
                
                let value = new Array<Uint8Array>(length)
                const dv = new DataView(buf.buffer, buf.byteOffset)
                let i_head = 0
                for (let i = 0;  i < length;  i++) {
                    const sublen = dv.getUint32(i_head, le)
                    const i_blob_head = i_head + 4
                    const i_blob_tail = i_blob_head + sublen
                    value[i] = buf.slice(i_blob_head, i_blob_tail)
                    i_head = i_blob_tail
                }
                
                return [i_head, value]
            }
            
            
            case DdbType.complex:
            case DdbType.point: 
                return [
                    16 * length,
                    new Float64Array(
                        buf.buffer.slice(
                            buf.byteOffset,
                            buf.byteOffset + 16 * length
                        )
                    )
                ]
            
            
            case DdbType.any: {
                // [1, 2, 'a', 'aaa']
                // any[4](<Buffer 
                // 04 00 DdbType.int, DdbForm.scalar
                // 01 00 00 00 
                // 04 00 DdbType.int, DdbForm.scalar
                // 02 00 00 00 
                // 02 00 DdbType.char, DdbForm.scalar
                // 61 
                // 12 00 DdbType.string, DdbForm.scalar
                // 61 61 61 00>)
                
                
                let values = new Array<DdbObj>(length)
                let i_head = 0
                for (let i = 0;  i < length;  i++) {
                    const obj = this.parse(
                        buf.subarray(i_head),
                        le
                    )
                    values[i] = obj
                    i_head += obj.length
                }
                
                return [
                    i_head,
                    values
                ]
            }
            
            
            // 25 01 type = decimal32, form = vector
            // 02 00 00 00 01 00 00 00
            // 00 00 00 00 scale = 0
            // 01 00 00 00 data[0] = 1
            // 3a 01 00 00 data[1] = 0x013a = 314
            case DdbType.decimal32: {
                const dv = new DataView(buf.buffer, buf.byteOffset)
                
                return [
                    4 + 4 * length,
                    {
                        scale: dv.getInt32(0, le),
                        data: new Int32Array(
                            buf.buffer.slice(
                                buf.byteOffset + 4,
                                buf.byteOffset + 4 + 4 * length
                            )
                        )
                    } as DdbDecimal32VectorValue
                ]
            }
            
            case DdbType.decimal64: {
                const dv = new DataView(
                    buf.buffer,
                    buf.byteOffset
                )
                
                return [
                    4 + 8 * length,
                    {
                        scale: dv.getInt32(0, le),
                        data: new BigInt64Array(
                            buf.buffer.slice(
                                buf.byteOffset + 4,
                                buf.byteOffset + 4 + 8 * length
                            )
                        )
                    } as DdbDecimal64VectorValue
                ]
            }
            
            case DdbType.decimal128:
                return DdbDecimal128Serializor.parse_as_vector_items(buf, length, le)
            
            // 以下情况时, DdbType.duration 实际会返回一个 any vector
            // [2y, 1M, 3d, 7H, 11m, 12s, 15ms, 16us, 17ns]
            // <Buffer 19 01 type = any, form = vector
            // 09 00 00 00 01 00 00 00 rows = 9, cols = 1
            // 24 00 type = DdbType.duration, form = scalar
            // 02 00 00 00 09 00 00 00 
            // 24 00 01 00 00 00 08 00 00 00 24 00 03 00 00 00 06 00 00 00 24 00 07 00 00 00 05 00 00 00 ... 50 more bytes>
            // 其余情况 (目前仅 pair) 下, 会返回特殊的 duration 序列化
            // 4 bytes data 4 bytes unit
            // 01 00 00 00 data: 1 
            // 01 00 00 00 unit: 1
            // 02 00 00 00 data: 2
            // 02 00 00 00 unit: 2
            case DdbType.duration: {         
                const dv = new DataView(buf.buffer, buf.byteOffset)
                
                let durations: DdbDurationVectorValue = [ ]
                
                for (let i = 0;  i < length;  i++)
                    durations.push({
                        data: dv.getInt32(0 + 8 * i, le),
                        unit: dv.getInt32(4 + 8 * i, le)
                    })
                
                return [8 * length, durations]
            }
            
            default:
                throw new Error(t('vector<{{type}}> 暂时不支持解析', { type: String(DdbType[type] || type) }))
        }
    }
    
    
    pack (): Uint8Array {
        const { form, type, value } = this
        
        let header = new Uint8Array(2)
        header[0] = type
        header[1] = form
        
        const body = (() => {
            switch (form) {
                case DdbForm.scalar:
                    switch (type) {
                        case DdbType.void:
                            // Server 实现中区分了 explicitNull
                            // Void::serialize()
                            //     isNothing() ? 0 : 1;
                            return [Uint8Array.of(0)]
                        
                        case DdbType.bool:
                            return [
                                Int8Array.of(
                                    value === null ?
                                        nulls.int8
                                    :
                                        Number(value)
                                )
                            ]
                        
                        
                        case DdbType.char:
                            return [
                                Int8Array.of(
                                    (value === null ?
                                        nulls.int8
                                    :
                                        value as number
                                    )
                                )
                            ]
                        
                        
                        case DdbType.short:
                            return [
                                Int16Array.of(
                                    value === null ?
                                        nulls.int16
                                    :
                                        value as number
                                )
                            ]
                        
                        
                        case DdbType.int:
                        // datetime
                        case DdbType.date:
                        case DdbType.month:
                        case DdbType.time:
                        case DdbType.minute:
                        case DdbType.second:
                        case DdbType.datetime:
                        case DdbType.datehour:
                            return [
                                Int32Array.of(
                                    value === null ?
                                        nulls.int32
                                    :
                                        value as number
                                )
                            ]
                        
                        
                        case DdbType.float:
                            return [
                                Float32Array.of(
                                    value === null ?
                                        nulls.float32
                                    :
                                        value as number
                                )
                            ]
                        
                        
                        case DdbType.double:
                            return [
                                Float64Array.of(
                                    value === null ?
                                        nulls.double
                                    :
                                        value as number
                                )
                            ]
                        
                        
                        case DdbType.long:
                        // timestamp
                        case DdbType.timestamp:
                        case DdbType.nanotime:
                        case DdbType.nanotimestamp:
                            return [
                                BigInt64Array.of(
                                    value === null ?
                                        nulls.int64
                                    :
                                        value as bigint
                                )
                            ]
                        
                        
                        case DdbType.string:
                        case DdbType.symbol:
                        case DdbType.code:
                        case DdbType.handle:
                        case DdbType.datasource:
                        case DdbType.resource:
                            return [
                                DdbObj.enc.encode(value as string),
                                Uint8Array.of(0),
                            ]
                        
                        case DdbType.functiondef:
                            return [
                                Uint8Array.of((value as DdbFunctionDefValue).type),
                                DdbObj.enc.encode((value as DdbFunctionDefValue).name),
                                Uint8Array.of(0)
                            ]
                        
                        case DdbType.uuid:
                        case DdbType.ipaddr:
                        case DdbType.int128:
                            return [this.value as Uint8Array]
                        
                        
                        case DdbType.blob:
                            return [Uint32Array.of((this.value as Uint8Array).byteLength), this.value as Uint8Array]
                        
                        
                        case DdbType.complex:
                        case DdbType.point:
                            return [Float64Array.from(this.value as [number, number])]
                        
                        
                        case DdbType.duration: {
                            const { unit, data } = this.value as DdbDurationValue
                            return [Int32Array.of(data, unit)]
                        }
                        
                        case DdbType.decimal32: {
                            const { scale, data } = this.value as DdbDecimal32Value
                            return [Int32Array.of(scale, data === null ? nulls.int32 : data)]
                        }
                        
                        case DdbType.decimal64: {
                            const { scale, data } = this.value as DdbDecimal64Value
                            return [Int32Array.of(scale), BigInt64Array.of(data === null ? nulls.int64 : data)]
                        }
                        
                        case DdbType.decimal128:
                            return DdbDecimal128Serializor.pack(this.value as DdbDecimal128Value)
                        
                        default:
                            throw new Error(String(DdbType[type] || type) + t(' 暂时不支持序列化'))
                    }
                
                
                case DdbForm.vector:
                case DdbForm.pair:
                    // pack array vector
                    if (form === DdbForm.vector && 64 <= type && type < 128)
                        return [
                            Uint32Array.of(this.rows, this.cols),
                            ... (is_decimal_type(type - 64)) ? 
                                [Int32Array.of((this.value as DdbArrayVectorValue).scale)]
                            :
                                [ ],
                            ... (this.value as DdbArrayVectorValue).map(block => ([
                                Uint16Array.of(block.rows),
                                Uint8Array.of(block.unit, 0),
                                block.lengths,
                                block.data as any
                            ])).flat()
                        ]
                    
                    return [
                        Uint32Array.of(this.rows, 1),
                        ... DdbObj.pack_vector_body(value as DdbVectorValue, type, this.rows)
                    ]
                
                
                case DdbForm.set:
                    return [new DdbObj({ ...this, form: DdbForm.vector }).pack()]
                
                
                case DdbForm.table:
                    return [
                        Uint32Array.of(this.rows, this.cols),
                        DdbObj.enc.encode(this.name || ''),
                        
                        // column names
                        Uint8Array.of(0),
                        ...DdbObj.pack_vector_body(
                            (this.value as DdbObj[]).map((col, i) => 
                                col.name || `col${i}`
                            ),
                            DdbType.string,
                            this.cols
                        ),
                        
                        // column vectors
                        ...(this.value as DdbObj[]).map(col => 
                            col.pack()
                        )
                    ]
                
                
                case DdbForm.dict:
                    return [(value as DdbDictValue)[0].pack(), (value as DdbDictValue)[1].pack()]
                
                case DdbForm.chart: {
                    const {
                        type,
                        stacking,
                        bin_start, bin_end, bin_count,
                        titles: { chart, x_axis, y_axis },
                        extras,
                        data
                    } = this.value as DdbChartValue
                    
                    const {
                        value: [keys, values]
                    } = new DdbDict({
                        chartType: new DdbInt(type),
                        stacking,
                        ... bin_start ? { binStart: bin_start, binEnd: bin_end } : { },
                        ... bin_count ? { binCount: bin_count } : { },
                        title: new DdbVectorString([chart, x_axis, y_axis]),
                        ... extras ? (() => {
                            const { multi_y_axes, ...extras_other } = extras
                            return { extras: new DdbDict({ multiYAxes: multi_y_axes, ...extras_other }) }
                        })() : { },
                        data,
                    })
                    
                    return [keys.pack(), values.pack()]
                }
                
                case DdbForm.matrix: {
                    const { rows, cols, data } = value as DdbMatrixValue
                    
                    return [
                        Uint8Array.of(
                            (rows ? 0x01 : 0x00) | (cols ? 0x02 : 0x00),
                        ),
                        ... rows ? [rows.pack()] : [ ],
                        ... cols ? [cols.pack()] : [ ],
                        Uint8Array.of(this.type, this.form),
                        Uint32Array.of(this.rows, this.cols),
                        ... DdbObj.pack_vector_body(data, this.type, this.rows * this.cols)
                    ]
                }
                
                default:
                    throw new Error(t('vector {{type}} 暂不支持序列化', { type: DdbType[type] || type }))
            }
        })()
        
        
        if (!body)
            return new Uint8Array(0)
        
        return concat([header, ...body])
    }
    
    
    static pack_vector_body (
        value: DdbVectorValue,
        type: DdbType,
        length: number
    ): ArrayBufferView[] {
        switch (type) {
            case DdbType.void:
                return [ ]
            
            case DdbType.bool:
                return [value as Int8Array]
            
            
            case DdbType.char:
                return [value as Int8Array]
            
            
            case DdbType.short:
                return [value as Int16Array]
            
            
            case DdbType.int:
            // datetime
            case DdbType.date:
            case DdbType.month:
            case DdbType.time:
            case DdbType.minute:
            case DdbType.second:
            case DdbType.datetime:
            case DdbType.datehour:
                return [value as Int32Array]
            
            
            case DdbType.float:
                return [value as Float32Array]
            
            
            case DdbType.double:
                return [value as Float64Array]
            
            case DdbType.long:
            // timestamp
            case DdbType.timestamp:
            case DdbType.nanotime:
            case DdbType.nanotimestamp:
                return [value as BigInt64Array]
            
            
            case DdbType.string:
            case DdbType.symbol:
            case DdbType.handle:
            case DdbType.datasource:
            case DdbType.code: {
                let bufs = new Array<Uint8Array>(length * 2)
                for (let i = 0;  i < length;  i++) {
                    bufs[2 * i] = this.enc.encode((value as string[])[i])
                    bufs[2 * i + 1] = Uint8Array.of(0)
                }
                return bufs
            }
            
            
            case DdbType.uuid:
            case DdbType.ipaddr:
            case DdbType.int128:
                return [value as Uint8Array]
            
            
            case DdbType.blob: {
                let bufs = new Array<ArrayBufferView>(length * 2)
                for (let i = 0;  i < length;  i++) {
                    const blob_value = (value as Uint8Array[])[i]
                    bufs[2 * i] = Uint32Array.of(blob_value.length)
                    bufs[2 * i + 1] = blob_value
                }
                return bufs
            }
            
            
            case DdbType.complex:
            case DdbType.point: 
                return [value as Float64Array]
            
            
            case DdbType.any: {
                // [1, 2, 'a', 'aaa']
                // any[4](<Buffer 
                // 04 00 DdbType.int, DdbForm.scalar
                // 01 00 00 00 
                // 04 00 DdbType.int, DdbForm.scalar
                // 02 00 00 00 
                // 02 00 DdbType.char, DdbForm.scalar
                // 61 
                // 12 00 DdbType.string, DdbForm.scalar
                // 61 61 61 00>)
                
                let bufs = new Array<Uint8Array>(length)
                for (let i = 0;  i < length;  i++)
                    bufs[i] = (value as DdbObj[])[i].pack()
                return bufs
            }
            
            
            case DdbType.symbol_extended: {
                const { base_id, base, data } = value as DdbSymbolExtendedValue
                
                return [
                    Uint32Array.of(
                        base_id || 0,
                        base.length,
                    ),
                    ...this.pack_vector_body(base, DdbType.string, base.length),
                    data
                ]
            }
            
            case DdbType.decimal32:
            case DdbType.decimal64:
            case DdbType.decimal128: {
                const { scale, data } = value as DdbDecimal32VectorValue | DdbDecimal64VectorValue | DdbDecimal128VectorValue
                return [Int32Array.of(scale), data]
            }
            
            default:
                throw new Error(t('vector {{type}} 暂不支持序列化', { type: String(DdbType[type] || type) }))
        }
    }
    
    
    toString (options: InspectOptions = { nullstr: true, quote: true }): string {
        const type = this.inspect_type()
        
        const data = (() => {
            switch (this.form) {
                case DdbForm.scalar:
                    // 如果类型为 string, 则不进行格式化处理
                    if (this.type === DdbType.string)
                        return this.value
                    else
                        return format(this.type, this.value, this.le, options)
                
                case DdbForm.vector:
                case DdbForm.pair:
                case DdbForm.set: {
                    const form = this.form
                    
                    function format_array (items: string[], ellipsis: boolean) {
                        const str_items = items.join(', ') + (ellipsis ? ', ...' : '')
                        
                        return form === DdbForm.pair ?
                                str_items
                            :
                                str_items.bracket('square')
                    }
                    
                    
                    if (64 <= this.type && this.type < 128) {  // array vector
                        // 因为 array vector 目前只支持：Logical, Integral（不包括 INT128, COMPRESS 类型）, Floating, Temporal
                        // 都对应 TypedArray 中的一格，所以直接根据 index 去取即可
                        // av = array(INT[], 0, 5)
                        // append!(av, [1..1])
                        // append!(av, [1..70000])
                        // append!(av, [1..1])
                        // append!(av, [1..500])
                        // ...
                        // av
                        const type_ = this.type - 64
                        
                        const limit = 10
                        
                        let array_items = new Array(Math.min(limit, this.rows))
                        
                        let i_items = 0
                        
                        for (const { lengths, data } of this.value as DdbArrayVectorValue) {
                            let acc_len = 0
                            
                            for (const length of lengths) {
                                let items = new Array(Math.min(limit, length))
                                
                                for (let i = 0;  i < items.length;  i++)
                                    switch (type_) {
                                        case DdbType.decimal32:
                                        case DdbType.decimal64:
                                        case DdbType.decimal128:
                                            const x = data[acc_len + i]
                                            
                                            if (is_decimal_null_value(type_, x))
                                                items[i] = ''
                                            else {
                                                const { scale } = this.value as DdbArrayVectorValue
                                                
                                                const s = String(x < 0 ? -x : x).padStart(scale, '0')
                                                
                                                const str = (x < 0 ? '-' : '') + (scale ? `${s.slice(0, -scale) || '0'}.${s.slice(-scale)}` : s)
                                                
                                                items[i] = options.colors ? green(str) : str
                                            }
                                            
                                            break
                                        
                                        case DdbType.complex:
                                        case DdbType.point: {
                                            const index = acc_len + i
                                            items[i] = format(
                                                type_,
                                                data.subarray(2 * index, 2 * (index + 1)),
                                                this.le,
                                                options
                                            )
                                            break
                                        }
                                        
                                        case DdbType.uuid:
                                        case DdbType.int128:
                                        case DdbType.ipaddr: {
                                            const index = acc_len + i
                                            items[i] = format(
                                                type_,
                                                data.subarray(16 * index, 16 * (index + 1)),
                                                this.le,
                                                options
                                            )
                                            break
                                        }
                                        
                                        default:
                                            items[i] = format(type_, data[acc_len + i], this.le, options)
                                            break
                                    }
                                
                                array_items[i_items++] = format_array(items, length > limit)
                                
                                acc_len += length
                            }
                            
                            if (i_items >= limit)
                                break
                        }
                        
                        return format_array(
                            array_items,
                            this.rows > limit
                        )
                    }
                    
                    switch (this.type) {
                        case DdbType.symbol_extended: {
                            const limit = 50 as const
                            
                            const { base, data } = this.value as DdbSymbolExtendedValue
                            
                            let items = new Array(
                                Math.min(limit, data.length)
                            )
                            
                            for (let i = 0;  i < items.length;  i++)
                                items[i] = base[data[i]].quote('single')
                            
                            return format_array(
                                items,
                                data.length > limit
                            )
                        }
                        
                        case DdbType.void:
                            return format(this.type, this.value, this.le, options)
                        
                        case DdbType.uuid: 
                        case DdbType.int128: 
                        case DdbType.ipaddr: {
                            const limit = 10 as const
                            
                            const value = this.value as Uint8Array
                            
                            const len_data = value.length / 16
                            
                            let items = new Array(
                                Math.min(limit, len_data)
                            )
                            
                            for (let i = 0;  i < items.length;  i++)
                                items[i] = format(
                                    this.type,
                                    value.subarray(16 * i, 16 * (i + 1)),
                                    this.le,
                                    options
                                )
                            
                            return format_array(
                                items,
                                len_data > limit
                            )
                        }
                        
                        case DdbType.complex:
                        case DdbType.point: {
                            const limit = 20 as const
                            
                            const value = this.value as Float64Array
                            
                            const len_data = value.length / 2
                            
                            let items = new Array(
                                Math.min(limit, len_data)
                            )
                            
                            for (let i = 0;  i < items.length;  i++)
                                items[i] = format(
                                    this.type,
                                    value.subarray(2 * i, 2 * (i + 1)),
                                    this.le,
                                    options
                                )
                            
                            return format_array(
                                items,
                                len_data > limit
                            )
                        }
                        
                        case DdbType.decimal32: 
                        case DdbType.decimal64:
                        case DdbType.decimal128: {
                            const limit = 50 as const
                            
                            const { data } = this.value as DdbDecimal32VectorValue | DdbDecimal64VectorValue | DdbDecimal128VectorValue
                            
                            let items = new Array(Math.min(limit, data.length))
                            
                            for (let i = 0;  i < items.length;  i++)
                                items[i] = formati(this as DdbObj<DdbDecimal32VectorValue | DdbDecimal64VectorValue | DdbDecimal128VectorValue>, i, options)
                            
                            return format_array(items, data.length > limit)
                        }
                        
                        default: {
                            const limit = 50 as const
                            
                            let items = new Array(
                                Math.min(limit, (this.value as any[]).length)
                            )
                            
                            for (let i = 0;  i < items.length;  i++)
                                items[i] = format(this.type, this.value[i], this.le, options)
                            
                            return format_array(
                                items,
                                (this.value as any[]).length > limit
                            )
                        }
                    }
                    
                }
                
                case DdbForm.chart:
                    return JSON.stringify(
                        this.value,
                        (key, value) => key === 'data' ? (value as DdbObj).toString(options) : value,
                        4
                    )
            }
            
            return String(this.value)
        })()
        
        // 如果类型为 string 则不需要加上类型名
        if (this.form === DdbForm.scalar && this.type === DdbType.string)
            return data as string
        else
            return `${ options?.colors ? blue(type) : type }(${ this.name ? `'${this.name}', ` : '' }${data})`
    }
    
    
    inspect_type () {
        const tname = DdbType[this.type]
        
        switch (this.form) {
            case DdbForm.scalar:
                if (this.type === DdbType.functiondef)
                    return `functiondef<${DdbFunctionType[(this.value as DdbFunctionDefValue).type]}>`
                
                return tname
            
            case DdbForm.vector:
                if (64 <= this.type && this.type < 128)
                    return `${DdbType[this.type - 64]}[][${this.rows}]`
                return `${tname}[${this.rows}]`
            
            case DdbForm.pair:
                return `pair<${tname}>`
            
            case DdbForm.set:
                return `set<${tname}>[${this.rows}]`
            
            case DdbForm.table:
                return `table[${this.rows}r][${this.cols}c]`
            
            case DdbForm.dict:
                return `dict<${DdbType[(this.value[0] as DdbObj).type]}, ${DdbType[(this.value[1] as DdbObj).type]}>[${this.rows}]`
            
            case DdbForm.chart:
                return `chart<${DdbChartType[(this.value as DdbChartValue).type]}>`
            
            case DdbForm.matrix:
                return `matrix<${tname}>[${this.rows}r][${this.cols}c]`
            
            default:
                return `${DdbForm[this.form]} ${tname}`
        }
    }
    
    
    /** 自动转换 js string, boolean 为 DdbObj */
    static to_ddbobj (value: DdbObj | string | boolean): DdbObj {
        if (value && value instanceof DdbObj)
            return value
        
        const type = typeof value
        
        switch (type) {
            case 'string':
                return new DdbString(value as string)
            
            case 'boolean':
                return new DdbBool(value as boolean)
            
            default: 
                throw new Error(t('不能自动转换 {{type}} 至 DdbObj', { type }))
        }
    }
    
    
    /** 转换 js 数组为 DdbObj[] */
    static to_ddbobjs (values: (DdbObj | string | boolean)[]) {
        return values.map(value => this.to_ddbobj(value))
    }
    
    
    to_cols () {
        assert(this.form === DdbForm.table, t('form 必须是 DdbForm.table, 否则不能 to_cols'))
        
        return (this as DdbTableObj).value.map(col => ({
            title: col.name,
            dataIndex: col.name,
            render: value => format(col.type, value, col.le, { nullstr: false, quote: false })
        }))
    }
    
    
    /** 将 table 转换为 rows，空值转换为 null */
    to_rows <T extends Record<string, any> = Record<string, any>> () {
        assert(this.form === DdbForm.table, t('form 必须是 DdbForm.table, 否则不能 to_rows'))
        
        let rows = new Array<T>(this.rows)
        
        for (let i = 0;  i < this.rows;  i++) {
            let row: any = { }
            for (let j = 0;  j < this.cols;  j++) {
                const { type, name, value: values } = (this as DdbTableObj).value[j]  // column
                
                switch (type) {
                    case DdbType.bool: {
                        const value = values[i]
                        row[name] = value === nulls.int8 ?
                                null
                            :
                                Boolean(value)
                        break
                    }
                    
                    case DdbType.char:
                        row[name] = values[i] === nulls.int8 ? null : values[i]
                        break
        
                    case DdbType.short:
                        row[name] = values[i] === nulls.int16 ? null : values[i]
                        break    
                    
                    case DdbType.int:
                    case DdbType.date:
                    case DdbType.month:
                    case DdbType.time:
                    case DdbType.minute:
                    case DdbType.second:
                    case DdbType.datetime:
                    case DdbType.datehour:
                        row[name] = values[i] === nulls.int32 ? null : values[i]
                        break
            
                    case DdbType.long:
                    case DdbType.timestamp:
                    case DdbType.nanotime:
                    case DdbType.nanotimestamp:
                        row[name] = values[i] === nulls.int64 ? null : values[i]
                        break
                        
                    case DdbType.int128:
                        row[name] = values[i] === nulls.int128 ? null : values[i]
                        break
                    
                    case DdbType.float:
                        row[name] = values[i] === nulls.float32 ? null : values[i]
                        break
                    
                    case DdbType.double:
                        row[name] = values[i] === nulls.double ? null : values[i]
                        break
                    
                    case DdbType.decimal32: 
                    case DdbType.decimal64:
                    case DdbType.decimal128: 
                        row[name] = is_decimal_null_value(type, values[i]) ? null : values[i]
                        break
                    
                    case DdbType.ipaddr:
                        row[name] = (values as Uint8Array).subarray(16 * i, 16 * (i + 1))
                        break
                    
                    case DdbType.symbol_extended: {
                        const { base, data } = values as DdbSymbolExtendedValue
                        row[name] = base[data[i]]
                        break
                    }
                    
                    default:
                        row[name] = values[i]
                }
            }
            rows[i] = row
        }
        
        return rows
    }
    
    
    /** 将 dict<string, any> 自动转换为 js object (Record<string, any>)  Automatically convert dict<string, any> to js object (Record<string, any>)
        - options?:
            - strip?: `false` 是否将 DdbObj 中的 value 直接提取、剥离出来作为 js object 的 value (丢弃 DdbObj 中的其余信息，只保留 value)  
                Whether to directly extract and strip the value in DdbObj as the value of js object (discard the rest of the information in DdbObj, only keep the value)
            - deep?: `false` 是否递归转换  
                Whether to convert recursively
    */
    to_dict <T extends Record<string, DdbObj> = Record<string, DdbObj>> (): T
    to_dict <T extends Record<string, any> = Record<string, any>> (options: { strip: true }): T
    to_dict <T extends Record<string, any> = Record<string, any>> (options?: { strip?: boolean, deep?: boolean }): T
    to_dict <T = Record<string, any>> ({
        strip,
        deep,
    }: {
        strip?: boolean
        deep?: boolean
    } = { }) {
        assert(this.form === DdbForm.dict, t('this.form 必须是 DdbForm.dict, 否则不能调用 to_dict 转换为 js object'))
        
        const [{ value: keys, type: key_type }, { value: values, type: value_type }] = this.value as DdbDictValue
        
        assert(key_type === DdbType.string && value_type === DdbType.any, t('当前只支持自动转换 dict<string, any> 为 js object'))
        assert(!(deep && !strip), t('deep = true 时必须设置 strip = true'))
        
        let obj = { }
        
        for (let i = 0;  i < this.rows;  i++) {
            let value: DdbObj = values[i]
            if (deep && value.form === DdbForm.dict)
                obj[keys[i]] = value.to_dict({ strip, deep })
            else
                obj[keys[i]] = strip ? value.value : value
        }
        
        return obj as T
    }
}


export interface InspectOptions {
    colors?: boolean
    
    /** `null` decimal places 小数位数 */
    decimals?: number
    
    /** `false` 决定 null 值如何返回. nullstr ? 'null' : '' */
    nullstr?: boolean
    
    /** `false` 决定 string, symbol, char 类型是否加引号 */
    quote?: boolean
    
    /** `true` 决定格式化后的数据是否有千分位 */
    grouping?: boolean
}


/** 整数一定用这个 number formatter, InspectOptions.decimals 不传也用这个  Integer must use this number formatter, InspectOptions.decimals also use this if not passed */
let default_formatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 20 })


let _decimals = 20

let _grouping = true

/** 缓存，为了优化性能，通常 options.decimals 都是不变的  Cache, in order to optimize performance, usually options.decimals are unchanged */
let _formatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 20 })

/** 用来处理时差  To deal with jet lag */
let _datetime_formatter = new Intl.DateTimeFormat('zh-CN', { dateStyle: 'short', timeStyle: 'medium', timeZone: 'UTC' })

/** 根据 DdbType 格式化单个元素 (value) 为字符串  Formats a single element (value) as a string according to DdbType, null returns a 'null' string */
export function format (type: DdbType, value: DdbValue, le: boolean, options: InspectOptions = { }): string {
    const { nullstr = false, colors = false, quote = false, grouping = true } = options
    
    const formatter = (() => {
        const decimals = options.decimals ?? _decimals
        
        if (decimals !== _decimals || grouping !== _grouping) {
            _decimals = decimals
            _grouping = grouping
            default_formatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 20, useGrouping: grouping })
            _formatter = new Intl.NumberFormat('en-US', {
                maximumFractionDigits: decimals,
                minimumFractionDigits: decimals,
                useGrouping: grouping
            })
        }
        
        return options.decimals === undefined || options.decimals === null ? default_formatter : _formatter
    })()
    
    function get_nullstr () {
        return nullstr ?
            colors ? grey('null') : 'null'
        :
            ''
    }
    
    switch (type) {
        case DdbType.bool:
            if (value === null || value === nulls.int8)
                return get_nullstr()
            else {
                const str = String(Boolean(value))
                return colors ? blue(str) : str
            }
        
        case DdbType.char:
            if (value === null || value === nulls.int8)
                return get_nullstr()
            else {
                let str = 
                    // ascii printable
                    // http://facweb.cs.depaul.edu/sjost/it212/documents/ascii-pr.htm
                    (32 <= (value as number) && (value as number) <= 126) ?
                        String.fromCharCode(value as number)
                :
                    '\\' + String(value as number)
                
                if (quote)
                    str = str.quote()
                
                return colors ? green(str) : str
            }
        
        case DdbType.short:
            if (value === null || value === nulls.int16)
                return get_nullstr()
            else {
                const str = default_formatter.format(value as number)
                return colors ? green(str) : str
            }
        
        case DdbType.int:
            if (value === null || value === nulls.int32)
                return get_nullstr()
            else {
                const str = default_formatter.format(value as number)
                return colors ? green(str) : str
            }
        
        case DdbType.long:
            if (value === null || value === nulls.int64)
                return get_nullstr()
            else {
                const str = default_formatter.format(value as bigint)
                return colors ? green(str) : str
            }
        
        case DdbType.date:
            if (value === null || value === nulls.int32)
                return get_nullstr()
            else {
                const str = date2str(value as number)
                return colors ? magenta(str) : str
            }
        
        case DdbType.month:
            if (value === null || value === nulls.int32)
                return get_nullstr()
            else {
                const str = month2str(value as number)
                return colors ? magenta(str) : str
            }
        
        case DdbType.time:
            if (value === null || value === nulls.int32)
                return get_nullstr()
            else {
                const str = time2str(value as number)
                return colors ? magenta(str) : str
            }
        
        case DdbType.minute:
            if (value === null || value === nulls.int32)
                return get_nullstr()
            else {
                const str = minute2str(value as number)
                return colors ? magenta(str) : str
            }
        
        case DdbType.second:
            if (value === null || value === nulls.int32)
                return get_nullstr()
            else {
                const str = second2str(value as number)
                return colors ? magenta(str) : str
            }
        
        case DdbType.datetime:
            if (value === null || value === nulls.int32)
                return get_nullstr()
            else {
                const str = datetime2str(value as number)
                return colors ? magenta(str) : str
            }
        
        case DdbType.timestamp:
            if (value === null || value === nulls.int64)
                return get_nullstr()
            else {
                const str = timestamp2str(value as bigint)
                return colors ? magenta(str) : str
            }
        
        case DdbType.nanotime:
            if (value === null || value === nulls.int64)
                return get_nullstr()
            else {
                const str = nanotime2str(value as bigint)
                return colors ? magenta(str) : str
            }
        
        case DdbType.nanotimestamp:
            if (value === null || value === nulls.int64)
                return get_nullstr()
            else {
                const str = nanotimestamp2str(value as bigint)
                return colors ? magenta(str) : str
            }
        
        case DdbType.float:
            if (value === null || value === nulls.float32)
                return get_nullstr()
            else {
                const str = formatter.format(value as number)
                return colors ? green(str) : str
            }
        
        case DdbType.double:
            if (value === null || value === nulls.double)
                return get_nullstr()
            else {
                const str = formatter.format(value as number)
                return colors ? green(str) : str
            }
        
        case DdbType.symbol:
        case DdbType.string: {
            let str = value as string
            if (quote)
                str = str.quote('single')
            return colors ? cyan(str) : str
        }
        
        case DdbType.uuid: {
            const str = uuid2str(value as Uint8Array, le)
            return colors ? cyan(str) : str
        }
        
        case DdbType.functiondef: {
            const str = (value as DdbFunctionDefValue).name.quote('single')
            return colors ? cyan(str) : str
        }
        
        case DdbType.handle:
        case DdbType.code:
        case DdbType.datasource:
        case DdbType.resource: {
            const str = (value as string).quote('single')
            return colors ? cyan(str) : str
        }
        
        case DdbType.datehour:
            if (value === null || value === nulls.int32)
                return get_nullstr()
            else {
                const str = datehour2str(value as number)
                return colors ? magenta(str) : str
            }
        
        case DdbType.ipaddr: {
            const str = ipaddr2str(value as Uint8Array, le)
            return colors ? cyan(str) : str
        }
        
        case DdbType.int128: {
            const str = int1282str(value as Uint8Array, le)
            return colors ? cyan(str) : str
        }
        
        case DdbType.blob: {
            const str = (value as Uint8Array).length > 100 ?
                DdbObj.dec.decode(
                    (value as Uint8Array).subarray(0, 98)
                ) + '…'
            :
                DdbObj.dec.decode(value as Uint8Array)
            return colors ? cyan(str) : str
        }
        
        case DdbType.point: {
            const [x, y] = value as [number, number]
            return `(${format(DdbType.double, x, le, options)}, ${format(DdbType.double, y, le, options)})`
        }
        
        case DdbType.complex: {
            const [x, y] = value as [number, number]
            return `${format(DdbType.double, x, le, options)}+${format(DdbType.double, y, le, options)}i`
        }
        
        case DdbType.duration: {
            const { data, unit } = value as DdbDurationValue
            const str = `${data}${DdbDurationUnit[unit]}`
            return colors ? magenta(str) : str
        }
        
        case DdbType.decimal32: 
        case DdbType.decimal64:
        case DdbType.decimal128: {
            const { scale, data } = value as DdbDecimal32Value | DdbDecimal64Value | DdbDecimal128Value
            
            if (
                data === null ||
                is_decimal_null_value(type, data)
            )
                return get_nullstr()
            
            const s = String(data < 0 ? -data : data).padStart(scale, '0')
            
            const str = (data < 0 ? '-' : '') + (scale ? `${s.slice(0, -scale) || '0'}.${s.slice(-scale)}` : s)
            
            return colors ? green(str) : str
        }
        
        default:
            return value === null ? get_nullstr() : String(value)
    }
}


/** 格式化向量、集合中的第 index 项为字符串  formatted vector, the index-th item in the collection is a string */
export function formati (obj: DdbVectorObj, index: number, options: InspectOptions = { }): string {
    assert(index < obj.rows, 'index < obj.rows')
    
    if (64 <= obj.type && obj.type < 128) {  // array vector
        // 因为 array vector 目前只支持：Logical, Integral（不包括 INT128, COMPRESS 类型）, Floating, Temporal
        // 都对应 TypedArray 中的一格，所以 lengths.length 等于 block 中的 row 的个数
        // av = array(INT[], 0, 5)
        // append!(av, [1..1])
        // append!(av, [1..70000])
        // append!(av, [1..1])
        // append!(av, [1..500])
        // ...
        // av
        
        const type_ = obj.type - 64
        
        let offset = 0
        
        // array vector 中每一项如果为 null 都展示，避免多个逗号堆在一起的情况
        options = { ...options, nullstr: true }
        
        for (const { lengths, data, rows } of obj.value as DdbArrayVectorValue) {
            let acc_len = 0
            
            if (offset + rows <= index) {
                offset += rows
                continue  // 跳过这个 block
            }
            
            for (const length of lengths) {
                if (offset < index) {
                    offset++
                    acc_len += length
                    continue
                }
                
                const limit = 10
                
                let items = new Array(Math.min(limit, length))
                
                for (let i = 0;  i < items.length;  i++)
                    switch (type_) {
                        case DdbType.decimal32:
                        case DdbType.decimal64:
                        case DdbType.decimal128:
                            const x = data[acc_len + i]
                            
                            if (is_decimal_null_value(type_, x))
                                items[i] = options.colors ? grey('null') : 'null'
                            else {
                                const { scale } = obj.value as DdbArrayVectorValue
                            
                                const s = String(x < 0 ? -x : x).padStart(scale, '0')
                                
                                const str = (x < 0 ? '-' : '') + (scale ? `${s.slice(0, -scale) || '0'}.${s.slice(-scale)}` : s)
                                
                                items[i] = options.colors ? green(str) : str
                            }
                            
                            break
                        
                        case DdbType.complex:
                        case DdbType.point: {
                            const index = acc_len + i
                            items[i] = format(
                                type_,
                                data.subarray(2 * index, 2 * (index + 1)),
                                obj.le,
                                options
                            )
                            break
                        }
                        
                        case DdbType.uuid:
                        case DdbType.int128:
                        case DdbType.ipaddr: {
                            const index = acc_len + i
                            items[i] = format(
                                type_,
                                data.subarray(16 * index, 16 * (index + 1)),
                                obj.le,
                                options
                            )
                            break
                        }
                        
                        default:
                            items[i] = format(type_, data[acc_len + i], obj.le, options)
                            break
                    }
                
                return (
                    items.join(', ') + (length > limit ? ', ...' : '')
                ).bracket('square')
            }
        }
    }
    
    switch (obj.type) {
        case DdbType.symbol_extended: {
            const { base, data } = obj.value as DdbSymbolExtendedValue
            return format(DdbType.string, base[data[index]], obj.le, options)
        }
        
        case DdbType.void:
            return format(obj.type, obj.value, obj.le, options)
        
        case DdbType.uuid:
        case DdbType.int128:
        case DdbType.ipaddr:
            return format(
                obj.type,
                (obj.value as Uint8Array).subarray(16 * index, 16 * (index + 1)),
                obj.le,
                options
            )
        
        case DdbType.blob: {
            const value = obj.value[index] as Uint8Array
            return value.length > 100 ?
                    DdbObj.dec.decode(value.subarray(0, 98)) + '…'
                :
                    DdbObj.dec.decode(value)
        }
        
        case DdbType.complex:
        case DdbType.point:
            return format(
                obj.type,
                (obj.value as Float64Array).subarray(2 * index, 2 * (index + 1)),
                obj.le,
                options
            )
        
        case DdbType.decimal32:
        case DdbType.decimal64:
        case DdbType.decimal128: {
            const { scale, data } = obj.value as DdbDecimal32VectorValue | DdbDecimal64VectorValue
            
            const x = data[index]
            
            if (is_decimal_null_value(obj.type, x))
                return ''
            
            const s = String(x < 0 ? -x : x).padStart(scale, '0')
            
            const str = (x < 0 ? '-' : '') + (scale ? `${s.slice(0, -scale) || '0'}.${s.slice(-scale)}` : s)
            
            return options.colors ? green(str) : str
        }
        
        default:
            return format(obj.type, obj.value[index], obj.le, options)
    }
}



export class DdbVoid extends DdbObj<undefined> {
    constructor () {
        super({
            form: DdbForm.scalar,
            type: DdbType.void,
            value: null,
        })
    }
}


export class DdbBool extends DdbObj<boolean> {
    constructor (value: boolean | null) {
        super({
            form: DdbForm.scalar,
            type: DdbType.bool,
            value,
        })
    }
}

export class DdbChar extends DdbObj<string> {
    constructor (value: string | number | null) {
        super({
            form: DdbForm.scalar,
            type: DdbType.char,
            value: typeof value === 'string' ?
                    value.charCodeAt(0)
                :
                    value
        })
    }
}

export class DdbInt extends DdbObj<number> {
    constructor (value: number | null) {
        super({
            form: DdbForm.scalar,
            type: DdbType.int,
            value,
        })
    }
}

export class DdbString extends DdbObj<string> {
    constructor (value: string) {
        super({
            form: DdbForm.scalar,
            type: DdbType.string,
            value
        })
    }
}

export class DdbLong extends DdbObj<bigint> {
    constructor (value: bigint | null) {
        super({
            form: DdbForm.scalar,
            type: DdbType.long,
            value
        })
    }
}

export class DdbDouble extends DdbObj<number> {
    constructor (value: number | null) {
        super({
            form: DdbForm.scalar,
            type: DdbType.double,
            value
        })
    }
}

export class DdbDateTime extends DdbObj<number> {
    constructor (value: number | null) {
        super({
            form: DdbForm.scalar,
            type: DdbType.datetime,
            value
        })
    }
}

export class DdbTimeStamp extends DdbObj<bigint> {
    constructor (value: bigint | null) {
        super({
            form: DdbForm.scalar,
            type: DdbType.timestamp,
            value
        })
    }
}

export class DdbNanoTimeStamp extends DdbObj<bigint> {
    constructor (value: bigint | null) {
        super({
            form: DdbForm.scalar,
            type: DdbType.nanotimestamp,
            value
        })
    }
}

export class DdbBlob extends DdbObj<Uint8Array> {
    constructor (value: Uint8Array | ArrayBuffer) {
        assert(value, t('new DdbBlob 不能传空的 value'))
        super({
            form: DdbForm.scalar,
            type: DdbType.blob,
            value: value instanceof Uint8Array ? value : new Uint8Array(value)
        })
    }
}

export class DdbPair extends DdbObj<Int32Array> {
    constructor (l: number | null, r: number | null = null) {
        super({
            form: DdbForm.pair,
            type: DdbType.int,
            rows: 2,
            cols: 1,
            value: Int32Array.of(
                l === null ? nulls.int32 : l,
                r === null ? nulls.int32 : r,
            )
        })
    }
}

export class DdbFunction extends DdbObj<DdbFunctionDefValue> {
    constructor (name: string, type: DdbFunctionType) {
        super({
            form: DdbForm.scalar,
            type: DdbType.functiondef,
            value: { type, name }
        })
    }
}


export class DdbVectorInt extends DdbObj<Int32Array> {
    constructor (ints: (number | null)[] | Int32Array, name?: string) {
        super({
            form: DdbForm.vector,
            type: DdbType.int,
            rows: ints.length,
            cols: 1,
            value: ints instanceof Int32Array ?
                    ints
                :
                    Int32Array.from(ints, v => 
                        v === null ?
                            nulls.int32
                        :
                            v
                    ),
            name,
        })
    }
}

export class DdbVectorLong extends DdbObj<BigInt64Array> {
    constructor (longs: (number | null)[] | BigInt64Array, name?: string) {
        super({
            form: DdbForm.vector,
            type: DdbType.long,
            rows: longs.length,
            cols: 1,
            value: longs instanceof BigInt64Array ?
                    longs
                :
                    BigInt64Array.from(longs, v => 
                        v === null ?
                            nulls.int64
                        :
                            BigInt(v)
                    ),
            name,
        })
    }
}

export class DdbVectorDouble extends DdbObj<Float64Array> {
    constructor (doubles: (number | null)[] | Float64Array, name?: string) {
        super({
            form: DdbForm.vector,
            type: DdbType.double,
            rows: doubles.length,
            cols: 1,
            value: doubles instanceof Float64Array ?
                    doubles
                :
                    Float64Array.from(doubles, v => 
                        v === null ?
                            nulls.double
                        :
                            v
                    ),
            name,
        })
    }
}

export class DdbVectorString extends DdbObj<string[]> {
    constructor (strings: string[], name?: string) {
        super({
            form: DdbForm.vector,
            type: DdbType.string,
            rows: strings.length,
            cols: 1,
            value: strings,
            name,
        })
    }
}

export class DdbVectorAny extends DdbObj {
    constructor (objs: (DdbObj | string | boolean)[], name?: string) {
        super({
            form: DdbForm.vector,
            type: DdbType.any,
            rows: objs.length,
            cols: 1,
            value: DdbObj.to_ddbobjs(objs),
            name,
        })
    }
}

export class DdbVectorSymbol extends DdbObj <DdbSymbolExtendedValue> {
    constructor (strings: string[], name?: string) {
        let map = new Map<string, number>([
            ['', 0]
        ])
        
        let data = new Uint32Array(strings.length)
        
        for (let i = 0;  i < strings.length;  i++) {
            const x = strings[i]
            
            let index = map.get(x)
            
            if (index === undefined) {
                index = map.size
                map.set(x, index)
            }
            
            data[i] = index
        }
        
        super({
            form: DdbForm.vector,
            type: DdbType.symbol_extended,
            rows: strings.length,
            cols: 1,
            value: {
                base: [...map.keys()],
                base_id: null,
                data,
            },
            name
        })
    }
}

export class DdbSetInt extends DdbObj<Int32Array> {
    constructor (ints: (number | null)[] | Set<number> | Int32Array) {
        super({
            form: DdbForm.set,
            type: DdbType.int,
            rows: ints instanceof Set ? 
                    ints.size
                :
                    ints.length,
            cols: 1,
            value: ints instanceof Int32Array ?
                    ints
                :
                    Int32Array.from(ints, v => 
                        v === null ?
                            nulls.int32
                        :
                            v
                    ),
        })
    }
}

export class DdbSetDouble extends DdbObj<Float64Array> {
    constructor (doubles: (number | null)[] | Set<number> | Float64Array) {
        super({
            form: DdbForm.set,
            type: DdbType.double,
            rows: doubles instanceof Set ? 
                    doubles.size
                :
                    doubles.length,
            cols: 1,
            value: doubles instanceof Int32Array ?
                    doubles
                :
                    Int32Array.from(doubles, v => 
                        v === null ?
                            nulls.int32
                        :
                            v
                    ),
        })
    }
}

export class DdbSetString extends DdbObj<string[]> {
    constructor (strings: string[] | Set<string>) {
        if (strings instanceof Set)
            strings = [...strings]
        
        super({
            form: DdbForm.set,
            type: DdbType.string,
            rows: strings.length,
            cols: 1,
            value: strings
        })
    }
}

/** 构造 DdbDict 对象，支持两种用法:  Constructs a DdbDict object, which supports two usages:
     - 传入类型是 DdbVectorObj 的 keys, values 两个参数直接组成 dict<keys.type, values.type> 的 DdbDict  
         The incoming type is the keys of DdbObj<DdbVectorValue>, and the two parameters of values directly form the DdbDict of dict<keys.type, values.type>
     - 传入 js object (类型是 Record<string, boolean | string | DdbObj>), 自动转换为 dict<string, any> 的 DdbDict  
         Pass in js object (type is Record<string, boolean | string | DdbObj>), automatically converted to DdbDict of dict<string, any> */
export class DdbDict extends DdbObj<DdbDictValue> {
    constructor (obj: Record<string, boolean | string | DdbObj>)
    constructor (keys: DdbVectorObj, values: DdbVectorObj)
    constructor (arg0: DdbObj | Record<string, boolean | string | DdbObj>, arg1?: DdbObj) {
        if (arg1)
            super({
                form: DdbForm.dict,
                type: arg1.type,
                rows: (arg0 as DdbObj).rows,
                cols: 2,
                value: [arg0 as DdbObj, arg1] as DdbDictValue
            })
        else {
            const keys = Object.keys(arg0)
            super({
                form: DdbForm.dict,
                type: DdbType.any,
                rows: keys.length,
                cols: 2,
                value: [
                    new DdbVectorString(keys),
                    new DdbVectorAny(
                        Object.values(arg0)
                    )
                ] as DdbDictValue
            })
        }
    }
}


export class DdbTable extends DdbObj<DdbObj[]> {
    constructor (columns: DdbObj[], name: string = '') {
        super({
            form: DdbForm.table,
            type: DdbType.void,
            rows: columns[0].rows,
            cols: columns.length,
            name,
            value: columns,
        })
    }
}

export function date2ms (date: number | null) {
    // 将 server 的本地时间 (以 ms 为单位，1970.01.01 00:00:00 作为零点) 当成是客户端这里的本地的时间，然后根据本地的时区信息转换为 utc 时间
    // 本地的时区与实际的时间值相关，timezone offset 可能会受到夏令时 (DST) 的影响
    // 得到的 utc 毫秒数交给 js date 或者 dayjs 去格式化
    
    if (date === null || date === nulls.int32)
        return null
    
    const ms = 1000 * 3600 * 24 * date
    
    return 1000 * 60 * new Date(ms).getTimezoneOffset() + ms
}

export function date2str (date: number | null, format = 'YYYY.MM.DD') {
    return (date === null || date === nulls.int32) ? 
        'null'
    :
        dayjs(
            date2ms(date)
        ).format(format)
}

export function month2ms (month: number | null): number | null {
    return (month === null || month === nulls.int32) ?
        null
    :
        dayjs(
            month2str(month),
            'YYYY.MM[M]'
        ).valueOf()
}

export function month2str (month: number | null) {
    if (month === null || month === nulls.int32)
        return 'null'
    
    if (month < 0)
        return String(month)
    
    const _month = month % 12
    const year = Math.trunc(month / 12)
    return `${String(year).padStart(4, '0')}.${String(_month + 1).padStart(2, '0')}M`
}

export function time2ms (time: number | null): number | null {
    return (time === null || time === nulls.int32) ?
        null
    :
        1000 * 60 * new Date(time).getTimezoneOffset() + time
}

export function time2str (time: number | null, format = 'HH:mm:ss.SSS') {
    return (time === null || time === nulls.int32) ?
        'null'
    :
        dayjs(
            time2ms(time)
        ).format(format)
}

export function minute2ms (minute: number | null): number | null {
    if (minute === null || minute === nulls.int32)
        return null
    
    const ms = 60 * 1000 * minute
    
    return 1000 * 60 * new Date(ms).getTimezoneOffset() + ms
}

export function minute2str (minute: number | null, format = 'HH:mm[m]') {
    return (minute === null || minute === nulls.int32) ?
        'null'
    :
        dayjs(
            minute2ms(minute)
        ).format(format)
}

export function second2ms (second: number | null): number | null {
    if (second === null || second === nulls.int32)
        return null
    
    const ms = 1000 * second
    
    return 1000 * 60 * new Date(ms).getTimezoneOffset() + ms
}

export function second2str (second: number | null, format = 'HH:mm:ss') {
    return (second === null || second === nulls.int32) ?
        'null'
    :
        dayjs(
            second2ms(second)
        ).format(format)
}

export function datetime2ms (datetime: number | null): number | null {
    if (datetime === null || datetime === nulls.int32)
        return null
    
    const date = new Date(1000 * datetime)
    return dayjs(`${_datetime_formatter.format(date)}.${date.getUTCMilliseconds()}`).valueOf()
}

export function datetime2str (datetime: number | null, format = 'YYYY.MM.DD HH:mm:ss') {
    return (datetime === null || datetime === nulls.int32) ?
        'null'
    :
        dayjs(
            datetime2ms(datetime)
        ).format(format)
}

export function timestamp2ms (timestamp: bigint | null): number | null {
    if (timestamp === null || timestamp === nulls.int64)
        return null
        
    const date = new Date(Number(timestamp))
    return dayjs(`${_datetime_formatter.format(date)}.${date.getUTCMilliseconds()}`).valueOf()
}


/** format timestamp (bigint) to string 
    - timestamp: bigint value
    - format?:  
        格式串，默认是 `YYYY.MM.DD HH:mm:ss.SSS`  format string, default to `YYYY.MM.DD HH:mm:ss.SSS`  
        https://day.js.org/docs/en/parse/string-format#list-of-all-available-parsing-tokens
*/
export function timestamp2str (timestamp: bigint | null, format = 'YYYY.MM.DD HH:mm:ss.SSS') {
    return (timestamp === null || timestamp === nulls.int64) ?
        'null'
    :
        dayjs(
            timestamp2ms(timestamp)
        ).format(format)
}

export function datehour2ms (datehour: number | null): number | null {
    if (datehour === null || datehour === nulls.int32)
        return null
    
    const ms = 1000 * 3600 * datehour
    
    return 1000 * 60 * new Date(ms).getTimezoneOffset() + ms
}

export function datehour2str (datehour: number | null, format = 'YYYY.MM.DDTHH') {
    if (datehour === null || datehour === nulls.int32)
        return 'null'
    
    const ms = 1000 * 3600 * datehour
    
    return dayjs(
        1000 * 60 * new Date(ms).getTimezoneOffset() + ms
    ).format(format)
}


/** parse timestamp string to bigint value  
    - str: timestamp string, 如果为空字符串或 'null' 会返回对应的空值 (nulls.int64)  
        timestamp string, If it is an empty string or 'null', it will return the corresponding empty value (nulls.int64)
    - format?:  
        对应传入字符串的格式串，默认是 `YYYY.MM.DD HH:mm:ss.SSS`  
        The format string corresponding to the incoming string, the default is `YYYY.MM.DD HH:mm:ss.SSS`  
        https://day.js.org/docs/en/parse/string-format#list-of-all-available-parsing-tokens
*/
export function str2timestamp (str: string, format = 'YYYY.MM.DD HH:mm:ss.SSS') {
    if (!str || str === 'null')
        return nulls.int64
    
    assert(str.length === format.length, t('timestamp 字符串长度必须等于格式串长度'))
    
    const ms = dayjs(str, format).valueOf()
    
    return BigInt(
        -(1000 * 60 * new Date(ms).getTimezoneOffset()) +
        ms
    )
}

export function nanotime2ns (nanotime: bigint | null): bigint | null {
    return nanotimestamp2ns(nanotime)
}

export function nanotime2str (nanotime: bigint | null, format = 'HH:mm:ss.SSSSSSSSS') {
    if (nanotime === null || nanotime === nulls.int64)
        return 'null'
    
    if (nanotime < 0n)
        return String(nanotime)
    
    const i_second_start = format.indexOf('ss')
    assert(i_second_start !== -1, t('格式串必须包含秒的格式 (ss)'))
    
    const i_second_end = i_second_start + 2
    
    const i_nanosecond_start = format.indexOf('SSSSSSSSS', i_second_end)
    assert(i_nanosecond_start !== -1, t('格式串必须包含纳秒的格式 (SSSSSSSSS)'))
    
    const ms = Number(nanotime) / 1000000
    
    return (
        dayjs(
            1000 * 60 * new Date(ms).getTimezoneOffset() + ms
        ).format(
            format.slice(0, i_second_end)
        ) + 
        format.slice(i_second_end, i_nanosecond_start) + 
        String(nanotime % 1000000000n).padStart(9, '0')
    )
}

export function nanotimestamp2ns (nanotimestamp: bigint | null): bigint | null {
    if (nanotimestamp === null || nanotimestamp === nulls.int64)
        return null
    
    const date = new Date(Number(nanotimestamp / 1000000n))
    return BigInt(
            dayjs(`${_datetime_formatter.format(date)}.${date.getUTCMilliseconds()}`).valueOf()
        ) * 1000000n + nanotimestamp % 1000000n
}

/** format nanotimestamp value (bigint) to string 
    - nanotimestamp: bigint value
    - format?:  
        格式串，默认是 `YYYY.MM.DD HH:mm:ss.SSSSSSSSS`  format string, default is `YYYY.MM.DD HH:mm:ss.SSSSSSSSS`  
        秒的格式为 ss (必须包含); 纳秒的格式为 SSSSSSSSS (必须包含)  Seconds are in the format ss (must be included); nanoseconds are in the format SSSSSSSSS (must be included)  
        https://day.js.org/docs/en/parse/string-format#list-of-all-available-parsing-tokens
*/
export function nanotimestamp2str (nanotimestamp: bigint | null, format = 'YYYY.MM.DD HH:mm:ss.SSSSSSSSS') {
    // tests:
    // nanotimestamp2str(0n)
    // nanotimestamp2str(-1n)
    // nanotimestamp2str(-9_9999_9999n)
    // nanotimestamp2str(-10_0000_0000n)
    // nanotimestamp2str(-10_0000_0001n)
    
    if (nanotimestamp === null || nanotimestamp === nulls.int64)
        return 'null'
    
    const i_second_start = format.indexOf('ss')
    assert(i_second_start !== -1, t('格式串必须包含秒的格式 (ss)'))
    
    const i_second_end = i_second_start + 2
    
    const i_nanosecond_start = format.indexOf('SSSSSSSSS', i_second_end)
    assert(i_nanosecond_start !== -1, t('格式串必须包含纳秒的格式 (SSSSSSSSS)'))
    
    const remainder = nanotimestamp % 1000000000n
    const borrow = remainder < 0n
    
    const ms = Number((nanotimestamp - remainder + (borrow ? -1000000000n : 0n)) / 1000000n)
    
    return (
        dayjs(
            _datetime_formatter.format(new Date(ms))
        ).format(
            format.slice(0, i_second_end)
        ) + 
        format.slice(i_second_end, i_nanosecond_start) + 
        String(
            borrow ?
                (remainder + 1000000000n) % 1000000000n
            :
                remainder
        ).padStart(9, '0')
    )
}

/** parse nano timestamp string to bigint value  
    - str: nano timestamp string, 如果为空字符串或 'null' 会返回对应的空值 (nulls.int64)  
        nano timestamp string, If it is an empty string or 'null', it will return the corresponding empty value (nulls.int64)
    - format?:  
        对应传入字符串的格式串，默认是 `YYYY.MM.DD HH:mm:ss.SSSSSSSSS`  
        秒的格式为 ss (必须包含); 纳秒的格式为 SSSSSSSSS (必须包含)  
        https://day.js.org/docs/en/parse/string-format#list-of-all-available-parsing-tokens  
        The format string corresponding to the incoming string, the default is `YYYY.MM.DD HH:mm:ss.SSSSSSSSS`  
        Seconds are in the format ss (must be included); nanoseconds are in the format SSSSSSSSS (must be included) */
export function str2nanotimestamp (str: string, format = 'YYYY.MM.DD HH:mm:ss.SSSSSSSSS') {
    if (!str || str === 'null')
        return nulls.int64
    
    assert(str.length === format.length, t('nanotimestamp 字符串长度必须等于格式串长度'))
    
    const i_second_start = format.indexOf('ss')
    assert(i_second_start !== -1, t('格式串必须包含秒的格式 (ss)'))
    
    const i_second_end = i_second_start + 2
    
    const i_nanosecond_start = format.indexOf('SSSSSSSSS', i_second_end)
    assert(i_nanosecond_start !== -1, t('格式串必须包含纳秒的格式 (SSSSSSSSS)'))
    
    const ms = dayjs(
        str.slice(0, i_second_end),
        format.slice(0, i_second_end)
    ).valueOf()
    
    return (
            BigInt(
                -(1000 * 60 * new Date(ms).getTimezoneOffset()) +
                ms
            ) * 1000000n
        +
            BigInt(
                str.slice(i_nanosecond_start, i_nanosecond_start + 9)
            )
    )
}


export function ipaddr2str (buffer: Uint8Array, le = true, ipv6?: boolean) {
    let buf = buffer
    
    if (le)
        buf = buffer.slice().reverse()
    
    const i_non_zero = buf.findIndex(x => 
        x as any)
    
    if (
        ipv6 || 
        i_non_zero !== -1 && i_non_zero < 12
    ) // ipv6
        return buf2ipaddr([...buf]).toString()
    else  // ipv4
        return buf.subarray(12).join('.')
}

export function uuid2str (buffer: Uint8Array, le = true) {
    const str = int1282str(buffer, le)
    return `${str.slice(0, 8)}-${str.slice(8, 12)}-${str.slice(12, 16)}-${str.slice(16, 20)}-${str.slice(20)}`
}

export function int1282str (buffer: Uint8Array, le = true) {
    let buf = buffer
    
    if (le)
        buf = buffer.slice().reverse()
    
    return [...buf].map(x => 
        x.toString(16)
            .padStart(2, '0')
    ).join('')
}


export interface StreamingParams {
    table: string
    
    action?: string
    
    filters?: {
        /** https://docs.dolphindb.cn/zh/help/FunctionsandCommands/FunctionReferences/s/subscribeTable.html#:~:text=%E8%BF%9E%E6%8E%A5%E6%96%B0%E7%9A%84%20leader%E3%80%82-,filter%20%E5%8F%82%E6%95%B0%E9%9C%80%E8%A6%81%E9%85%8D%E5%90%88,-setStreamTableFilterColumn%20%E5%87%BD%E6%95%B0%E4%B8%80%E8%B5%B7 */
        column?: DdbObj
        
        /** 过滤条件的 DolphinDB 表达式 https://dolphindb1.atlassian.net/wiki/spaces/dev/pages/760840447/WebSocketConsole */
        expression?: string
    }
    
    handler (message: StreamingMessage): any
}


export interface StreamingMessage extends StreamingParams {
    /** server 发送消息的时间 (nano seconds since epoch)   The time the server sent the message (nano seconds since epoch)  
        std::chrono::system_clock::now().time_since_epoch() / std::chrono::nanoseconds(1) */
    time: bigint
    
    /** message id */
    id: bigint
    
    colnames: string[]
    
    /** 最新的 server 有可能先推一个 table schema 过来 */
    schema?: DdbTableObj
    
    /** 订阅主题，即一个订阅的名称。  Subscription topic, which is the name of a subscription.
        它是一个字符串，由订阅表所在节点的别名、流数据表名称和订阅任务名称（如果指定了 actionName）组合而成，使用 `/` 分隔  
        It is a string consisting of the alias of the node where the subscription table is located, the stream data table name, and the subscription task name (if actionName is specified), separated by `/` */
    topic: string
    
    /** 流数据，类型是 any vector, 其中的每一个元素对应被订阅表的一个列 (没有 name)，列 (DdbObj<DdbVectorValue>) 中的内容是新增的数据值  
        Stream data, the type is any vector, each element of which corresponds to a column (without name) of the subscribed table, and the content in the column (DdbObj<DdbVectorValue>) is the new data value */
    data: DdbObj<DdbVectorObj[]>
    
    /** 新增的流数据行数  Number of new streaming data rows */
    rows: number
    
    window: {
        /** 建立连接开始 offset = 0, 随着 window 的移动逐渐增加  The establishment of the connection starts offset = 0, and gradually increases as the window moves */
        offset: number
        
        /** segments 中 segment.row 的总和  sum of segment.row in segments */
        rows: number
        
        /** 每次接收到的 data 组成的数组  An array of data received each time */
        segments: DdbObj<DdbVectorObj[]>[]
    }
    
    /** 成功订阅后，后续推送过来的 message 解析错误，则会设置 error 并调用 handler  
        After successfully subscribed, if the subsequently pushed message is parsed incorrectly, the error will be set and the handler will be called. */
    error?: Error
}

export const winsize = 10_0000 as const


type DdbRpcType = 'script' | 'function' | 'variable' | 'connect'

export interface DdbRpcOptions {
    script?: string
    func?: string
    args?: (DdbObj | string | boolean)[]
    vars?: string[]
    urgent?: boolean
    listener?: DdbMessageListener
    parse_object?: boolean
    skip_connection_check?: boolean
    on_more_messages?: (buffer: Uint8Array) => void
}


export class DdbConnectionError extends Error {
    override name = 'DdbConnectionError'
    
    override cause?: WebSocketConnectionError
    
    url: string
    
    // 这里不保留 ddb 的引用，会导致无法序列化
    
    constructor (url: string, error?: WebSocketConnectionError) {
        super(error?.message || `${url} ${t('连接出错了，可能由于网络原因连接已被关闭，或服务器断开连接')}`, { cause: error })
        
        this.url = url
        
        if (error)
            this.cause = error
    }
}


export class DdbDatabaseError extends Error {
    override name = 'DdbDatabaseError'
    
    url: string
    
    // 这里不保留 ddb 的引用，会导致无法序列化
    
    id: number
    
    type: DdbRpcType
    
    options: DdbRpcOptions
    
    constructor (message: string, url: string, type: DdbRpcType, options: DdbRpcOptions, id: number) {
        super(message)
        this.url = url
        this.type = type
        this.options = options
        this.id = id
    }
}


/** SQL Standrd 标准类型 */
export enum SqlStandard {
    DolphinDB = 0,
    Oracle = 1,
    MySQL = 2
}


export interface DdbOptions {
    autologin?: boolean
    username?: string
    password?: string
    python?: boolean
    sql?: SqlStandard
    streaming?: StreamingParams
    verbose?: boolean
}


export class DDB {
    /** 当前的 session id (http 或 tcp) */
    sid = '0'
    
    /** utf-8 text decoder */
    dec = new TextDecoder('utf-8')
    
    enc = new TextEncoder()
    
    
    /** DolphinDB WebSocket URL
        e.g. `ws://127.0.0.1:8848/`, `wss://dolphindb.com`
    */
    url: string
    
    /** 为所有 websocket 操作加锁，包括设置 this.on_message, this.on_error, websocket.send */
    lwebsocket = new Lock<WebSocket>()
    
    
    /** little endian (server) */
    le = true
    
    /** little endian (client) */
    static le_client = Boolean(
        new Uint8Array(
            Uint32Array.of(1).buffer
        )[0]
    )
    
    /** 是否在建立连接后自动登录，默认 true  Whether to automatically log in after the connection is established, the default is true */
    autologin = true
    
    /** DolphinDB 登录用户名  DolphinDB username */
    username = 'admin'
    
    /** DolphinDB 登录密码  DolphinDB password */
    password = '123456'
    
    /** python session flag (2048) */
    python = false
    
    /** 表示本次会话执行的 SQL 标准 */
    sql = SqlStandard.DolphinDB
    
    /** 是否为流数据连接，非流数据这个字段恒为 null  Whether it is a streaming data connection, this field is always null for non-streaming data */
    streaming = null as StreamingParams
    
    /** 是否打印每个 rpc 的信息用于调试 */
    verbose = false
    
    
    // --- 内部选项, 状态
    print_message_buffer = false
    
    print_object_buffer = false
    
    print_message = true
    
    parse_object = true
    
    pnode_run_defined = false
    
    
    /** 在 websocket 收到的第一个 error 时，  
        在 connect_websocket 的 on_error 回调中构造 DdbConnectionError 并保存到 DDB 对象上，  
        这个 error 的错误信息最准确 */
    error: DdbConnectionError
    
    /** DdbMessage listeners */
    listeners: DdbMessageListener[] = [ ]
    
    /** 首次 connect 连接的 promise, 后面的 connect 调用都返回这个 */
    pconnect: Promise<void>
    
    /** 首次定义 pnode_run 的 promise，保证并发调用 rpc 时只定义一次 pnode_run */
    ppnode_run: Promise<DdbVoid>
    
    
    get connected () {
        return !this.error && this.lwebsocket.resource?.readyState === WebSocket.OPEN
    }
    
    
    /**
        使用 WebSocket URL 初始化连接到 DolphinDB 的实例（不建立实际的网络连接）  
        Initialize an instance of DolphinDB Client using the WebSocket URL (without establishing an actual network connection)  
        - url?: DolphinDB WebSocket URL，如：`ws://127.0.0.1:8848`, 默认为当前页面 URL  
            DolphinDB WebSocket URL. e.g.：`ws://127.0.0.1:8848`, Defaults to the current page URL
        - options?: DdbOptions
            - autologin?: 是否在建立连接后自动登录，默认 `true`  Whether to log in automatically after establishing a connection, default `true`
            - username?: DolphinDB 登录用户名，默认 `'admin'`  DolphinDB username, default `'admin'`
            - password?: DolphinDB 登录密码，默认 `'123456'`  DolphinDB password, default `'123456'`
            - python?: 设置 python session flag，默认 `false`  set python session flag, default `false`
            - streaming?: 设置该选项后，该 WebSocket 连接只用于流数据  When this option is set, the WebSocket connection is only used for streaming data
            - verbose?: 是否打印每个 rpc 的信息用于调试
            - sql?: 设置当前会话执行的 sql 标准, 请使用 SqlStandard 枚举进行传参，默认 `DolphinDB`
        
        @example
        let ddb = new DDB('ws://127.0.0.1:8848')
        
        // 使用 HTTPS 加密  Encrypt with HTTPS
        let ddbsecure = new DDB('wss://dolphindb.com', {
            autologin: true,
            username: 'admin',
            password: '123456',
            python: false
        }) */
    constructor (url: string, options: DdbOptions = { }) {
        this.url = url
        
        if (options.verbose !== undefined)
            this.verbose = options.verbose
        
        if (options.autologin !== undefined)
            this.autologin = options.autologin
        
        if (options.username !== undefined)
            this.username = options.username
        
        if (options.password !== undefined)
            this.password = options.password
        
        if (options.python !== undefined)
            this.python = options.python
        
        if (options.sql !== undefined)
            this.sql = options.sql
        
        if (options.streaming !== undefined)
            this.streaming = options.streaming
    }
    
    
    private on_message (buffer: Uint8Array, websocket: WebSocket) {
        throw new Error(t('这是在调用 this.rpc 之前默认的 on_message, 不应该被调用到，除非建立连接后 server 先推送了 message'))
    }
    
    private on_error () {
        // 这里的实现一定会被 connect, rpc 中的实现覆盖
    }
    
    
    /** 调用后会确保和数据库的连接是正常的 (this.connected === true)，否则抛出错误  
        这个方法是幂等的，首次调用建立实际的 WebSocket 连接到 URL 对应的 DolphinDB，然后执行自动登录，  
        如果是流数据连接，还会调用 publishTable 订阅流表  
        后续调用检查上面的条件  
        连接断开后禁止再次调用 connect 重连原有 ddb 对象，应该通过 new DDB() 的方式新建连接对象，原因是：  
        1. on_error 回调和某个 websocket 绑定了，不方便解绑后重新绑定
        2. session 是有状态的，重连也无法恢复之前的状态
        3. 断线后所有之前的 ddb.call, ddb.eval 都应该抛出连接错误
        
        After calling, it will ensure that the connection with the database is normal (this.connected === true), otherwise an error will be thrown  
        This method is idempotent, the first call establishes an actual WebSocket connection to the DolphinDB corresponding to the URL, and subsequent calls check the above conditions  
        After the connection is disconnected, it is forbidden to call connect again to reconnect the original ddb object. You should use new DDB() to create a new connection object because:  
        1. The on_error callback is bound to a certain websocket, and it is inconvenient to unbind and rebind
        2. The session is stateful, and the previous state cannot be restored even after reconnection
        3. After disconnection, all previous ddb.call, ddb.eval should throw a connection error */
    async connect () {
        if (this.connected)
            return
        
        if (this.error)
            throw this.error
        
        const { resource: websocket } = this.lwebsocket
        if (websocket && (websocket.readyState === WebSocket.CLOSING || websocket.readyState === WebSocket.CLOSED))
            throw this.error = new DdbConnectionError(this.url)
        
        return this.pconnect ??= new Promise<void>(async (resolve, reject) => {
            this.on_error = () => {
                reject(this.error /* 一定有，不需要再 || new DdbConnectionError(this)  */)
            }
            
            try {
                let url = new URL(this.url)
                if (this.streaming?.filters?.expression)
                    url.searchParams.set('filter', this.streaming.filters.expression.trim())
                
                // 连接建立之前应该不会有别的调用占用 this.lwebsocket
                this.lwebsocket.resource = await connect_websocket(url, {
                    protocols: this.streaming ? ['streaming'] : this.python ? ['python'] : undefined,
                    
                    on_message: (buffer: ArrayBuffer, websocket) => {
                        this.on_message(new Uint8Array(buffer), websocket)
                    },
                    
                    on_error: error => {
                        this.error ??= new DdbConnectionError(this.url, error)
                        this.on_error()
                    }
                })
            } catch (error) {
                this.error ??= new DdbConnectionError(this.url, error)
                reject(this.error)
                return
            }
            
            try {
                assert(this.connected)
                
                await this.rpc('connect', { skip_connection_check: true })
                
                if (this.streaming)
                    await this.subscribe()
                
                resolve()
            } catch (error) {
                this.error ??= error
                reject(error)
            }
        })
    }
    
    
    get_rpc_options ({
        urgent = false,
        secondary = false,
        async: _async = false,
        pickle = false,
        clear = false,
        api = false,
        compress = false,
        
        cancellable = true,
        priority = urgent ? 8 : 4,
        parallelism = 8,
        root_id = '',
        limit,
    }: {
        // --- flags ---
        urgent?: boolean
        
        /** API 提交的任务, secondary 必须为 false */
        secondary?: boolean
        
        /** 是否异步任务（不返回结果） */
        async?: boolean
        
        /** 让服务端以 pickle 协议返回数据 */
        pickle?: boolean
        
        /** 本次任务完成后 clear session memory */
        clear?: boolean
        
        /** 是否为 api client */
        api?: boolean
        
        compress?: boolean
        
        // --- flags end ---
        
        /** 任务是否可以取消 */
        cancellable?: boolean
        
        priority?: number
        
        /** `8` 0 ~ 64, 指定本任务并行度 */
        parallelism?: number
        
        /** 根任务编号，内部使用，API中固定为空 */
        root_id?: string
        
        /** 指定分块返回的块大小 */
        limit?: boolean
    } = { }) {
        let flag = 0
        
        if (urgent)
            flag += 1
        
        if (secondary)
            flag += 2
        
        if (_async)
            flag += 4
        
        if (pickle)
            flag += 8
        
        if (clear)
            flag += 16
        
        if (api)
            flag += 32
        
        if (compress)
            flag += 64
        
        // python session
        if (this.python)
            flag += 2048
        
        // sql standrd
        flag += 2**19 * this.sql
        
        const options = [
            flag,
            cancellable ? 1 : 0,
            priority,
            parallelism,
            ... limit ? [
                root_id,
                limit,
            ] : [ ],
        ]
        
        return options.join('_')
    }
    
    
    disconnect () {
        const { resource } = this.lwebsocket
        
        if (resource) {
            const { readyState } = resource
            
            if (readyState !== WebSocket.CLOSED && readyState !== WebSocket.CLOSING)
                // 这里不获取 lock，直接关闭连接
                resource.close(1000)
        }
    }
    
    
    /** (内部使用的方法) rpc through websocket (function/script/variable command)  
        未连接到 DDB 时调用会自动连接，连接断开时调用会抛出 DdbConnectionError  
        When the DDB is not connected, the call will be automatically connected. When the connection is disconnected, the call will throw the DdbConnectionError  
        - type: API 类型: 'script' | 'function' | 'variable' | 'connect'
        - options:
            - urgent?: 决定 `行为标识` 那一行字符串的取值（只适用于 script 和 function）
            - vars?: type === 'variable' 时必传，variable 指令中待上传的变量名
            - listener?: 处理本次 rpc 期间的消息 (DdbMessage)
            - parse_object?: 在本次 rpc 期间设置 parse_object, 结束后恢复原有  
                为 false 时返回的 DdbObj 仅含有 buffer 和 le，不做解析，以便后续转发、序列化 
            - skip_connection_check?: 在首次 await ddb.connect() 建立连接时不能再次调用 await this.connect() 确保连接状态，会导致循环依赖，  
                将这个 flag 设为 true 跳过连接状态检查 */
    async rpc <TResult extends DdbObj = DdbObj> (type: DdbRpcType, options: DdbRpcOptions) {
        // 保留调用栈信息
        const id = genid() % 1000
        
        let error = new DdbDatabaseError('', this.url, type, options, id)
        
        if (!options.skip_connection_check)
            await this.connect()
        
        const {
            script,
            func,
            args: _args = [ ],
            vars = [ ],
            urgent,
            listener,
            on_more_messages,
        } = options
        
        
        if (func === 'pnode_run')
            await (this.ppnode_run ??= this.eval<DdbVoid>(
                this.python ?
                    '\n' +
                    'def pnode_run (nodes, func_name, args, add_node_alias):\n' +
                    '    nargs = size(args)\n' +
                    '    func = funcByName(func_name)\n' +
                    '    \n' +
                    '    if not nargs:\n' +
                    '        return pnodeRun(func, nodes, add_node_alias)\n' +
                    '    \n' +
                    '    args_partial = [ ]\n' +
                    '    args_partial.append(func)\n' +
                    '    for a in args:\n' +
                    '        args_partial.append(a)\n' +
                    '    \n' +
                    '    return pnodeRun(\n' +
                    '        unifiedCall(partial, args_partial),\n' +
                    '        nodes,\n' +
                    '        add_node_alias\n' +
                    '    )\n'
                :
                    // 这个开头的空行很重要，应该可以绕过 webLoginRequired = true 时禁止执行代码
                    // 搜一下 APISocketConsole::execute
                    // https://dolphindb1.atlassian.net/browse/D20-4991
                    '\n' +
                    'def pnode_run (nodes, func_name, args, add_node_alias = true) {\n' +
                    '    nargs = size(args)\n' +
                    '    func = funcByName(func_name)\n' +
                    '    \n' +
                    '    if (!nargs)\n' +
                    '        return pnodeRun(func, nodes, add_node_alias)\n' +
                    '    \n' +
                    '    args_partial = array(any, 1 + nargs, 1 + nargs)\n' +
                    '    args_partial[0] = func\n' +
                    '    args_partial[1:] = args\n' +
                    '    return pnodeRun(\n' +
                    '        unifiedCall(partial, args_partial),\n' +
                    '        nodes,\n' +
                    '        add_node_alias\n' +
                    '    )\n' +
                    '}\n',
                { urgent: true }
            ))
        
        
        // this 上的当前配置需要在 message 到达后使用，先保存起来
        const _listeners = [...this.listeners].reverse()
        
        
        // rpc 请求期间需要独占 websocket，所以设计了一个锁，申请之后才能使用
        // ddb 世界观：需要等待上一个 rpc 结果从 server 返回之后才能发起下一个调用  
        // 违反世界观可能造成:  
        // 1. 并发多个请求只返回第一个结果（阻塞，需后续请求疏通）
        // 2. windows 下 ddb server 返回多个相同的结果
        
        // 既然上一个请求没有出现 websocket error，且函数开头已经调用了 await this.connect() 检查过，
        // 这里也乐观的认为 this.connected && !this.errored 为 true
        
        return this.lwebsocket.request(async websocket => {
            // 独占资源后先检查状态
            if (this.error)
                throw this.error
            
            const args = DdbObj.to_ddbobjs(_args)
            
            const rpc_id = ` (id = ${id})`
            
            const command = this.enc.encode(
                (() => {
                    switch (type) {
                        case 'function':
                            if (this.verbose)
                                console.log(func + args.map(arg => arg.toString()).join(', ').bracket() + rpc_id)
                            
                            return 'function\n' +
                                `${func}\n` +
                                `${args.length}\n` +
                                `${Number(DDB.le_client)}\n`
                        
                        case 'script':
                            if (this.verbose)
                                console.log(script + rpc_id)
                            
                            return 'script\n' +
                                script
                        
                        case 'variable':
                            if (this.verbose)
                                for (let i = 0;  i < vars.length;  i++)
                                    console.log(`${vars[i]} = ${args[i].toString()}`)
                            
                            return 'variable\n' +
                                `${vars.join(',')}\n` +
                                `${vars.length}\n` +
                                `${Number(DDB.le_client)}\n`
                        
                        case 'connect':
                            if (this.verbose)
                                console.log(
                                    'connect()' + 
                                    (this.autologin ? 
                                        '\n' + 
                                        `login(${this.username.quote()}, ${this.password.quote()})`
                                    :
                                        '') +
                                    rpc_id
                                )
                            
                            return 'connect\n' +
                                // 详见 InterProcessIO.cpp#APISocketConsole::parseScript 中的
                                // Util::startWith "connect"
                                (this.autologin ? 
                                    'login\n' +
                                    this.username + '\n' +
                                    this.password /* encrypted (可选参数) + '\n' + 'false' */
                                :
                                    '')
                    }
                })()
            )
            
            // 使用资源发送请求并等待请求完成
            const result = await new Promise<TResult>((resolve, reject) => {
                let first_message = true
                
                this.on_error = () => {
                    // 这里一定有了 this.error, 不需要再 || new DdbConnectionError(this)
                    reject(this.error)
                }
                
                this.on_message = buffer => {
                    if (!on_more_messages || first_message)
                        try {
                            if (this.print_message_buffer)
                                console.log(buffer)
                            
                            const message = this.parse_message(buffer, error)
                            
                            listener?.(message, this)
                            for (const listener of _listeners)
                                listener(message, this)
                            
                            const { type, data } = message
                            
                            switch (type) {
                                case 'print':
                                    if (this.print_message)
                                        console.log(data)
                                    break
                                
                                case 'object':
                                    first_message = false
                                    resolve(data as TResult)
                                    break
                                
                                case 'error':
                                    first_message = false
                                    reject(data)
                                    break
                            }
                        } catch (error) {
                            // 这里的错误并非 websocket 错误，而是 rpc 错误
                            reject(error)
                        }
                    else
                        on_more_messages(buffer)
                }
                
                websocket.send(
                    concat([
                        this.enc.encode(`API2 ${this.sid} ${command.length} / ${this.get_rpc_options({ urgent })}\n`),
                        command,
                        ... args.map(arg => arg.pack())
                    ])
                )
            })
            
            if (this.verbose)
                console.log(result.toString() + rpc_id)
            
            return result
        })
    }
    
    
    /** eval script through websocket (script command)  
        - script?: 执行的脚本  Script to execute
        - options?: 执行选项  execution options
            - urgent?: 紧急 flag，确保提交的脚本使用 urgent worker 处理，防止被其它作业阻塞  
                Urgent flag to ensure that submitted scripts are processed by urgent workers to prevent being blocked by other jobs
            - listener?: 处理本次 rpc 期间的消息 (DdbMessage)  Process messages during this rpc (DdbMessage)
            - parse_object?: 在该次 rpc 期间设置 parse_object, 结束后恢复原有，为 false 时返回的 DdbObj 仅含有 buffer 和 le，  
                不做解析，以便后续转发、序列化  
                Set parse_object during this rpc, and restore the original after the end.  
                When it is false, the returned DdbObj only contains buffer and le without parsing,   
                so as to facilitate subsequent forwarding and serialization  
    */
    async eval <T extends DdbObj> (
        script: string,
        {
            urgent,
            listener,
            parse_object,
        }: {
            urgent?: boolean
            listener?: DdbMessageListener
            parse_object?: boolean
        } = { }
    ) {
        return this.rpc<T>('script', { script, urgent, listener, parse_object })
    }
    
    
    /** call function through websocket (function command) 
        - func: 函数名  function name
        - args?: `[ ]` 调用参数 (传入的原生 string 和 boolean 会被自动转换为 DdbObj<string> 和 DdbObj<boolean>)  
            Call parameters (the incoming native string and boolean will be automatically converted to DdbObj<string> and DdbObj<boolean>)
        - options?: 调用选项  call options
            - urgent?: 紧急 flag。使用 urgent worker 执行，防止被其它作业阻塞  
                Emergency flag. Use urgent worker execution to prevent being blocked by other jobs
            - node?: 设置结点 alias 时发送到集群中对应的结点执行 (使用 DolphinDB 中的 rpc 方法)  
                When the node alias is set, it is sent to the corresponding node in the cluster for execution (using the rpc method in DolphinDB)
            - nodes?: 设置多个结点 alias 时发送到集群中对应的多个结点执行 (使用 DolphinDB 中的 pnodeRun 方法)  
                When setting multiple node aliases, send them to the corresponding multiple nodes in the cluster for execution (using the pnodeRun method in DolphinDB)
            - func_type?: 设置 node 参数时必传，需指定函数类型，其它情况下不传  
                It must be passed when setting the node parameter, the function type needs to be specified, and it is not passed in other cases
            - add_node_alias?: 设置 nodes 参数时选传，其它情况不传  
                Select to pass when setting the nodes parameter, otherwise not pass
            - listener?: 处理本次 rpc 期间的消息 (DdbMessage)  
                Process messages during this rpc (DdbMessage)
            - parse_object?: 在该次 rpc 期间设置 parse_object, 结束后恢复原有，为 false 时返回的 DdbObj 仅含有 buffer 和 le，
                不做解析，以便后续转发、序列化  
                Set parse_object during this rpc, and restore the original after the end.  
                When it is false, the returned DdbObj only contains buffer and le without parsing, 
                so as to facilitate subsequent forwarding and serialization 
            - skip_connection_check?: (内部使用) 在首次 await ddb.connect() 建立连接时不能再次调用 await this.connect() 确保连接状态，会导致循环依赖，  
                将这个 flag 设为 true 跳过连接状态检查  
                (internal use) When await ddb.connect() establishes a connection for the first time, you cannot call await this.connect() again to ensure the connection status, which will lead to circular dependencies.
                 Set this flag to true to skip connection status checks */
    async call <TResult extends DdbObj> (
        func: string,
        args: (DdbObj | string | boolean)[] = [ ],
        {
            urgent,
            node,
            nodes,
            func_type,
            add_node_alias,
            listener,
            parse_object,
            skip_connection_check,
            on_more_messages
        }: {
            urgent?: boolean
            node?: string
            nodes?: string[]
            func_type?: DdbFunctionType
            add_node_alias?: boolean
            listener?: DdbMessageListener
            parse_object?: boolean
            skip_connection_check?: boolean
            on_more_messages?:  DdbRpcOptions['on_more_messages']
        } = { }
    ) {
        if (node) {
            assert(func_type in DdbFunctionType, t('指定 node 时必须设置 func_type'))
            
            args = [
                node,
                new DdbFunction(func, func_type),
                ...args
            ]
            func = 'rpc'
        }
        
        if (nodes) {
            args = [
                new DdbVectorString(nodes),
                func,
                new DdbVectorAny(args),
                ... (() => {
                    if (typeof add_node_alias !== 'undefined')
                        return [add_node_alias]
                    
                    if (this.python)
                        return [true]
                    
                    return [ ]
                })()
            ]
            func = 'pnode_run'
        }
        
        return this.rpc<TResult>('function', {
            func,
            args,
            urgent,
            listener,
            parse_object,
            skip_connection_check,
            on_more_messages
        })
    }
    
    
    /** upload variable through websocket (variable command) */
    async upload (
        /** 上传的变量名  Uploaded variables' name */
        vars: string[],
        
        /** 上传的变量值  Uploaded variables' value */
        args: (DdbObj | string | boolean)[],
        
        {
            listener,
            parse_object,
        }: {
            listener?: DdbMessageListener
            parse_object?: boolean
        } = { }
    ) {
        assert(args.length && args.length === vars.length, t('variable 指令参数不能为空且参数名不能为空，且数量应该匹配'))
        return this.rpc('variable', { vars, args, listener, parse_object })
    }
    
    
    /** 取消当前 session id 对应的所有 console jobs  Cancel all console jobs corresponding to the current session id */
    async cancel () {
        let ddb = new DDB(this.url, this)
        
        try {
            // 因为是新建的连接，而且执行完脚本之后马上就关闭了，所以不用考虑变量泄漏的问题
            await ddb.eval(
                `jobs = exec rootJobId from getConsoleJobs() where sessionId = ${this.sid}\n` +
                (this.python ? 'if size(jobs):\n' : 'if (size(jobs))\n') +
                '    cancelConsoleJob(jobs)\n',
                { urgent: true }
            )
        } finally {
            ddb.disconnect()
        }
    }
    
    
    /** 解析服务端响应报文，返回去掉 header 的 data buf */
    parse_message (buf: Uint8Array, error: DdbDatabaseError): DdbMessage {
        // MSG\n
        // <message>\0
        // 'M'.codePointAt(0).to_hex_str()
        if (buf[0] === 0x4d && buf[1] === 0x53 && buf[2] === 0x47 && buf[3] === 0x0a) {
            assert(buf.at(-1) === 0, t('print 消息的 buffer 应该以 \\0 结束'))
            if (buf.indexOf(0) !== buf.length - 1)
                console.warn(t('print 消息的 buffer 中间不应该有 \\0'))
            return {
                type: 'print',
                data: 
                    this.dec.decode(
                        buf.subarray(4, -1)
                    )
            }
        }
        
        
        // '1166953221 1 1\n'
        // 'OK\n'
        // '\x04\x00\x02\x00\x00\x00'
        
        /** index of line feed 0 */
        const ilf0 = buf.indexOf(0x0a)  // '\n'
        
        const parts = this.dec.decode(
            buf.subarray(0, ilf0)
        ).split(' ')
        
        /** session id */
        const sid = parts[0]
        if (sid !== this.sid) {
            console.log(t('session id 从 {{sid}} 变为 {{sid_}}', { sid: this.sid, sid_: sid }))
            this.sid = sid
        }
        
        /** 返回对象的数量 */
        const nobj = Number(parts[1])
        
        /** 大小端: 协议中大端为 0, 小端为 1 */
        this.le = Number(parts[2]) !== 0
        
        const ils1 = ilf0 + 1
        const ilf1 = buf.indexOf(0x0a, ils1)  // '\n'
        /** 'OK' 表示成功，其它文本表示失败 */
        const message = this.dec.decode(
            buf.subarray(ils1, ilf1)
        )
        
        if (message !== 'OK') {
            error.message = message
            return { type: 'error', data: error }
        }
        
        const bufobj = buf.subarray(ilf1 + 1)
        
        if (this.print_object_buffer)
            console.log(bufobj)
        
        return {
            type: 'object',
            data: error.options.parse_object ?? this.parse_object ?
                    DdbObj.parse(bufobj, this.le)
                :
                    new DdbObj({
                        form: DdbForm.scalar,
                        type: DdbType.void,
                        length: 0,
                        le: this.le,
                        buffer: bufobj,
                    })
        }
    }
    
    
    /** 内部的流订阅方法  Internal stream subscription method */
    async subscribe () {
        let win: StreamingMessage['window'] = {
            offset: 0,
            rows: 0,
            segments: [ ],
        }
        
        let schema: DdbTableObj
        
        const { value: colnames } = await this.call<DdbVectorStringObj>('publishTable', [
                'localhost',
                new DdbInt(0),
                this.streaming.table,
                (this.streaming.action ||= `api_js_${new Date().getTime()}`),
                ... this.streaming?.filters?.column ? [
                    new DdbVoid(),  // offset
                    this.streaming.filters.column // filter
                ] : [ ]
            ],
            {
                skip_connection_check: true, 
                
                // 先准备好收到 websocket message 的 callback
                on_more_messages: buffer => {
                    try {
                        const dv = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength)
                        
                        const i_topic_end = buffer.indexOf(0, 17)
                        
                        // 首个 message 一定是 table schema, 后续消息是 column 片段组成的 any vector
                        const data = DdbObj.parse(buffer.subarray(i_topic_end + 1), this.le) as DdbObj<DdbVectorObj[]>
                        
                        if (!schema) {
                            schema = data
                            return
                        }
                        
                        const { rows } = data.value[0]
                        
                        win.rows += rows
                        
                        win.segments.push(data)
                        
                        if (win.rows >= winsize * 2 && win.segments.length >= 2) {
                            let winsize_ = 0
                            let i = win.segments.length - 1
                            // 往前移动至首个累计 winsize_ 超过 winsize 的位置
                            for (  ;  winsize_ < winsize;  i--)
                                winsize_ += win.segments[i].value[0].rows
                            
                            win.segments = win.segments.slice(i)
                            
                            win.offset += win.rows - winsize_
                            
                            win.rows = winsize_
                        }
                        
                        this.streaming.handler({
                            ...this.streaming,
                            id: dv.getBigInt64(9, this.le),
                            time: dv.getBigInt64(1, this.le),
                            rows,
                            topic: this.dec.decode(buffer.subarray(17, i_topic_end)),
                            colnames,
                            schema,
                            data,
                            window: win,
                        })
                    } catch (error) {
                        // 将 error 交给 handler 处理
                        this.streaming.handler({ ...this.streaming, error } as StreamingMessage)
                    }
                }
            }
        )
        
        console.log(
            t('订阅流表成功') + ', colnames:',
            
            // string[3](['time', 'stock', 'price'])
            colnames
        )
    }
}


export interface DdbMessageListener {
    (message: DdbMessage, _this: DDB): any
}


export interface DdbPrintMessage {
    type: 'print'
    data: string
}

export interface DdbObjectMessage {
    type: 'object'
    data: DdbObj
}

export interface DdbErrorMessage {
    type: 'error'
    data: DdbDatabaseError
}

export type DdbMessage = DdbPrintMessage | DdbObjectMessage | DdbErrorMessage

