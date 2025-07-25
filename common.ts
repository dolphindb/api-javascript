import { default as dayjs, type Dayjs } from 'dayjs'
import DayjsCustomParseFormat from 'dayjs/plugin/customParseFormat.js'
dayjs.extend(DayjsCustomParseFormat)

import 'xshell/prototype.common.js'
import { check } from 'xshell/utils.common.js'

import ipaddrjs from 'ipaddr.js'
const { fromByteArray: buf2ipaddr } = ipaddrjs

import { t } from './i18n/index.ts'


export const nulls = {
    int8: -0x80,  // -128
    int16: -0x80_00,  // -32768
    int32: -0x80_00_00_00,  // -21_4748_3648
    int64: -0x80_00_00_00_00_00_00_00n,  // -922_3372_0368_5477_5808
    int128: -0x80_00_00_00_00_00_00_00_00_00_00_00_00_00_00_00n,  // -170_1411_8346_0469_2317_3168_7303_7158_8410_5728
    float32: -3.4028234663852886e+38,
    
    /** -Number.MAX_VALUE */
    double: -Number.MAX_VALUE,
    
    bytes16: Uint8Array.from(
        new Array(16).fill(0)
    )
} as const


export enum DdbForm {
    scalar = 0,
    vector = 1,
    pair = 2,
    matrix = 3,
    set = 4,
    dict = 5,
    table = 6,
    chart = 7,
    
    /** 节点内部通信可能会使用，调用函数执行脚本一般不会返回这种类型 */
    chunk = 8,
    
    /** sysobj */
    object = 9,
    tensor = 10,
}


/** DolphinDB DataType  
    对应的 array vector 类型为 64 + 基本类型
    对应的 extended 类型为 128 + 基本类型 */
export enum DdbType {
    void = 0,
    bool = 1,
    char = 2,
    short = 3,
    int = 4,
    long = 5,
    date = 6,
    month = 7,
    time = 8,
    minute = 9,
    second = 10,
    datetime = 11,
    timestamp = 12,
    nanotime = 13,
    nanotimestamp = 14,
    float = 15,
    double = 16,
    symbol = 17,
    string = 18,
    uuid = 19,
    functiondef = 20,
    handle = 21,
    code = 22,
    datasource = 23,
    resource = 24,
    any = 25,
    compressed = 26,
    dict = 27,
    datehour = 28,
    ipaddr = 30,
    int128 = 31,
    blob = 32,
    complex = 34,
    point = 35,
    duration = 36,
    
    decimal32 = 37,
    decimal64 = 38,
    decimal128 = 39,
    
    object = 40,
    iotany = 41,
    
    symbol_extended = 145,  // 128 + DdbType.symbol
}


export enum DdbFunctionType {
    SystemFunc = 0,
    SystemProc = 1,
    OperatorFunc = 2,
    UserDefinedFunc = 3,
    PartialFunc = 4,
    DynamicFunc = 5,
    PiecewiseFunc = 6,
    JitFunc = 7,
    JitPartialFunc = 8,
}


export enum DdbDurationUnit {
    ns = 0,
    us = 1,
    ms = 2,
    s = 3,
    m = 4,
    H = 5,
    d = 6,
    w = 7,
    M = 8,
    y = 9,
    B = 10
}


export enum DdbChartType {
    area = 0,
    bar = 1,
    column = 2,
    histogram = 3,
    line = 4,
    pie = 5,
    scatter = 6,
    trend = 7,
    kline = 8,
}


// server 实现中区分了 0: NULL (nothing), 1: NULL (null), 2: DFLT (default)
// Void::serialize()
//     (isNothing() ? 0 : 1) + (isDefault_ ? 2 : 0);
export enum DdbVoidType {
    undefined = 0,
    null = 1,
    default = 2
}


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
    /** int32, data 需要除以 10^scale 得到原值 */
    scale: number
    
    /** int32, 空值为 null  ddb null is js null */
    data: number | null
}

export interface DdbDecimal64Value {
    /** int32, data 需要除以 10^scale 得到原值 */
    scale: number
    
    /** int64, 空值为 null  empty value is null */
    data: bigint | null
}

export interface DdbDecimal128Value {
    /** int32, data 需要除以 10^scale 得到原值 */
    scale: number
    
