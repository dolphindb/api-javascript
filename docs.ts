import { constants, keywords } from './language.js'


export interface FunctionSignature {
    full: string
    name: string
    parameters: {
        full: string
        name: string
        optional?: boolean
        default?: string
    }[]
}

export interface Doc {
    /** 文档的公网链接 */
    url: string
    
    /** 部分函数存在多个签名，例如 append! 和 x.append!, eachPre 和 func:P 这两组，最好在分析阶段就处理好 */
    signatures: FunctionSignature[] | null
    
    /** 文档内容 */
    markdown: string
}

export type Docs = Record<string, Doc>

function is_completion_match (target: string, search: string) {
    let j = 0
    for (const c of search) {
        j = target.indexOf(c, j) + 1
        if (!j)
            return false
    }
    
    return true
}

export class DocsAnalyser {
    /** 文档原始信息 */
    docs?: Docs
    
    /** 函数名列表 */
    funcs: string[] = [ ]
    
    /** 转化成小写字母的函数名列表 */
    lower_funcs: string[] = [ ]
    
    
    constructor (docs: Docs) {
        this.docs = docs
        this.funcs = Object.keys(docs)
        this.lower_funcs = this.funcs.map(func => func.toLowerCase())
    }
    
    
    get_function_markdown (name: string) {
        return (this.docs[name] || this.docs[`${name}!`])?.markdown
    }
    
    
    get_signatures (name: string) {
        return (this.docs[name] || this.docs[`${name}!`])?.signatures
    }
    
    
    /** 查询补全项（包括关键字、常量和函数）
        @param query
        @returns  */
    search_completion_items (query: string) {
        const query_lower = query.toLowerCase()
        
        return {
            keywords: keywords.filter(keyword => keyword.startsWith(query)),
            constants: constants.filter(constant => is_completion_match(constant, query_lower)),
            functions: this.funcs.filter((func, i) => is_completion_match(this.lower_funcs[i], query_lower)),
        }
    }
}


const FUNC_NAME_CHAR_REG_EXP = /[a-zA-Z0-9!_]/

function reverse_search_func (text: string): null | {
    param_start_at: number
    func_name: string
} {
    let depth = 0
    let param_start_at = -1
    
    for (let i = text.length;  i >= 0;  i--) {
        const char = text[i]
        
        // 遇到右括号，入栈
        if (char === ')') {
            depth++
            continue
        }
        // 遇到左括号，出栈
        else if (char === '(') {
            depth--
            continue
        }
        
        // 栈深度小于0，且遇到合法函数名字符，跳出括号语境，搜索结束：参数搜索开始位置
        if (FUNC_NAME_CHAR_REG_EXP.test(char) && depth < 0) {
            param_start_at = i
            break
        }
    }
    
    // 找不到参数搜索开始位置，返回null
    if (param_start_at === -1)
        return null
        
        
    // 往前找函数名
    let func_name_end = -1
    let func_name_start = 0
    for (let i = param_start_at;  i >= 0;  i--) {
        const char = text[i]
        
        // 空字符跳过
        if (func_name_end === -1 && char === ' ')
            continue
        
        // 合法函数名字字符，继续往前找
        if (FUNC_NAME_CHAR_REG_EXP.test(char)) {
            // 标记函数名字末尾位置
            if (func_name_end === -1)
                func_name_end = i
                
            continue
        }
        
        // 不合法函数名字符，标记函数名字开头位置
        func_name_start = i + 1
        break
    }
    
    // 找不到函数名
    if (func_name_end === -1)
        return null
        
        
    return {
        param_start_at: param_start_at + 1,
        func_name: text.slice(func_name_start, func_name_end + 1),
    }
}


// 栈 token 匹配表
const PAIR_TOKEN_MAP: Record<string, string> = {
    ')': '(',
    '}': '{',
    ']': '[',
}

const PAIR_START_TOKENS = new Set(Object.values(PAIR_TOKEN_MAP))

const LAST_IDENTIFIER_NAME_REGEXP = /[a-zA-Z_\u4e00-\u9fa5][\w\u4e00-\u9fa5]*!?$/


/** 根据函数参数开始位置分析参数语义，提取出当前参数索引 */
function find_active_param_index (text: string, param_start_at: number) {
    let index = 0
    const stack = [ ]
    
    let commas_count = 0
    
    // 是否在转义符作用范围内
    let is_escaping_string = false
    
    // 搜索
    for (let i = param_start_at;  i < text.length;  i++) {
        const char = text[i]
        
        // 空字符跳过
        if (/\s/.test(char))
            continue
        
        // 转义符作用范围下一个字符直接忽略
        if (is_escaping_string) {
            is_escaping_string = false
            continue
        }
        
        const last_stack = stack[stack.length - 1]
        // 字符串内除引号全部忽略
        if (last_stack === '"' || last_stack === "'") {
            // 进入转义符作用范围
            if (char === '\\') {
                is_escaping_string = true
                continue
            }
            
            // 遇到相同引号
            if (char === last_stack)
                stack.pop()
            
            
            continue
        }
        
        // 开括号入栈
        if (PAIR_START_TOKENS.has(char) || char === '"' || char === "'") {
            stack.push(char)
            continue
        } else if (char in PAIR_TOKEN_MAP)
            if (last_stack === PAIR_TOKEN_MAP[char]) {
                // 括号匹配，出栈
                stack.pop()
                continue
            } else
                return -1
        
        
        
        // 栈深度为1 且为左小括号：当前语境
        if (stack.length === 1 && stack[0] === '(' && char === ',')
            commas_count++
        
        
        // 根据逗号数量判断高亮参数索引值
        index = commas_count
    }
    
    const caller = text.slice(0, param_start_at)
    /** 匹配当前函数名的正则, 并捕获该函数名 */
    const match = LAST_IDENTIFIER_NAME_REGEXP.exec(caller)
    
    const is_member_call = match && caller[param_start_at - 1 /* 去掉括号 */ - match[0].length] === '.'
    
    // 是否为对象方法调用，若是，参数索引+1（对象会变成第一个参数）
    return is_member_call ? index + 1 : index
}


export function parse_signature_help_from_text (text: string, docsAnalyser: DocsAnalyser) {
    const caller = reverse_search_func(text)
    if (!caller)
        return
    const { func_name, param_start_at } = caller
    
    const cursor_param_index = find_active_param_index(text, param_start_at)
    if (cursor_param_index === -1)
        return
    const signatures = docsAnalyser.get_signatures(func_name)
    if (!signatures)
        return
    const signature = signatures[0]
    const params_length = signature.parameters.length
    // 如果输入参数数量超出了签名内声明的参数数量，active_parameter 为 undefined
    const active_parameter = cursor_param_index > params_length - 1 ? undefined : cursor_param_index
    const documentation_md = docsAnalyser.get_function_markdown(func_name)
    
    return {
        signature,
        active_parameter,
        documentation_md,
    }
}

