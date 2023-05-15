import { nulls, DdbType } from '../constants.js'


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
