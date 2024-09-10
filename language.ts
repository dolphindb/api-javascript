const sql_keywords = [
    // 不要单独算关键字比较好
    // 'column',
    // 'table',
    // 'database',
    
    'select',
    'exec',
    'update',
    
    'insert',
    'insert into',
    
    'create table',
    'create database',
    
    'alter table',
    
    // alter table ... add column_name datatype
    'add',
    'rename',
    'to',
    'drop',
    
    
    'drop table',
    'drop database',
    
    'use catalog',
    
    'delete',
    
    'transaction',
    
    'join',
    'inner join',
    'full join',
    'full outer join',
    'left join',
    'left outer join',
    'left semi join',
    'right join',
    'right outer join',
    'left semijoin',
    'cross join',
    
    'context by',
    'partitioned by',
    'group by',
    'pivot by',
    'order by',
    'cgroup by',
    'partition by',
    
    'csort',
    'limit',
    'top',
    
    'into',
    'from',
    'where',
    'having',
    'with',
    'set',
    'as',
    'in',
    'or',
    'not',
    'on',
    'like',
    'values',
    'if',
    'exists',
    'distinct',
    'map',
    
    
    'between', 'and', // between ... and ...
    
    'is null', 'is not null',
    
    // case when ... then ... end
    'case', 'when', 'then', 'else', 'end',
    
    'union', 'union all',
    
    'nulls first', 'nulls last',
    
    'asc', 'desc',
]


export const keywords = [
    'assert',
    
    'const',
    'mutable',
    
    'def',
    'defg',
    
    // 'map',
    'mapr',
    
    'timer',
    
    // 流程控制
    // 'if',
    // 'else',
    'do',
    'for',
    'while',
    'return',
    'continue',
    'break',
    'try',
    'catch',
    'throw',
    'go',
    
    // 模块
    'use',
    'module',
    
    
    // 仅 Python 有的
    'async',
    'await',
    'class',
    'del',
    'elif',
    'except',
    'finally',
    'global',
    'import',
    'is',
    'lambda',
    'nonlocal',
    'pass',
    'raise',
    'yield',
    
    
    // --- SQL
    ... sql_keywords,
    ... sql_keywords.map(keyword => keyword.toUpperCase())
].sort((l, r) => {  // 长的在前面，正则表达式先匹配全部，而不是部分单词，防止高亮显示不正确
    const delta_len = l.length - r.length
    if (delta_len !== 0)
        return -delta_len
    
    return 0 // 否则保留原本顺序
})


