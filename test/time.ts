import { assert, inspect } from 'xshell'

import { type DDB } from '../index.js'


export async function test_time (ddb: DDB) {
    console.log('测试时间显示')
    
    await ddb.eval(
        'print(\n' +
        "    temporalParse('2022-09-01T14:30:01.095', 'yyyy-MM-ddTHH:mm:sss.SSS')\n" +
        ')\n',
        {
            listener: (message) => {
                if (message.type === 'print')
                    assert(message.data === '2022.09.01T14:30:01.095')
            }
        }
    )
    
    console.log(
        await ddb.eval(
            "temporalParse('2022-09-01T14:30:01.095', 'yyyy-MM-ddTHH:mm:sss.SSS')\n"
        )
    )
    
    await ddb.eval(
        'print(\n' +
        "    temporalParse('2022-09-01T14:30:01.095', 'yyyy-MM-ddTHH:mm:sss.SSS')\n" +
        ')\n'
    )
    
    console.log(
        await ddb.eval(
            "temporalParse('2022-07-01T00:00:00.000', 'yyyy-MM-ddTHH:mm:sss.SSS')\n"
        )
    )
    
    await ddb.eval(
        'print(\n' +
        "    temporalParse('2022-07-01T00:00:00.000', 'yyyy-MM-ddTHH:mm:sss.SSS')\n" +
        ')\n'
    )
    
    console.log(
        await ddb.eval(
            "temporalParse('2022-07-02T00:00:00.000', 'yyyy-MM-ddTHH:mm:sss.SSS')\n"
        )
    )
    
    await ddb.eval(
        'print(\n' +
        "    temporalParse('2022-07-02T00:00:00.000', 'yyyy-MM-ddTHH:mm:sss.SSS')\n" +
        ')\n'
    )
    
    console.log(
        await ddb.eval(
            "temporalParse('2022-06-30T00:00:00.000', 'yyyy-MM-ddTHH:mm:sss.SSS')\n"
        )
    )
    
    await ddb.eval(
        'print(\n' +
        "    temporalParse('2022-06-30T00:00:00.000', 'yyyy-MM-ddTHH:mm:sss.SSS')\n" +
        ')\n'
    )
    
    console.log(
        await ddb.eval('now()')
    )
    
    await ddb.eval(
        'print(now())\n'
    )
}
