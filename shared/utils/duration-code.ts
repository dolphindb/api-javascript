export function to_exchange_str (code: number) {
    let str = String.fromCharCode((code >> 24) & 255)
    str += String.fromCharCode((code >> 16) & 255)
    str += String.fromCharCode((code >> 8) & 255)
    str += String.fromCharCode(code & 255)
    return str
}
