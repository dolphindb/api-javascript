import { set_inspect_options } from 'xshell'

import { DDB } from '../index.js'
import { test_print } from './print.js'
import { test_types } from './types.js'
import { test_time } from './time.js'
import { test_streaming } from './streaming.js'
import { test_error } from './error.js'


set_inspect_options()


// linux
export const url = 'ws://192.168.0.16:9002' as const

// windows
// export const url = 'ws://192.168.0.29:9002' as const

// local 8848
// export const url = 'ws://127.0.0.1:8848' as const


;(async function test () {
    console.log('--- 测试开始 ---'.green)
    
    let ddb = new DDB(url)
    
    const tests = [
        test_types,
        test_print,
        test_time,
        test_streaming,
        test_error,
    ]
    
    for (const fn_test of tests)
        await fn_test(ddb)
    
    ddb.disconnect()
    
    console.log('--- 测试通过 ---'.green)
})()


export async function get_printed (ddb: DDB, code: string) {
    return new Promise<string>(async (resolve, reject) => {
        try {
            let resolved = false
            await ddb.eval(
                `print(${code})`,
                {
                    listener ({ type, data }) {
                        if (type === 'print' && !resolved) {
                            resolved = true
                            resolve(data)
                        }
                    }
                }
            )
            if (!resolved)
                reject(new Error('未输出 print 消息'))
        } catch (error) {
            reject(error)
        }
    })
}
