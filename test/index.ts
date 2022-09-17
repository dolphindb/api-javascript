import util from 'util'

import { DDB } from '../index.js'
import { test_print } from './print.js'
import { test_types } from './types.js'

;(async function test () {
    util.inspect.defaultOptions.colors = true
    
    console.log('--- 测试开始 ---')
    
    console.log('连接到 ws://127.0.0.1:8848')
    let ddb = new DDB('ws://127.0.0.1:8848')
    await ddb.connect()
    
    const tests = [
        test_types,
        test_print,
    ]
    
    for (const fn_test of tests)
        await fn_test(ddb)
    
    ddb.disconnect()
    
    console.log('--- 测试通过 ---')
})()
