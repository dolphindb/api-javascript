import { DDB } from '../index.js'

import { url } from './index.js'


export async function test_streaming (ddb: DDB) {
    console.log('测试流数据')
    
    await ddb.eval(
        'try {\n' +
        "    if (!defined('prices', SHARED)) {\n" +
        '        share(\n' +
        '            streamTable(\n' +
        '                10000:0,\n' +
        "                ['time', 'stock', 'price'],\n" +
        '                [TIMESTAMP, SYMBOL, DOUBLE]\n' +
        '            ),\n' +
        "            'prices'\n" +
        '        )\n' +
        "        print('prices 流表创建成功')\n" +
        '    } else\n' +
        "        print('prices 流表已存在')\n" +
        '} catch (error) {\n' +
        "    print('prices 流表创建失败')\n" +
        '    print(error)\n' +
        '}\n'
    )
    
    let rows = 0
    let resolve: Function
    let promise = new Promise(_resolve => resolve = _resolve)
    
    let sddb = new DDB(url, {
        streaming: {
            table: 'prices',
            handler (message) {
                //  console.log(message)
                 rows += message.rows
                 if (rows === 50)
                    resolve()
            },
        }
    })
    
    await sddb.connect()
    
    await ddb.eval(
        'n = 5\n' +
        '\n' +
        'for (i in 0..9)\n' +
        '    append!(\n' +
        '        prices,\n' +
        '        table([\n' +
        '            (now() + 0..(n-1)) as time,\n' +
        "            take(['MSFT', 'FUTU'], n) as stock,\n" +
        '            (0..(n-1) \\ 10) as price\n' +
        '        ])\n' +
        '    )\n'
    )
    
    await promise
    console.log('流数据已全部收齐')
    
    sddb.disconnect()
}