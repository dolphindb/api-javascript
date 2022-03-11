import assert from 'assert/strict'

import {
    type DDB,
    DdbForm,
    DdbType,
} from '../index.js'


export async function test_print (ddb: DDB) {
    console.log('测试 array vector 和 print message')
    const av = await ddb.eval(
        'print("test print message 中文")\n' +
        'av = array(INT[], 0, 3)\n' +
        'append!(av, [1..4])\n' +
        'append!(av, [1..70000])\n' +
        'av\n'
    )
    console.log(av)
    assert(av.form === DdbForm.vector)
    assert(av.type === DdbType.int + 64)  // array vector 的 type 比较特殊，需要偏移 64
    assert(av.rows === 2)
}
