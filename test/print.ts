import { assert } from 'xshell'

import { DDB, DdbLong, DdbVectorAny, DdbVectorSymbol } from '../index.js'

import { get_printed, url } from './index.js'

export async function test_print (ddb: DDB) {
    console.log('测试 print message')
    
    const str = 'test print message\n中文'
    
    assert(await get_printed(ddb, str.quote()) === str)
    
    console.log('测试 verbose 输出')
    
    let vddb = new DDB(url, { verbose: true })
    
    await vddb.call('typestr', [
        new DdbVectorAny([
            new DdbVectorSymbol(['a', 'b', 'a', 'b', 'a', 'b']),
            new DdbLong(3n)
        ])
    ])
    
    vddb.disconnect()
}
