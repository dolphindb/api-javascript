import { deepEqual } from 'assert/strict'

import { assert, defer, fexists, inspect, MyProxy, set_inspect_options, WebSocketConnectionError } from 'xshell'

import { keywords } from './language.js'
import {
    DDB, DdbConnectionError, DdbDatabaseError, DdbForm, DdbInt, DdbLong, DdbObj, DdbType, 
    DdbVectorAny, DdbVectorDouble, DdbVectorSymbol, month2ms, DdbDurationUnit,
    type DdbStringObj, type DdbVectorAnyObj, type DdbDurationVectorValue, type DdbVectorObj, type DdbTableObj, DdbTimeStamp,
    type DdbDictObj
} from './index.js'


set_inspect_options()


// linux
// export const url = 'ws://115.239.209.123:8892' as const
const url = 'ws://192.168.0.200:20023' as const
// export const url = 'ws://192.168.0.29:9002' as const

// windows
// export const url = 'ws://192.168.0.29:9002' as const

// local 8848
// export const url = 'ws://127.0.0.1:8848' as const

const ddb_options = fexists('T:/TEMP/', { print: false }) ? { proxy: MyProxy.work } : { }


;(async function test () {
    console.log('--- 测试开始 ---'.green)
    
    let ddb = new DDB(url, ddb_options)
    
    const tests = [
        test_repl,
        
        test_keywords,
        test_types,
        test_reconnection,
        test_connection_error,
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



function test_keywords () {
    assert(new Set(keywords).size === keywords.length, 'keywords 中不能有重复的项')
}


async function get_printed (ddb: DDB, code: string) {
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


async function test_repl (ddb: DDB) {
    
}


async function test_reconnection (ddb: DDB) {
    let _ddb = new DDB(url, ddb_options)
    
    await _ddb.connect()
    _ddb.disconnect()
    
    let error: DdbConnectionError
    
    try {
        await _ddb.connect()
    } catch (_error) {
        error = _error
    }
    
    assert(error && error instanceof DdbConnectionError)
}


async function test_connection_error (ddb: DDB) {
    let _ddb = new DDB(url, ddb_options)
    
    await _ddb.connect()
    _ddb.disconnect()
    
    let error: DdbConnectionError
    
    try {
        await _ddb.eval('1 + 1')
    } catch (_error) {
        error = _error
    }
    
    assert(error && error instanceof DdbConnectionError)
}


async function test_error (ddb: DDB) {
    console.log('测试 DdbDatabaseError 和 DdbConnectionError')
    
    const error_message = '错误消息'
    const error_script = `throw ${error_message.quote()}`
    
    let database_error: DdbDatabaseError
    
    try {
        await ddb.eval(error_script)
    } catch (error) {
        database_error = error
    }
    
    assert(database_error)
    assert(database_error instanceof DdbDatabaseError)
    assert(database_error.message === `throw ${error_message.quote('double')} => ${error_message}`)
    assert(database_error.name === 'DdbDatabaseError')
    assert(database_error.url === ddb.url)
    assert(database_error.type === 'script')
    assert(database_error.options.script === error_script)
    assert(database_error.stack.includes('test_error'))
    
    
    let ddbtest = new DDB(url, ddb_options)
    let connection_error: DdbConnectionError
    try {
        await ddbtest.connect()
        ddbtest.disconnect()
        await ddbtest.eval('1')
    } catch (error) {
        connection_error = error
    }
    
    assert(connection_error)
    assert(connection_error instanceof DdbConnectionError)
    assert(connection_error.url === ddbtest.url)
    
    
    // --- 首次连接失败也会抛出 DdbConnectionError
    let ddbtest2 = new DDB('ws://dolphindb.com/')
    let connection_error2: DdbConnectionError
    try {
        await ddbtest2.connect()
    } catch (error) {
        connection_error2 = error
    }
    
    assert(connection_error2)
    assert(connection_error2 instanceof DdbConnectionError)
    assert(connection_error2.cause && connection_error2.cause instanceof WebSocketConnectionError)
}


async function test_print (ddb: DDB) {
    console.log('测试 print message')
    
    const str = 'test print message\n中文'
    
    assert(await get_printed(ddb, str.quote()) === str)
    
    console.log('测试 verbose 输出')
    
    let vddb = new DDB(url, { ...ddb_options, verbose: true })
    
    await vddb.call('typestr', [
        new DdbVectorAny([
            new DdbVectorSymbol(['a', 'b', 'a', 'b', 'a', 'b']),
            new DdbLong(3n)
        ])
    ])
    
    vddb.disconnect()
}


async function test_streaming (ddb: DDB) {
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
    
    let total_rows = 0
    
    let promise = defer<void>()
    
    let sddb = new DDB(url, {
        ...ddb_options,
        streaming: {
            table: 'prices',
            handler ({ rows, error, colnames, data, time, id, window, schema }) {
                if (error)
                    throw error
                
                if (total_rows === 0 && schema) {
                    console.log('流订阅返回了 table schema')
                    console.log(schema)
                }
                
                // console.log(data)
                
                deepEqual(colnames, ['time', 'stock', 'price'])
                
                assert(data.form === DdbForm.vector)
                assert(data.rows === 3)
                assert(id)
                assert(time)
                assert(window.rows)
                
                total_rows += rows
                
                if (total_rows === 50)
                    promise.resolve()
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


async function test_time (ddb: DDB) {
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
    
    // 测试 array vector 格式化
    // console.log(
    //     await ddb.eval<DdbVectorObj>(
    //         'av = array(DECIMAL128(2)[], 0, 1)\n' +
    //         'append!(av, [[92233720368547758.11, NULL, 100000000000000, NULL, -92233720368547758, -100000000000000]])\n' +
    //         'av\n'
    //     )
    // )
    
    // 测试 Invalid Date
    await ddb.upload(['x'], [new DdbTimeStamp(10000000000000000n)])
    
    assert(
        inspect(
            await ddb.eval('x'), 
            { colors: false }
        ) === 'timestamp(Invalid Date)'
    )
    
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
    
    
    console.log('测试 datasource')
    
    const ds = (await ddb.eval<DdbVectorAnyObj>(
        'db_path = "dfs://test-datasource"\n' + 
        'tb_name = "db"\n' + 
        'if (!existsTable(db_path, tb_name))\n' + 
        '    createTable(\n' + 
        '        database(db_path, VALUE , [1]),\n' +
        '        table(1:0,`id`name, [INT, STRING]),\n' +
        '        tb_name\n' +
        '    ).append!(table(1 2 as id, `str1`str2 as name))\n' +
        '\n' +
        'tb = loadTable(db_path, tb_name)\n' +
        'sqlDS(<select * from tb where id = 1>)\n'
    )).value[0] as DdbStringObj
    
    const { type, form, value } = ds
    
    assert(type === DdbType.datasource && form === DdbForm.scalar, '返回的 DdbObj 具有正确的 type 和 form')
    
    assert(value === 'DataSource< select [7] * from tb where id == 1 >')
    
    // 如果直接构造 DdbObj Datasource，将其送入 ddb.call, ddb将仍然认为送入的是一个 STRING 
    assert(
        (await ddb.call<DdbStringObj>('typestr', [ds])).value === 'STRING', 
        '从 js 构建的 Datasource DdbObj 会被识别为 STRING'
    )
    
    console.log('测试 pair<duration>')
    const dp = await ddb.eval<DdbVectorObj<DdbDurationVectorValue>>(
        'pair(duration("20d"), duration("2H"))'
    ) 
    
    console.log(dp)
    assert(dp.type === DdbType.duration, 'dp 的返回值应该为 Duration')
    assert(dp.value[0].data === 20 && dp.value[0].unit === DdbDurationUnit.d, 'pair<duration> 的 value 应该已解析')
    
    console.log('测试 void vector')
    const table = await ddb.eval<DdbTableObj>('select *, NULL as val from table(1..100 as id)')
    const { value: [ints, voids] } = table
    
    console.log(voids)
    assert(voids.rows === ints.rows, 'void vector 应该具有正常的 vector length')
    assert(voids.length === 10, 'void vector 应该具有正确的数据长度')
    assert(voids.value === null, 'void vector 的值应该为 null')
    
    await ddb.upload(['voidtable'], [table])
    
    console.log('测试 compress 类型')
    
    await ddb.upload(['c'], [
        await ddb.eval<DdbDictObj>('dict(["a", "b", "c"], [compress([1, 2, 3]), 123, "bbb"])')
    ])
}


async function test_from_stdjson (ddb: DDB) {
    console.log('测试 fromStdJson')
    
    console.log(
        await ddb.call('fromStdJson', [JSON.stringify({
            a: 1234,
            b: 'aaa',
            c: {
                e: 1234,
                f: 4321
            },
            f: 'blabla\n中文\u4e2d\u6587'
        })])
    )
    
    console.log(
        await ddb.call('fromStdJson', [JSON.stringify(1234)])
    )
    
    console.log(
        await ddb.call('fromStdJson', [
            JSON.stringify({
                data: {
                    code: 'select * from kline where secid == "230012"'
                }
            })
        ])
    )
}