export const constants = [
    'DFLT',
    'NULL',
    'true',
    'false',
    'pi',
    'e',
    
    // --- form
    'SCALAR',
    'VECTOR',
    'PAIR',
    'MATRIX',
    'SET',
    'DICT',
    'TABLE',
    // 'CHART',
    // 'CHUNK',
    
    // --- type
    'VOID',
    'BOOL',
    'CHAR',
    'SHORT',
    'INT', 'INDEX',
    'LONG',
    'DATE',
    'MONTH',
    'TIME',
    'MINUTE',
    'SECOND',
    'DATETIME',
    'TIMESTAMP',
    'NANOTIME',
    'NANOTIMESTAMP',
    'FLOAT',
    'DOUBLE',
    'SYMBOL',
    'STRING',
    'UUID',
    'FUNCTIONDEF',
    'HANDLE',
    'CODE',
    'DATASOURCE',
    'RESOURCE',
    'ANY',
    // 'COMPRESS',
    'DICTIONARY',
    'DATEHOUR',
    'IPADDR',
    'INT128',
    'BLOB',
    'COMPLEX',
    'POINT',
    'DURATION',
    'OBJECT',
    'DECIMAL32',
    'DECIMAL64',
    'DECIMAL128',
    'IOTANY',
    
    // partition type
    'SEQ',
    'RANGE',
    'HASH',
    'VALUE',
    'LIST',
    'COMPO',
    
    
    // defined
    // https://www.dolphindb.cn/cn/help/FunctionsandCommands/FunctionReferences/d/defined.html
    'VAR',
    'SHARED',
    'DEF',
    'GLOBAL',
    
    
    // 用户权限管理
    // https://www.dolphindb.cn/cn/help/200/SystemManagement/UserAccessControl.html
    // https://www.dolphindb.cn/cn/help/200/FunctionsandCommands/CommandsReferences/d/deny.html
    'TABLE_READ',
    'TABLE_WRITE',
    'TABLE_INSERT',
    'TABLE_UPDATE',
    'TABLE_DELETE',
    
    'DBOBJ_CREATE',
    'DBOBJ_DELETE',
    
    'DB_DELETE',
    'DB_INSERT',
    'DB_MANAGE',
    'DB_OWNER',
    'DB_READ',
    'DB_UPDATE',
    'DB_WRITE',
    
    'CATALOG_MANAGE',
    'CATALOG_READ',
    'CATALOG_WRITE',
    'CATALOG_INSERT',
    'CATALOG_UPDATE',
    'CATALOG_DELETE',
    
    'SCHEMA_MANAGE',
    'SCHEMAOBJ_CREATE',
    'SCHEMAOBJ_DELETE',
    'SCHEMA_READ',
    'SCHEMA_WRITE',
    'SCHEMA_INSERT',
    'SCHEMA_UPDATE',
    'SCHEMA_DELETE',
    
    'SCRIPT_EXEC',
    'TASK_GROUP_MEM_LIMIT',
    'TEST_EXEC',
    'VIEW_EXEC',
    'VIEW_OWNER',
    'QUERY_RESULT_MEM_LIMIT',
    
    
    // hint
    // https://www.dolphindb.cn/cn/help/200/FunctionsandCommands/FunctionReferences/s/sql.html
    'HINT_HASH',
    'HINT_SNAPSHOT',
    'HINT_KEEPORDER',
    'HINT_SEQ',
    'HINT_EXPLAIN',
    'HINT_VECTORIZED',
    
    
    // --- seek mode
    'HEAD',
    'CURRENT',
    'TAIL',
    
    // --- chart type
    // https://www.dolphindb.cn/cn/help/200/FunctionsandCommands/FunctionReferences/p/plot.html
    'LINE',
    'PIE',
    'COLUMN',
    'BAR',
    'AREA',
    'SCATTER',
    'HISTOGRAM',
    'KLINE',
    
    
    // --- log level
    'DEBUG',
    'INFO',
    'WARNING',
    'ERROR',
    
    // keep duplicates
    // https://www.dolphindb.cn/cn/help/200/FunctionsandCommands/FunctionReferences/c/createPartitionedTable.html?highlight=first
    'FIRST',
    'LAST',
    'ALL',
    
    // keep
    // https://www.dolphindb.cn/cn/help/200/FunctionsandCommands/FunctionReferences/i/isDuplicated.html?highlight=none
    'NONE',
    
    'HASH_PTN',
    
    // 仅 Python 有的
    'True',
    'False',
    'None',
    
] as const


