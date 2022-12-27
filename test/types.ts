import assert from 'assert/strict'

import {
    type DDB,
    DdbInt,
    DdbForm,
    DdbType,
    DdbVectorDouble,
    DdbObj,
    type DdbStringObj,
} from '../index.js'


export async function test_types (ddb: DDB) {
    console.log('测试通过 ddb.call 调用 getNodeAlias 函数')
    console.log(await ddb.call('getNodeAlias'))
    
    console.log('测试 ddb.call 上传不同类型的变量')
    const result0 = await ddb.call('typestr', [new DdbInt(1)])
    console.log(result0)
    assert(result0.form === DdbForm.scalar)
    assert(result0.type === DdbType.string)
    assert(result0.value === 'INT')
    
    console.log('测试 ddb.call 上传不同类型的变量')
    const result1 = await ddb.call('typestr', [new DdbVectorDouble([0.1, 0.2, 0.3])])
    console.log(result1)
    assert(result1.form === DdbForm.scalar)
    assert(result1.type === DdbType.string)
    assert(result1.value === 'FAST DOUBLE VECTOR')
    
    console.log('测试 array vector')
    const av = await ddb.eval(
        'av = array(INT[], 0, 3)\n' +
        'append!(av, [1..4])\n' +
        'append!(av, [1..70000])\n' +
        'av\n'
    )
    
    console.log(av)
    assert(av.form === DdbForm.vector)
    assert(av.type === DdbType.int + 64)  // array vector 的 type 比较特殊，需要偏移 64
    assert(av.rows === 2)
    
    
    console.log('测试大数据')
    let bigarr = new Float64Array(10)
    bigarr.fill(0.5)
    
    await ddb.call<DdbStringObj>('typestr', [
        new DdbObj({
            form: DdbForm.vector,
            type: DdbType.double,
            length: 0,
            rows: bigarr.length,
            cols: 1,
            value: bigarr
        })
    ])
    
    await ddb.upload(['a'], [
        new DdbObj({
            form: DdbForm.vector,
            type: DdbType.double,
            length: 0,
            rows: bigarr.length,
            cols: 1,
            value: bigarr
        })
    ])
    
    assert((
        await ddb.eval<DdbVectorDouble>('a')
    ).rows === bigarr.length)
}