    /** int128, 空值为 null  empty value is null */
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


export const dictables = new Set([DdbType.any, DdbType.string, DdbType.double, DdbType.float, DdbType.int, DdbType.long])


/** 工具，取得某个 DdbType 的字节数 */
export const ddb_tensor_bytes: Record<
    DdbType.bool | DdbType.char | DdbType.short | DdbType.int | DdbType.long | DdbType.float | DdbType.double, 
    number
> = {
    [DdbType.bool]: 1,
    [DdbType.char]: 1,
    [DdbType.short]: 2,
    [DdbType.int]: 4,
    [DdbType.long]: 8,
    [DdbType.float]: 4,
    [DdbType.double]: 8,
}


export type TensorElem = TensorData | boolean | number | bigint | null | string
export interface TensorData extends Array<TensorElem> { }

export interface DdbTensorMetadata {
    /** Tensor 的元素的数据类型 */
    data_type: DdbType
    
    /** Tensor 类型 */
    tensor_type: number
    
    /** 设备类型 */
    device_type: number
    
    /** Tensor Flags */
    tensor_flags: number
    
    /** 维度 */
    dimensions: number
    
    /** shape, shape[i] 表示第 i 个维度的 size */
    shape: number[]
    
    /** strides, strides[i] 表示在第 i 个维度，一个元素与下一个元素的距离 */
    strides: number[]
    
    /** 保留值 */
    preserve_value: bigint
    
    /** 元素个数 */
    elem_count: number
}

export interface DdbTensorValue extends DdbTensorMetadata {
    /** 数据 */
    data: Uint8Array
}


/** DdbObj.data() 返回的表格对象 */
export interface DdbTableData <TRow = any> {
    /** 表名 */
    name: string
    
    /** 每一列的名称 */
    columns: string[]
    
    /** 每一列的原始 ddb 数据类型 */
    types: DdbType[]
    
    /** 表格数据，每一行的对象组成的数组 */
    data: TRow[]
}

/** DdbObj.data() 返回的 Tensor 对象 */
export interface DdbTensorData extends DdbTensorMetadata {
    /** 数据 */
    data: TensorData
}


/** DdbObj.data() 返回的矩阵对象 */
export interface DdbMatrixData {
    /** 原始数据类型 */
    type: DdbType
    
    /** 行数 */
    nrows: number
    
    /** 列数 */
    ncolumns: number
    
    /** 行名称 */
    rows?: any[]
    
    /** 列名称 */
    columns?: any[]
    