function get_tm_language (python = false) {
    return {
        $schema: 'https://raw.githubusercontent.com/martinring/tmlanguage/master/tmlanguage.json',
    
        name: python ? 'DolphinDB Python' : 'DolphinDB',
        
        scopeName: python ? 'source.dolphindb-python' : 'source.dolphindb',
        
        patterns: [
            {
                match: '\\.\\.\\.',
                name: 'invalid.ellipsis.dolphindb'
            },
            {
                include: '#keyword'
            },
            {
                include: '#literal'
            },
            {
                include: '#comment'
            },
            {
                include: '#decorator'
            },
            {
                include: '#variable'
            },
            {
                include: '#operator'
            },
            {
                include: '#method_call'
            },
            {
                include: '#function_call'
            },
            {
                include: '#property'
            },
            {
                match: ';',
                name: 'punctuation.terminator.statement.dolphindb'
            },
            {
                match: ',',
                name: 'punctuation.separator.commma.dolphindb'
            }
        ],
        
        
        repository: {
            keyword: {
                // \b: word boundary
                // (?<![.$]): boundary 不是 . 或 $
                // ?!\s*: 不是 label
                match: `\\b(?<![.$])(${keywords.join('|')})(?!(\\s*:|\\())\\b`,
                name: 'keyword.control.dolphindb'
            },
            
            literal: {
                patterns: [
                    { include: '#constant' },
                    { include: '#datetime' },
                    { include: '#string' },
                    { include: '#number' },
                ]
            },
            
            constant: {
                match: `\\b(?<![.$])(${constants.join('|')})(?!\\s*:)\\b`,
                name: 'constant.language.int.dolphindb'
            },
            
            decorator: {
                match: '^@testing',
                name: 'meta.decorator.dolphindb',
            },
            
            datetime: {
                patterns: [
                    {
                        match: '\\b[0-9]{4}[.][0-9]{2}[.][0-9]{2}[T ][0-9]{2}:[0-9]{2}:[0-9]{2}([.][0-9]{3,9})?\\b',
                        name: 'constant.numeric.datetime.datetime.dolphindb',
                    },
                    {
                        match: '\\b[0-9]{4}\\.[0-9]{2}M\\b',
                        name: 'constant.numeric.datetime.month.dolphindb',
                    },
                    {
                        match: '\\b[0-9]{4}\\.[0-9]{2}\\.[0-9]{2}\\b',
                        name: 'constant.numeric.datetime.date.dolphindb',
                    },
                    {
                        match: '\\b[0-9]{2}:[0-9]{2}:[0-9]{2}([.][0-9]{3,9})?\\b',
                        name: 'constant.numeric.datetime.time.dolphindb',
                    },
                    {
                        match: '\\b[0-9]{2}:[0-9]{2}m\\b',
                        name: 'constant.numeric.datetime.minute.dolphindb',
                    },
                ]
            },
            
            string: {
                patterns: [
                    {
                        include: '#string_single_quoted'
                    },
                    {
                        include: '#string_double_quoted'
                    },
                    {
                        begin: "'''",
                        beginCaptures: {
                            0: {
                                name: 'punctuation.definition.string.begin.dolphindb'
                            }
                        },
                        end: "'''",
                        endCaptures: {
                            0: {
                                name: 'punctuation.definition.string.end.dolphindb'
                            }
                        },
                        name: 'string.quoted.single.heredoc.dolphindb',
                        patterns: [
                            {
                                captures: {
                                    1: {
                                        name: 'punctuation.definition.escape.backslash.dolphindb'
                                    }
                                },
                                match: '(\\\\).',
                                name: 'constant.character.escape.backslash.dolphindb'
                            }
                        ]
                    },
                    {
                        begin: '"""',
                        beginCaptures: {
                            0: {
                                name: 'punctuation.definition.string.begin.dolphindb'
                            }
                        },
                        end: '"""',
                        endCaptures: {
                            0: {
                                name: 'punctuation.definition.string.end.dolphindb'
                            }
                        },
                        name: 'string.quoted.double.heredoc.dolphindb',
                        patterns: [
                            {
                                captures: {
                                    1: {
                                        name: 'punctuation.definition.escape.backslash.dolphindb'
                                    }
                                },
                                match: '(\\\\).',
                                name: 'constant.character.escape.backslash.dolphindb'
                            },
                            {
                                include: '#interpolated_dolphindb'
                            }
                        ]
                    },
                    {
                        match: '`[\\w\\.]*',
                        name: 'string.quoted.other.dolphindb'
                    }
                ]
            },
            
            number: {
                patterns: [
                    {
                        match: '\\b[01]+[bB]\\b',
                        name: 'constant.numeric.binary.dolphindb'
                    },
                    {
                        // 97c
                        match: '\\b[0-9]+([clhsmyM]|ms)\\b',
                        name: 'constant.numeric.dolphindb'
                    },
                    {
                        // 1.2f, 1f
                        match: '\\b[0-9]+(\\.[0-9]+)?f\\b',
                        name: 'constant.numeric.dolphindb'
                    },
                    {
                        match: 
                            '(?x)\n' +
                            '(?:\n' +
                            '  (?:\\b[0-9]+(\\.)[0-9]+[eE][+-]?[0-9]+\\b)| # 1.1E+3\n' +
                            '  (?:\\b[0-9]+(\\.)[eE][+-]?[0-9]+\\b)|       # 1.E+3\n' +
                            '  (?:\\b(\\.)[0-9]+[eE][+-]?[0-9]+\\b)|       # .1E+3\n' +
                            '  (?:\\b[0-9]+[eE][+-]?[0-9]+\\b)|            # 1E+3\n' +
                            '  (?:\\b[0-9]+(\\.)[0-9]+\\b)|                # 1.1\n' +
                            '  (?:\\b[0-9]+(?=\\.{2,3}))|                  # 1 followed by a slice\n' +
                            '  (?:\\b[0-9]+(\\.)\\b)|                      # 1.\n' +
                            '  (?:\\b(\\.)[0-9]+\\b)|                      # .1\n' +
                            '  (?:\\b[0-9]+\\b(?!\\.))                     # 1\n' +
                            ')\n',
                        
                        captures: {
                            0: {
                                name: 'constant.numeric.decimal.dolphindb'
                            },
                            1: {
                                name: 'punctuation.separator.decimal.period.dolphindb'
                            },
                            2: {
                                name: 'punctuation.separator.decimal.period.dolphindb'
                            },
                            3: {
                                name: 'punctuation.separator.decimal.period.dolphindb'
                            },
                            4: {
                                name: 'punctuation.separator.decimal.period.dolphindb'
                            },
                            5: {
                                name: 'punctuation.separator.decimal.period.dolphindb'
                            },
                            6: {
                                name: 'punctuation.separator.decimal.period.dolphindb'
                            }
                        }
                    },
                ]
            },
            
            string_single_quoted: {
                patterns: [
                    {
                        begin: "'",
                        beginCaptures: {
                            0: {
                                name: 'punctuation.definition.string.begin.dolphindb'
                            }
                        },
                        end: "'",
                        endCaptures: {
                            0: {
                                name: 'punctuation.definition.string.end.dolphindb'
                            }
                        },
                        name: 'string.quoted.single.dolphindb',
                        patterns: [
                            {
                                captures: {
                                    1: {
                                        name: 'punctuation.definition.escape.backslash.dolphindb'
                                    }
                                },
                                match: '(\\\\)(x[0-9A-Fa-f]{2}|[0-2][0-7]{0,2}|3[0-6][0-7]?|37[0-7]?|[4-7][0-7]?|.)',
                                name: 'constant.character.escape.backslash.dolphindb'
                            }
                        ]
                    }
                ]
            },
            
            string_double_quoted: {
                patterns: [
                    {
                        begin: '"',
                        beginCaptures: {
                            0: {
                                name: 'punctuation.definition.string.begin.dolphindb'
                            }
                        },
                        end: '"',
                        endCaptures: {
                            0: {
                                name: 'punctuation.definition.string.end.dolphindb'
                            }
                        },
                        name: 'string.quoted.double.dolphindb',
                        patterns: [
                            {
                                captures: {
                                    1: {
                                        name: 'punctuation.definition.escape.backslash.dolphindb'
                                    }
                                },
                                match: '(\\\\)(x[0-9A-Fa-f]{2}|[0-2][0-7]{0,2}|3[0-6][0-7]|37[0-7]?|[4-7][0-7]?|.)',
                                name: 'constant.character.escape.backslash.dolphindb'
                            },
                            {
                                include: '#interpolated_dolphindb'
                            }
                        ]
                    }
                ]
            },
            
            function_call: {
                patterns: [
                    {
                        begin: '(@)?(\\w*!?)\\b(?=\\s*\\()',
                        beginCaptures: {
                            1: { name: 'variable.other.readwrite.instance.dolphindb' },
                            2: { patterns: [{ include: '#function_name' }] }
                        },
                        end: '(?<=\\))',
                        name: 'meta.function-call.dolphindb',
                        patterns: [{ include: '#arguments' }]
                    }
                ]
            },
            
            
            method_call: {
                patterns: [
                    {
                        begin: '(?:(\\.)|(::))\\s*(\\w*!?)(?=\\()',
                        beginCaptures: {
                            1: { name: 'punctuation.separator.method.period.dolphindb' },
                            2: { name: 'keyword.operator.prototype.dolphindb' },
                            3: { patterns: [{ include: '#function_name' }] }
                        },
                        end: '(?<=\\))',
                        name: 'meta.method-call.dolphindb',
                        patterns: [{ include: '#arguments' }]
                    }
                ]
            },
            
            
            function_name: {
                patterns: [
                    {
                        match: '[^\\d\\W]\\w*!?',
                        name: 'entity.name.function.dolphindb'
                    },
                    {
                        match: '\\d[\\w]*',
                        name: 'invalid.illegal.identifier.dolphindb'
                    }
                ]
            },
            
            function_params: {
                patterns: [
                    {
                        begin: '\\(',
                        beginCaptures: {
                            0: {
                                name: 'punctuation.definition.parameters.begin.bracket.round.dolphindb'
                            }
                        },
                        end: '\\)',
                        endCaptures: {
                            0: {
                                name: 'punctuation.definition.parameters.end.bracket.round.dolphindb'
                            }
                        },
                        name: 'meta.parameters.dolphindb',
                        patterns: [
                            {
                                include: '#variable'
                            },
                            {
                                match: '(@(?:[a-zA-Z_$][\\w$]*)?)(\\.\\.\\.)?',
                                captures: {
                                    1: {
                                        name: 'variable.parameter.function.readwrite.instance.dolphindb'
                                    },
                                    2: {
                                        name: 'keyword.operator.splat.dolphindb'
                                    }
                                }
                            },
                            {
                                include: '$self'
                            }
                        ]
                    }
                ]
            },
            
            comment: {
                patterns: python ? [
                    {
                        begin: '#',
                        beginCaptures: {
                            0: {
                                name: 'punctuation.definition.comment.dolphindb'
                            }
                        },
                        end: '$',
                        name: 'comment.line.number-sign.dolphindb'
                    }
                ] : [
                    {
                        begin: '/\\*',
                        beginCaptures: {
                            0: {
                                name: 'punctuation.definition.comment.dolphindb'
                            }
                        },
                        end: '\\*/',
                        endCaptures: {
                            0: {
                                name: 'punctuation.definition.comment.dolphindb'
                            }
                        },
                        name: 'comment.block.dolphindb'
                    },
                    {
                        begin: '//',
                        beginCaptures: {
                            0: {
                                name: 'punctuation.definition.comment.dolphindb'
                            }
                        },
                        end: '$',
                        name: 'comment.line.number-sign.dolphindb'
                    },
                ]
            },
            
            arguments: {
                patterns: [
                    {
                        begin: '\\(',
                        beginCaptures: {
                            0: {
                                name: 'punctuation.definition.arguments.begin.bracket.round.dolphindb'
                            }
                        },
                        end: '\\)',
                        endCaptures: {
                            0: {
                                name: 'punctuation.definition.arguments.end.bracket.round.dolphindb'
                            }
                        },
                        name: 'meta.arguments.dolphindb',
                        patterns: [
                            {
                                include: '$self'
                            },
                            {
                                include: '#literal'
                            },
                            {
                                include: '#variable'
                            }
                        ]
                    }
                ]
            },
            
            variable: {
                patterns: [
                    {
                        match: '(@)([a-zA-Z_\\$]\\w*)?',
                        name: 'variable.other.readwrite.instance.dolphindb'
                    }
                ]
            },
            
            interpolated_dolphindb: {
                patterns: [
                    {
                        begin: '\\#\\{',
                        captures: {
                            0: {
                                name: 'punctuation.section.embedded.dolphindb'
                            }
                        },
                        end: '\\}',
                        name: 'source.dolphindb.embedded.source',
                        patterns: [
                            {
                                include: '$self'
                            }
                        ]
                    }
                ]
            },
            
            
            operator: {
                patterns: [
                    {
                        match: '<<|>>',
                        name: 'keyword.operator.bitwise.shift.dolphindb'
                    },
                    {
                        match: '!=|<=|>=|==|>|<',
                        name: 'keyword.operator.comparison.dolphindb'
                    },
                    {
                        match: '<-|->',
                        name: 'keyword.operator.join.dolphindb'
                    },
                    {
                        match: '&&|!|\\|\\|',
                        name: 'keyword.operator.logical.dolphindb'
                    },
                    {
                        match: '&|\\||\\^',
                        name: 'keyword.operator.bitwise.dolphindb'
                    },
                    {
                        match: '\\.\\.',
                        name: 'keyword.operator.splat.dolphindb'
                    },
                    {
                        match: '\\?',
                        name: 'keyword.operator.existential.dolphindb'
                    },
                    {
                        match: '/|<-|%|\\*|/|-|\\$|\\+',
                        name: 'keyword.operator.dolphindb'
                    },
                    {
                        match: '([a-zA-Z$_][\\w$]*)?\\s*(=|:(?!:))(?![>=])',
                        captures: {
                            1: {
                                name: 'variable.assignment.dolphindb'
                            },
                            2: {
                                name: 'keyword.operator.assignment.dolphindb'
                            }
                        }
                    }
                ]
            },
            
            property: {
                patterns: [
                    {
                        match: '(?:(\\.)|(::))\\s*([A-Z][A-Z0-9_$]*\\b\\$*)(?=\\s*\\??(\\.\\s*[a-zA-Z_$]\\w*|::))',
                        captures: {
                            1: {
                                name: 'punctuation.separator.property.period.dolphindb'
                            },
                            2: {
                                name: 'keyword.operator.prototype.dolphindb'
                            },
                            3: {
                                name: 'constant.other.object.property.dolphindb'
                            }
                        }
                    },
                    {
                        match: '(?:(\\.)|(::))\\s*(\\$*[a-zA-Z_$][\\w$]*)(?=\\s*\\??(\\.\\s*[a-zA-Z_$]\\w*|::))',
                        captures: {
                            1: {
                                name: 'punctuation.separator.property.period.dolphindb'
                            },
                            2: {
                                name: 'keyword.operator.prototype.dolphindb'
                            },
                            3: {
                                name: 'variable.other.object.property.dolphindb'
                            }
                        }
                    },
                    {
                        match: '(?:(\\.)|(::))\\s*([A-Z][A-Z0-9_$]*\\b\\$*)',
                        captures: {
                            1: {
                                name: 'punctuation.separator.property.period.dolphindb'
                            },
                            2: {
                                name: 'keyword.operator.prototype.dolphindb'
                            },
                            3: {
                                name: 'constant.other.property.dolphindb'
                            }
                        }
                    },
                    {
                        match: '(?:(\\.)|(::))\\s*(\\$*[a-zA-Z_$][\\w$]*)',
                        captures: {
                            1: {
                                name: 'punctuation.separator.property.period.dolphindb'
                            },
                            2: {
                                name: 'keyword.operator.prototype.dolphindb'
                            },
                            3: {
                                name: 'variable.other.property.dolphindb'
                            }
                        }
                    },
                    {
                        match: '(?:(\\.)|(::))\\s*([0-9][\\w$]*)',
                        captures: {
                            1: {
                                name: 'punctuation.separator.property.period.dolphindb'
                            },
                            2: {
                                name: 'keyword.operator.prototype.dolphindb'
                            },
                            3: {
                                name: 'invalid.illegal.identifier.dolphindb'
                            }
                        }
                    }
                ]
            }
        }
    } as Block
}


