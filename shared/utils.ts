import { nulls, DdbType } from './constants.js'


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
    let str = String.fromCharCode((code >> 24) & 255)
    str += String.fromCharCode((code >> 16) & 255)
    str += String.fromCharCode((code >> 8) & 255)
    str += String.fromCharCode(code & 255)
    return str
}