    /** 数据， data[0][1] 为第 0 行第 1 列数据 */
    data: any[][]
}


export type DdbScalarValue = 
    null | boolean | number | bigint | string |
    Uint8Array | // uuid, ipaddr, int128, blob
    [number, number] | // complex, point
    DdbFunctionDefValue |
    DdbDurationValue | 
    DdbDecimal32Value | DdbDecimal64Value | DdbDecimal128Value


export type IotVectorItemValue = [number | string | bigint | boolean][]


/** 根据 DdbType 获取其名称，array vector type 自动在后面加上 [] */
export function get_type_name (type: DdbType) {
    return `${DdbType[type] || type}${ 64 <= type && type < 128 ? '[]' : '' }`
}


export function is_decimal_type (type: DdbType) {
    return type === DdbType.decimal32 || type === DdbType.decimal64 || type === DdbType.decimal128
}


export function is_decimal_null_value (type: DdbType, value: number | bigint) {
    return (
        (value === nulls.int128 && type === DdbType.decimal128) ||
        (value === nulls.int64 && type === DdbType.decimal64) ||
        (value === nulls.int32 && type === DdbType.decimal32)
    )
}

export function get_duration_unit (code: number) {
    let str = String.fromCharCode((code >> 24) & 0xff)
    str += String.fromCharCode((code >> 16) & 0xff)
    str += String.fromCharCode((code >> 8) & 0xff)
    str += String.fromCharCode(code & 0xff)
    return str
}


export function get_ddb_time_value (
    classname: 'DdbDateTime' | 'DdbTimeStamp' | 'DdbNanoTimeStamp' | 'DdbDate',
    value: null | number | string | Date | Dayjs,
): number | bigint | null {
    if (value === null)
        return null
    
    if (classname === 'DdbNanoTimeStamp' && typeof value === 'string')
        return str2nanotimestamp(value)
    
    let date: Date
    
    if (value === undefined)
        date = new Date()
    else if (typeof value === 'number' || typeof value === 'string')
        date = new Date(value)
    else if (value instanceof Date)
        date = value
    else if (dayjs.isDayjs(value))
        date = new Date(value.valueOf())
    else
        throw new Error(t('value 不能转换为 {{classname}}', { classname }))
    
    switch (classname) {
        case 'DdbDateTime':
            return (date.getTime() - 1000 * 60 * date.getTimezoneOffset()) / 1000
        
        case 'DdbTimeStamp':
            return BigInt(date.getTime() - 1000 * 60 * date.getTimezoneOffset())
        
        case 'DdbNanoTimeStamp':
            return BigInt(date.getTime() - 1000 * 60 * date.getTimezoneOffset()) * 1000000n
        
        case 'DdbDate':
            return Math.floor((date.getTime() - 1000 * 60 * date.getTimezoneOffset()) / (1000 * 3600 * 24))
    }
}


// DataView Extends for bigint 128 operations
export function get_big_uint_128 (dataview: DataView, byte_offset: number, le = true) {
    let cursor = byte_offset + (le ? 15 : 0)
    const end = byte_offset + (le ? -1 : 16)
    const step = le ? -1 : 1
    let value = 0n
    
    while (cursor !== end) {
        value = value << 8n | BigInt(dataview.getUint8(cursor))
        cursor += step
    }
    
    return value
}

export function get_big_int_128 (dataview: DataView, byte_offset: number, le = true) {
    return BigInt.asIntN(128, get_big_uint_128(dataview, byte_offset, le))
}


export function set_big_uint_128 (dataView: DataView, byte_offset: number, value: bigint, le = true) {
    let cursor = byte_offset + (le ? 0 : 15)
    const end = byte_offset + (le ? 16 : -1)
    const step = le ? 1 : -1
    
    while (cursor !== end) {
        dataView.setUint8(cursor, Number(value & 0xffn))
        value = value >> 8n
        cursor += step
    }
}

export function set_big_int_128 (dataview: DataView, byte_offset: number, value: bigint, le = true) {
    set_big_uint_128(dataview, byte_offset, value, le)
}

export function generate_array_type (baseType: string, dimensions: number[]): string {
    let result = baseType
    dimensions.forEach(dimension => {
        result += `[${dimension}]`
    })
    return result
}


// 大端
// const dataBE = new ArrayBuffer(16)
// const dataViewBE = new DataView(dataBE)
// set_big_int_128(dataViewBE, 0, -34355n, false)
// console.log(dataViewBE.buffer)
// const bigInt128BE = get_big_int_128(dataViewBE, 0, false)
// const bigUint128BE = get_big_uint_128(dataViewBE, 0, false)
// console.log(bigInt128BE.toString(), bigUint128BE.toString())

// 小端
// const dataLE = new ArrayBuffer(16)
// const dataViewLE = new DataView(dataLE)
// set_big_int_128(dataViewLE, 0, -34355n, true)
// console.log(dataViewLE.buffer)
// const bigInt128LE = get_big_int_128(dataViewLE, 0, true)
// const bigUint128LE = get_big_uint_128(dataViewLE, 0, true)
// console.log(bigInt128LE.toString(), bigUint128LE.toString())


/** 用来处理时差  To deal with jet lag */
let _datetime_formatter = new Intl.DateTimeFormat('zh-CN', { dateStyle: 'short', timeStyle: 'medium', timeZone: 'UTC', hour12: false })


export function date2ms (date: number | null) {
    // 将 server 的本地时间 (以 ms 为单位，1970.01.01 00:00:00 作为零点) 作为 UTC-0 格式化为字符串，然后根据本地的时区解析这个字符串转换为 UTC-8
    // 本地的时区与实际的时间值相关，getTimezoneOffset() 可能会受到夏令时 (DST) 的影响，不能使用
    // 得到的 utc 毫秒数交给 js date 或者 dayjs 去格式化
    
    if (date === null || date === nulls.int32)
        return null
    
    const ms = 1000 * 3600 * 24 * date
    
    return timestamp2ms(ms)
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
        timestamp2ms(time)
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
    
    return timestamp2ms(ms)
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
    
    return timestamp2ms(ms)
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
    return new Date(`${_datetime_formatter.format(date)}.${String(date.getUTCMilliseconds()).padStart(3, '0')}`).valueOf()
}

export function datetime2str (datetime: number | null, format = 'YYYY.MM.DD HH:mm:ss') {
    return (datetime === null || datetime === nulls.int32) ?
        'null'
    :
        dayjs(
            datetime2ms(datetime)
        ).format(format)
}

/** _datetime_formatter.format 会在 date 为 Invalid Date 时抛出错误 */
export function timestamp2ms (timestamp: bigint | number | null): number | null {
    if (timestamp === null || timestamp === nulls.int64)
        return null
    
    const date = new Date(Number(timestamp))
    return new Date(`${_datetime_formatter.format(date)}.${String(date.getUTCMilliseconds()).padStart(3, '0')}`).valueOf()
}


/** format timestamp (bigint) to string  
    - timestamp: bigint value
    - format?:  
        格式串，默认是 `YYYY.MM.DD HH:mm:ss.SSS`  format string, default to `YYYY.MM.DD HH:mm:ss.SSS`  
        https://day.js.org/docs/en/parse/string-format#list-of-all-available-parsing-tokens */
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
    