export const tm_language = get_tm_language(false)

export const tm_language_python = get_tm_language(true)


interface Block {
    patterns: Pattern[]
    repository?: Record<string, Pattern | Block>
}

type Pattern = Match | Include | Block

type Match = MatchOne | MatchBeginEnd

interface MatchOne {
    /** a single-line regular expression */
    match: RegExp | string
    
    /** This is the scope that will be applied to the matched text */
    name?: string
    
    /** This use of the captures > patterns structure is extremely important. 
        Without it, a stretch of text matched by a match rule is considered finished, and 
        TextMate’s search proceeds to the rest of the line after the matched text. 
        With it, the stretch of matched text itself becomes a candidate for further matches. 
    */
    captures?: Captures
}

interface MatchBeginEnd {
    begin: RegExp | string
    
    end: RegExp | string
    
    /** This is the scope (or an expression evaluating to a scope) to be applied to 
        the entire matched stretch(es) of text starting at the start of the begin match.
    */
    name?: string
    
    /** This is the scope to be applied to what’s between the begin match and the end match (or the end of the document). */
    contentName?: string
    
    /** it applies to the region between the begin and end matches. */
    patterns?: Pattern[]
    
    beginCaptures?: Captures
    
    endCaptures?: Captures
    
    whileCaptures?: Captures
    
    /** If the name or number of the matched group happens to be the same for both the begin pattern and the other pattern, 
        you can (if appropriate) use captures as a shorthand to avoid saying the same thing twice.
    */
    captures?: Captures
    
    applyEndPatternLast?: 1
}

interface Include {
    include: string
}

type Captures = Record<string | number, {
    /** This is the scope that will be assigned to the matched group text. */
    name?: string
    
    /** This is a list of match rules to be sought within the matched group text 
        — thus permitting the search for matches to continue inside the matched text.
    */
    patterns?: Pattern[]
}>

