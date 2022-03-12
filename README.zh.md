# DolphinDB JavaScript API

<p align='center'>
    <img src='./ddb.svg' alt='DolphinDB' width='256'>
</p>

<p align='center'>
    <a href='https://www.npmjs.com/package/dolphindb' target='_blank'>
        <img alt='npm version' src='https://img.shields.io/npm/v/dolphindb.svg?style=flat-square&color=brightgreen' />
    </a>
    <a href='https://www.npmjs.com/package/dolphindb' target='_blank'>
        <img alt='npm downloads' src='https://img.shields.io/npm/dt/dolphindb?style=flat-square&color=brightgreen' />
    </a>
</p>

## [English](./README.md) | 中文

## 简介
DolphinDB JavaScript API 是一个 JavaScript 库，封装了操作 DolphinDB 数据库的能力，如：连接数据库、执行脚本、调用函数、上传变量等

https://www.npmjs.com/package/dolphindb

## 特性
- 使用 WebSocket 与 DolphinDB 数据库通信，用二进制格式进行数据交换
- 支持在浏览器环境和 Node.js 环境中运行
- 使用了 JavaScript 中的 Int32Array 等 TypedArray 处理二进制数据，性能较高
- 单次调用支持最大 2 GB 数据的序列化上传，下载数据量不受限制

## 安装
```bash
# 1. 在机器上安装最新版的 Node.js 及浏览器

# 2. 创建新项目
mkdir dolphindb-example
cd dolphindb-example
npm init --yes
# 用编辑器打开 package.json 文件，在 "main": "./index.js", 下面加入一行 "type": "module",
# 这样能够启用 ECMAScript modules，在后面代码中可以使用 import { DDB } from 'dolphindb' 导入 npm 包

# 3. 在项目中安装 npm 包
npm install dolphindb
```

## 用法
### 0. 初始化并连接到 DolphinDB
```ts
import { DDB } from 'dolphindb'
// 已有的使用 CommonJS 模块的项目的导入方法为 const { DDB } = require('dolphindb')
// 在浏览器中使用: import { DDB } form 'dolphindb/browser.js'

// 创建数据库对象，初始化 WebSocket 连接地址
let ddb = new DDB('ws://127.0.0.1:8848')

// 建立到 DolphinDB 的 WebSocket 连接（要求 DolphinDB 数据库版本不低于 1.30.16 或 2.00.4）
await ddb.connect()
```

#### DDB 选项
```ts
let ddb = new DDB('ws://127.0.0.1:8848')

// 使用 HTTPS 加密
let ddbsecure = new DDB('wss://dolphindb.com', {
    // 是否在建立连接后自动登录，默认 `true`
    autologin: true,
    
    // DolphinDB 登录用户名，默认 `'admin'`
    username: 'admin',
    
    // DolphinDB 登录密码，默认 `'123456'`
    password: '123456',
    
    // 设置 python session flag，默认 `false`
    python: false
})
```


### 1. 调用函数
#### 例子
```ts
import { DdbInt } from 'dolphindb'

const result = await ddb.call('add', [new DdbInt(1), new DdbInt(1)])
// TypeScript: const result = await ddb.call<DdbInt>('add', [new DdbInt(1), new DdbInt(1)])

console.log(result.value === 2)  // true
```

#### DolphinDB JavaScript API 用 DdbObj 对象来表示 DolphinDB 中的数据类型
上面例子中，上传了两个参数 1 (对应 DolphinDB 中的 int 类型) 到 DolphinDB 数据库，作为 add 函数的参数，并接收函数调用的结果 result

`<DdbInt>` 用于 TypeScript 推断返回值的类型

- result 是一个 `DdbInt`，也是 `DdbObj<number>`
- result.form 是 `DdbForm.scalar`
- result.type 是 `DdbType.int`
- result.value 是 JavaScript 中原生的 `number` (int 的取值范围及精度可以用 JavaScript 的 number 准确表示)