    return timestamp2ms(ms)
}

export function datehour2str (datehour: number | null, format = 'YYYY.MM.DDTHH') {
    if (datehour === null || datehour === nulls.int32)
        return 'null'
    
    const ms = 1000 * 3600 * datehour
    
    return dayjs(
        timestamp2ms(ms)
    ).format(format)
}


/** parse timestamp string to bigint value  
    - str: timestamp string, 如果为空字符串或 'null' 会返回对应的空值 (nulls.int64)  
        timestamp string, If it is an empty string or 'null', it will return the corresponding empty value (nulls.int64)
    - format?:  
        对应传入字符串的格式串，默认是 `YYYY.MM.DD HH:mm:ss.SSS`  
        The format string corresponding to the incoming string, the default is `YYYY.MM.DD HH:mm:ss.SSS`  
        https://day.js.org/docs/en/parse/string-format#list-of-all-available-parsing-tokens */
export function str2timestamp (str: string, format = 'YYYY.MM.DD HH:mm:ss.SSS') {
    if (!str || str === 'null')
        return nulls.int64
    
    check(str.length === format.length, t('timestamp 字符串长度必须等于格式串长度'))
    
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
    check(i_second_start !== -1, t('格式串必须包含秒的格式 (ss)'))
    
    const i_second_end = i_second_start + 2
    
    const i_nanosecond_start = format.indexOf('SSSSSSSSS', i_second_end)
    check(i_nanosecond_start !== -1, t('格式串必须包含纳秒的格式 (SSSSSSSSS)'))
    
    const ms = Number(nanotime) / 1000000
    
    return (
        dayjs(
            timestamp2ms(ms)
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
            new Date(`${_datetime_formatter.format(date)}.${String(date.getUTCMilliseconds()).padStart(3, '0')}`).valueOf()
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
    check(i_second_start !== -1, t('格式串必须包含秒的格式 (ss)'))
    
    const i_second_end = i_second_start + 2
    
    const i_nanosecond_start = format.indexOf('SSSSSSSSS', i_second_end)
    check(i_nanosecond_start !== -1, t('格式串必须包含纳秒的格式 (SSSSSSSSS)'))
    
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
    
    check(str.length === format.length, t('nanotimestamp 字符串长度必须等于格式串长度'))
    
    const i_second_start = format.indexOf('ss')
    check(i_second_start !== -1, t('格式串必须包含秒的格式 (ss)'))
    
    const i_second_end = i_second_start + 2
    
    const i_nanosecond_start = format.indexOf('SSSSSSSSS', i_second_end)
    check(i_nanosecond_start !== -1, t('格式串必须包含纳秒的格式 (SSSSSSSSS)'))
    
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
    
    const i_non_zero = buf.findIndex(x => x !== 0)
    
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


export interface ConvertOptions {
    /** `'string'` blob 转换格式 */
    blob?: 'string' | 'binary'
    
    /** `'string'` char 转换格式: string 转为 string[]，number 转为 number[] */
    char?: 'string' | 'number'
    
    /** `'strings'` char vector 转换格式: strings 转为 string[], binary 转为 Uint8Array */
    chars?: 'strings' | 'binary'
    
    /** `'ms'` timestamp 类型转换为字符串表示时显示到秒还是毫秒 */
    timestamp?: 's' | 'ms'
    
    /** `'data'` 表格类型返回格式: data 转为 TResult, full 转为 DdbTableData */
    table?: 'data' | 'full'
}


export const winsize = 10000 as const

export type DdbRpcType = 'script' | 'function' | 'variable' | 'connect'

export const function_definition_pattern = /\bdef (\w+) \(/
