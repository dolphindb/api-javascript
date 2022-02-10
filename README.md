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

## English | [中文](./README.zh.md)

## Overview
DolphinDB JavaScript API is a JavaScript library that encapsulates the ability to operate the DolphinDB database, such as: connecting to the database, executing scripts, calling functions, uploading variables, etc.

https://www.npmjs.com/package/dolphindb

## Features
- Communicate with DolphinDB database using WebSocket, exchange data in binary format
- Support running in browser environment and Node.js environment
- Use TypedArray such as Int32Array in JavaScript to process binary data, with high performance
- A single call supports serialized upload of up to 2GB of data, and the amount of downloaded data is not limited

## Installation
```bash
# 1. Install the latest version of Node.js and browser on the machine

# 2. Create a new project (skip this step if you already have a project)
mkdir dolphindb-example
cd dolphindb-example
npm init --yes
# Open the package.json file with an editor, add the line "type": "module", below "main": "./index.js",
# This enables the use of ECMAScript modules, and in the code behind you can use import { DDB } from 'dolphindb' to import npm packages

# 3. Install npm packages in your project
npm install dolphindb
```

## Usage
### 0. Initialize and connect to DolphinDB
```ts
import DDB from 'dolphindb'
// The import method for existing projects using CommonJS modules is const { DDB } = require('dolphindb')

// Create a database object and initialize the WebSocket URL
let ddb = new DDB('ws://127.0.0.1:8848')

// Establish a WebSocket connection to DolphinDB (requires DolphinDB database version at least 1.30.16 or 2.00.4)
await ddb.connect()
```

#### Connect Method Declaration
```ts
async connect (
    options?: {
        /** by default, the WebSocket URL passed in when the instance is initialized is used */
        ws_url?: string
        
        /** whether to automatically log in after the connection is established, the default is true */
        login?: boolean
        
        /** DolphinDB username */
        username?: string
        
        /** DolphinDB password */
        password?: string
    } = { }
): Promise<void>
```


### 1. Call Functions
#### Example
```ts
import { DdbInt } from 'dolphindb'

const result = await ddb.call<DdbInt>('add', [new DdbInt(1), new DdbInt(1)])

console.log(result.value === 2)  // true
```

#### The DolphinDB JavaScript API uses DdbObj objects to represent data types in DolphinDB
In the above example, two parameters 1 (corresponding to the int type in DolphinDB) are uploaded to the DolphinDB database as parameters of the add function, then the result of the function call is received.

`<DdbInt>` is used by TypeScript to infer the type of the return value

- result is a `DdbInt`, which is also a `DdbObj<number>`
- result.form is a `DdbForm.scalar`
- result.type is a `DdbType.int`
- result.value is native `number` in JavaScript (the value range and precision of int can be accurately represented by JavaScript number)

```ts
/** Can represent all data types in DolphinDB databases */
class DdbObj <T extends DdbValue = DdbValue> {
    /** is it little endian */
    le: boolean
    
    /** data form https://www.dolphindb.cn/cn/help/DataTypesandStructures/DataForms/index.html */
    form: DdbForm
    
    /** data type  https://www.dolphindb.cn/cn/help/DataTypesandStructures/DataTypes/index.html */
    type: DdbType
    
    /** consumed length in buf parsed */
    length: number
    
    /** table name / column name */
    name?: string
    
    /**
        Lowest dimension
        - vector: rows = n, cols = 1
        - pair:   rows = 2, cols = 1
        - matrix: rows = n, cols = m
        - set:    the same as vector
        - dict:   include keys, values vector
        - table:  the same as matrix
    */
    rows?: number
    
    /** 2nd dimension */
    cols?: number
    
    /** the type of the value in matrix (only matrix has this field) */
    datatype?: DdbType
    
    /** the actual data. Different DdbForm, DdbType use different types in DdbValue to represent actual data */
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

// ... There are also many utility classes, such as DdbString, DdbLong, DdbDouble, DdbVectorDouble, DdbVectorAny, etc.

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

#### `call` Method Declaration
```ts
async call <T extends DdbObj> (
    /** function name */
    func: string,
    
    /** function arguments (The incoming native string and boolean will be automatically converted to DdbObj<string> and DdbObj<boolean>) */
    args?: (DdbObj | string | boolean)[] = [ ],
    
    /** calling options */
    options?: {
        /** Urgent flag. Use urgent worker to execute to prevent being blocked by other jobs */
        urgent?: boolean
        
        /** When the node alias is set, the function is sent to the corresponding node in the cluster for execution (using the rpc method in DolphinDB) */
        node?: string
        
        /** When setting multiple node aliases, send them to the corresponding multiple nodes in the cluster for execution (using the pnodeRun method in DolphinDB) */
        nodes?: string[]
        
        /** It must be passed when setting the node parameter, the function type needs to be specified, and it is not passed in other cases */
        func_type?: DdbFunctionType
        
        /** It may be  passed when setting the nodes parameter, otherwise may not be passed */
        add_node_alias?: boolean
    } = { }
): Promise<T>
```


### 2. Execute Script
#### Example
```ts
import type { DdbLong } from 'dolphindb'

const result = await ddb.eval<DdbLong>(
    'def foo (a, b) {\n' +
    '    return a + b\n' +
    '}\n' +
    'foo(1l, 1l)\n'
)

console.log(result.value === 2n)  // true
```

In the above example, a script is uploaded through a string to the DolphinDB database for execution, and the execution result of the last statement `foo(1l, 1l)` is received.

`<DdbLong>` is used by TypeScript to infer the type of the return value

- result is a `DdbLong`, which is also a `DdbObj<bigint>`
- result.form is `DdbForm.scalar`
- result.type is `DdbType.long`
- result.value is the native `bigint` in JavaScript (the precision of long cannot be accurately represented by JavaScript number, but it can be represented by bigint)

As long as the WebSocket connection is not disconnected, the custom function `foo` will always exist in the subsequent session and can be reused, for example, you can use `await ddb.call<DdbInt>('foo', [new DdbInt(1), new DdbInt(1)])` to call this custom function

#### `eval` Method Declaration
```ts
async eval <T extends DdbObj> (
    /** the script to execute */
    script: string,
    
    /** calling options */
    options: {
        /** Urgent flag. Use urgent worker to execute to prevent being blocked by other jobs */
        urgent?: boolean
    } = { }
): Promise<T>
```


### 3. Upload Variables
#### Example
```ts
import { DdbVectorDouble } from 'dolphindb'

let a = new Array(10000)
a.fill(1.0)

ddb.upload(['bar1', 'bar2'], [new DdbVectorDouble(a), new DdbVectorDouble(a)])
```

In the above example, two variables `bar1`, `bar2` are uploaded, and the variable value is a double vector of length 10000

As long as the WebSocket connection is not disconnected, the variables `bar1`, `bar2` will always exist in the subsequent session and can be reused

#### `upload` Method Declaration
```ts
async upload (
    /** variable names */
    vars: string[],
    
    /** variable values */
    args: (DdbObj | string | boolean)[]
): Promise<void>
```