```ts
/** 可以表示所有 DolphinDB 数据库中的数据类型 */
class DdbObj <T extends DdbValue = DdbValue> {
    /** 是否为小端 (little endian) */
    le: boolean
    
    /** 数据形式 https://www.dolphindb.cn/cn/help/DataTypesandStructures/DataForms/index.html */
    form: DdbForm
    
    /** 数据类型 https://www.dolphindb.cn/cn/help/DataTypesandStructures/DataTypes/index.html */
    type: DdbType
    
    /** 占用 parse 时传入的 buf 的长度 */
    length: number
    
    /** table name / column name */
    name?: string
    
    /**
        最低维、第 1 维
        - vector: rows = n, cols = 1
        - pair:   rows = 2, cols = 1
        - matrix: rows = n, cols = m
        - set:    同 vector
        - dict:   包含 keys, values 向量
        - table:  同 matrix
    */
    rows?: number
    
    /** 第 2 维 */
    cols?: number
    
    /** matrix 中值的类型，仅 matrix 才有 */
    datatype?: DdbType
    
    /** 实际数据。不同的 DdbForm, DdbType 使用 DdbValue 中不同的类型来表示实际数据 */
    value: T
    
    constructor (data: Partial<DdbObj> & { form: DdbForm, type: DdbType, length: number }) {
        Object.assign(this, data)
    }
}

class DdbInt extends DdbObj<number> {
    constructor (value: number) {
        super({
            form: DdbForm.scalar,
            type: DdbType.int,
            length: 4,
            value
        })
    }
}

// ... 还有很多快捷类，如 DdbString, DdbLong, DdbDouble, DdbVectorDouble, DdbVectorAny 等

type DdbValue = 
    null | boolean | number | [number, number] | bigint | string | string[] | 
    Uint8Array | Int16Array | Int32Array | Float32Array | Float64Array | BigInt64Array | Uint8Array[] | 
    DdbObj[] | DdbFunctionDefValue | DdbSymbolExtendedValue
    

enum DdbForm {
    scalar = 0,
    vector = 1,
    pair = 2,
    matrix = 3,
    set = 4,
    dict = 5,
    table = 6,
    chart = 7,
    chunk = 8,
}


enum DdbType {
    void = 0,
    bool = 1,
    char = 2,
    short = 3,
    int = 4,
    long = 5,
    // ...
    timestamp = 12,
    // ...
    double = 16,
    symbol = 17,
    string = 18,
    // ...
}
```

##### 没有快捷类的类型，也可以指定 form 和 type 手动创建 DdbObj 对象
```ts
// 通过 DdbDateTime 快捷类创建
new DdbDateTime(1644573600)

// 等价于手动通过 DdbObj 创建 form = scalar, type = datetime 的对象
const obj = new DdbObj({
    form: DdbForm.scalar,
    type: DdbType.datetime,
    value: 1644573600,
    length: 0
})


// value 在 js 中对应类型及取值可以参考 ddb.eval 返回的结果 (见后文 `eval` 方法声明)
const obj = await ddb.eval('2022.02.11 10:00:00')
console.log(obj.form === DdbForm.scalar)
console.log(obj.type === DdbType.datetime)
console.log(obj.value)

// 再比如创建一个 set
// 参考 ddb.eval
// const obj = await ddb.eval('set([1, 2, 3])')
// console.log(obj.value)
const obj = new DdbObj({
    form: DdbForm.set,
    type: DdbType.int,
    value: Int32Array.of(1, 2, 3),
    length: 0
})

// 使用快捷类较为简单
const obj = new DdbSetInt(
    new Set([1, 2, 3])
)
```

##### scalar 形式的 NULL 对象, 对应 DdbObj 的 value 为 JavaScript 中的 null
```ts
;(await ddb.eval('double()')).value === null

// 创建 NULL 对象
new DdbInt(null)
new DdbDouble(null)
```


