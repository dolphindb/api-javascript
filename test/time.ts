import { assert, inspect } from 'xshell'

import {
    type DDB,
    type DdbObj,
    month2ms
} from '../index.js'

import { get_printed } from './index.js'


export async function test_time (ddb: DDB) {
    console.log('测试时间显示')

    await time2str_equal(ddb, '2022-09-01T14:30:01.095')
    await time2str_equal(ddb, '2022-07-01T00:00:00.000')
    await time2str_equal(ddb, '2022-07-02T00:00:00.000')
    await time2str_equal(ddb, '2022-06-30T00:00:00.000')
    await time2str_equal(ddb, '2022-12-22T16:57:30.248')
    
    
    console.log('测试 month2ms')
    assert(
        month2ms(
            (
                await ddb.eval<DdbObj<number>>('2022.12M')
            ).value
        ) === new Date('2022.12.01').valueOf()
    )
}


async function time2str_equal (ddb: DDB, timestr: string) {
    const code = `temporalParse('${timestr}', 'yyyy-MM-ddTHH:mm:sss.SSS')`
    
    assert(
        inspect(
            await ddb.eval(code),
            { colors: false }
        ).slice('timestamp('.length, -1) === 
        (
            await get_printed(ddb, code)
        ).replace('T', ' ')
    )
}
