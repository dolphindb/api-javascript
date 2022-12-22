import { assert } from 'xshell'

import { type DDB } from '../index.js'

import { get_printed } from './index.js'

export async function test_print (ddb: DDB) {
    console.log('测试 print message')
    
    const str = 'test print message\n中文'
    
    assert(await get_printed(ddb, str.quote()) === str)
}