#### `call` 方法声明
```ts
async call <T extends DdbObj> (
    /** 函数名 */
    func: string,
    
    /** 调用参数 (传入的原生 string 和 boolean 会被自动转换为 DdbObj<string> 和 DdbObj<boolean>) */
    args?: (DdbObj | string | boolean)[] = [ ],
    
    /** 调用选项 */
    options?: {
        /** 紧急 flag。使用 urgent worker 执行，防止被其它作业阻塞 */
        urgent?: boolean
        
        /** 设置结点 alias 时发送到集群中对应的结点执行 (使用 DolphinDB 中的 rpc 方法) */
        node?: string
        
        /** 设置多个结点 alias 时发送到集群中对应的多个结点执行 (使用 DolphinDB 中的 pnodeRun 方法) */
        nodes?: string[]
        
        /** 设置 node 参数时必传，需指定函数类型，其它情况下不传 */
        func_type?: DdbFunctionType
        
        /** 设置 nodes 参数时选传，其它情况不传 */
        add_node_alias?: boolean
    } = { }
): Promise<T>
```


### 2. 执行脚本
#### 例子
```ts
const result = await ddb.eval(
    'def foo (a, b) {\n' +
    '    return a + b\n' +
    '}\n' +
    'foo(1l, 1l)\n'
)

// TypeScript:
// import type { DdbLong } from 'dolphindb'
// const result = await ddb.eval<DdbLong>(...)

console.log(result.value === 2n)  // true
```

上面例子中，通过字符串上传了一段脚本到 DolphinDB 数据库执行，并接收最后一条语句 `foo(1l, 1l)` 执行结果 result

`<DdbLong>` 用于 TypeScript 推断返回值的类型

- result 是一个 `DdbLong`，也是 `DdbObj<bigint>`
- result.form 是 `DdbForm.scalar`
- result.type 是 `DdbType.long`
- result.value 是 JavaScript 中原生的 `bigint` (long 的精度不能用 JavaScript 的 number 准确表示，但可以用 bigint 表示)

只要 WebSocket 连接不断开，在后续的会话中 `foo` 这个自定义函数会一直存在，可复用，比如后续通过 `await ddb.call<DdbInt>('foo', [new DdbInt(1), new DdbInt(1)])` 调用这个自定义函数

#### `eval` 方法声明
```ts
async eval <T extends DdbObj> (
    /** 执行的脚本 */
    script: string,
    
    /** 执行选项 */
    options: {
        /** 紧急 flag，确保提交的脚本使用 urgent worker 处理，防止被其它作业阻塞 */
        urgent?: boolean
    } = { }
): Promise<T>
```


### 3. 上传变量
#### 例子
```ts
import { DdbVectorDouble } from 'dolphindb'

let a = new Array(10000)
a.fill(1.0)

ddb.upload(['bar1', 'bar2'], [new DdbVectorDouble(a), new DdbVectorDouble(a)])
```

上面的例子中，上传了 `bar1`, `bar2` 两个变量，变量值是长度为 10000 的 double 向量

只要 WebSocket 连接不断开，在后续的会话中 `bar1`, `bar2` 这些变量会一直存在，可复用

#### `upload` 方法声明
```ts
async upload (
    /** 上传的变量名 */
    vars: string[],
    
    /** 上传的变量值 */
    args: (DdbObj | string | boolean)[]
): Promise<void>
```


### 一些例子
```ts
import { nulls, DdbInt, timestamp2str, DdbVectorSymbol, DdbTable, DdbVectorDouble } from 'dolphindb'

// 将 DolphinDB 中的 timestamp 格式化为 string
timestamp2str(
    (
        await ddb.call('now', [false])
        // TypeScript: await ddb.call<DdbObj<bigint>>('now', [false])
    ).value
) === '2022.02.23 17:23:13.494'

// 创建 symbol vector
new DdbVectorSymbol(['aaa', 'aaa', 'aaa', 'aaa', 'aaa', 'bbb'])

// 使用 JavaScript 原生数组创建含有 NULL 值的 double vector
new DdbVectorDouble([0.1, null, 0.3])

// 使用 JavaScript TypedArray 更加高效且节约内存的创建 double vector
let av = new Float64Array(3)
av[0] = 0.1
av[1] = nulls.double
av[2] = 0.3
new DdbVectorDouble(av)

// 创建 DdbTable
new DdbTable(
    [
        new DdbVectorDouble([0.1, 0.2, null], 'col0'),
        new DdbVectorSymbol(['a', 'b', 'c'], 'col1')
    ],
    'mytable'
)
```
