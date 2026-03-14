---
title: 5. expression parsing functions
description: parser
---

Now we will implement functions to parse all the other expressions that we need.
Next we need to add those expressions to our expression enum, and update token
stats.

## Implementation

### Assignment

This function will be called when parsing `= += -= *= /=` tokens. For example,
it will be used when:

```rust
a += 52
```

It needs to know value, operator, and target to assign to.

```rs
//parser/parsing_functions/mod.rs
pub fn assignment(parser: &mut Parser, left: Expression, _: i8) -> Result<Expression> {
    let operator = parser.advance().to_owned();
    let value = Box::new(expression(parser, 0)?);
    Ok(Expression::Assignment {
        target: Box::new(left),
        operator,
        value,
        debug_data: parser.debug_data(),
    })
}
```

### Increment && Decrement

It's basically an assignment but without a value

<details>
<summary> ⚠️ Implementation </summary>

```rs
//parser/parsing_functions/mod.rs
pub fn decrement(parser: &mut Parser, left: Expression, _: i8) -> Result<Expression> {
    parser.expect(TokenKind::MinusMinus)?;
    Ok(Expression::Decrement {
        target: Box::new(left),
        debug_data: parser.debug_data(),
    })
}
pub fn increment(parser: &mut Parser, left: Expression, _: i8) -> Result<Expression> {
    parser.expect(TokenKind::PlusPlus)?;
    Ok(Expression::Increment {
        target: Box::new(left),
        debug_data: parser.debug_data(),
    })
}
```

</details>

### Type Conversion

We have already implemented a nod function for a `(` token- grouping expression.
`2 * (52 - 22)`.

In c to convert type of a variable you write: `bool z = (bool)1`. To
differentiate this we will check value inside of the parentheses. If it is an
identifier, and its value is inside of the parser::valid_data_type_names, than
it is a type conversion. The type conversion itself has to know its type, and
target it converts ( the next expression).

<details>
<summary> ⚠️ Implementation </summary>

```rs
//parser/parsing_functions/mod.rs
pub fn open_paren(parser: &mut Parser) -> Result<Expression> {
    parser.expect(TokenKind::OpenParen)?;

    let current = parser.current();
    if current.kind == TokenKind::Identifier
        && parser
            .valid_data_type_names
            .contains(current.value.as_str())
    {
        let data_type =
            types::parse(parser).context("open_paren -> TypeConversion -> data_type")?;
        parser.expect(TokenKind::CloseParen)?;
        let value = expression(parser, 0).context("open_paren -> TypeConversion -> value")?;

        Ok(Expression::TypeConversion {
            value: Box::new(value),
            data_type,
            debug_data: parser.debug_data(),
        })
    } else {
        let value = Box::new(expression(parser, 0)?);

        parser.expect(TokenKind::CloseParen)?;
        Ok(Expression::Grouping {
            value,
            debug_data: parser.debug_data(),
        })
    }
}
```

</details>

### Dereference

```c
void do_smth(int *to_modify){
...
*to_modify = 5;
...
}
```

You dereference a pointer by putting a star before a name of a variable.
Dereferencing is a fancy way of saying: 'access a value inside a pointer'.

<details>
<summary> ⚠️ Implementation </summary>

```rs
//parser/parsing_functions/mod.rs
pub fn dereference(parser: &mut Parser) -> Result<Expression> {
    parser.expect(TokenKind::Star)?;
    let value = expression(parser, 0)?;

    Ok(Expression::Dereference {
        value: Box::new(value),
        debug_data: parser.debug_data(),
    })
}
```

</details>

### Access Reference

```c
int a = 25;
int *ptr = &a;
```

Basically a reversed dereference

<details>
<summary> ⚠️ Implementation </summary>

```rs
//parser/parsing_functions/mod.rs
pub fn access_reference(parser: &mut Parser) -> Result<Expression> {
    parser.expect(TokenKind::Reference)?;
    let value = expression(parser, 0)?;

    Ok(Expression::AccessReference {
        value: Box::new(value),
        debug_data: parser.debug_data(),
    })
}
```

</details>

### Static

```c
static int count = 0;
```

In C static keyword tells the compiler to store this variable on
[.data/.bss](https://www.geeksforgeeks.org/c/memory-layout-of-c-program/)
instead of the
[stack](https://os.phil-opp.com/heap-allocation/#local-and-static-variables).
![memory layout c](https://media.geeksforgeeks.org/wp-content/uploads/20250122155858092295/Memory-Layout-of-C-Program.webp)
It allows you to make value of this variable persist throughout the lifetime of
a program, without using heap.

<details>
<summary> ⚠️ Implementation </summary>

```rs
//parser/parsing_functions/mod.rs
pub fn static_expr(parser: &mut Parser) -> Result<Expression> {
    parser.expect(TokenKind::Static)?;
    let value = expression(parser, 0)?;
    Ok(Expression::Static {
        value: Box::new(value),
        debug_data: parser.debug_data(),
    })
}
```

</details>

### Member

```c
some.thing.to.access = 2;
```

Required data:

- The thing it accesses - left
- property- right

<details>
<summary> ⚠️ Implementation </summary>

```rs
//parser/parsing_functions/mod.rs
pub fn member_expr(parser: &mut Parser, left: Expression, _: i8) -> Result<Expression> {
    parser.expect(TokenKind::Dot)?;
    let right = expression(parser, 0).with_context(|| format!("member expr-> left:{:?}", left))?;

    Ok(Expression::MemberExpr {
        left: Box::new(left),
        right: Box::new(right),
        debug_data: parser.debug_data(),
    })
}
```

</details>

### Boolean

Just convert true/false tokens into boolean

<details>
<summary> ⚠️ Implementation </summary>

```rs
//parser/parsing_functions/data_parsing.rs
pub fn boolean(parser: &mut Parser) -> Result<Expression> {
    let token = parser.advance();
    return Ok(Expression::Boolean(
        match token.kind {
            crate::lexer::token::TokenKind::True => true,
            crate::lexer::token::TokenKind::False => false,
            _ => {
                bail!(
                    "expected to find token of kind either True or False, found: '{:?}'",
                    token.kind
                )
            }
        },
        parser.debug_data(),
    ));
}
```

</details>

### String

Just take value from the token

<details>
<summary> ⚠️ Implementation </summary>

```rs
//parser/parsing_functions/data_parsing.rs
pub fn string(parser: &mut Parser) -> Result<Expression> {
    let token = parser.advance();

    return Ok(Expression::String(
        token.value.to_owned(),
        parser.debug_data(),
    ));
}
```

</details>

### Compiler Data

```c
#include "this part also should be included"
```

This is all you should need to implement this.

<details>
<summary> ⚠️ Implementation </summary>

```rs
//parser/parsing_functions/mod.rs
pub fn compiler_data(parser: &mut Parser) -> Result<Expression> {
    Ok(Expression::CompilerData(
        parser.advance().value.to_owned(),
        parser.debug_data(),
    ))
}
```

</details>

### Open Curly

In C, there are many things that could be wrapped in curly braces. Thankfully
most of them will be parsed beforehand by functions called when encountering a
keyword. For example: `if (...) {if statement contents}` or
`int test(){function contents}`. This allows us to only have to think about 2
cases.

#### Creating a New 'Scope'

```c
int test_fn(){
    {
        int var_name = 25;
    }
    int var_name = 55;
}
```

#### Initializing a Struct

```c
myStructure s1 = {13, 'B', "Some text"};
```

This requires checking which case we are dealing with and then calling an
appropriate function.

#### Scope Block

Scope block will just consist of an array of expressions. Those expressions will
represent lines inside of the block. We will be just parsing expressions until
we encounter a closing curly brace.

#### Struct Initialization

This requires reading all values inside of the initialization statement. Comma
has a low binding power, so parsing expressions with binding power of 0, will
give us the required values. Just repeat this process, for all the commas.

<details>
<summary> ⚠️ Implementation </summary>

```rs
//parser/parsing_functions/statement_parsing.rs
pub fn parse_open_curly(parser: &mut Parser) -> Result<Expression> {
    parser.expect(TokenKind::OpenCurly)?;
    // this might not be the best way to do this, but  i don't see another one for now
    if parser.next().kind == TokenKind::Comma {
        parse_data_structure_initialization(parser)
    } else {
        new_code_block(parser)
    }
}

pub fn new_code_block(parser: &mut Parser) -> Result<Expression> {
    let mut inside = Vec::new();
    while parser.current().kind != TokenKind::CloseCurly {
        inside.push(parsing_functions::expression(parser, 0).with_context(|| {
            format!(
                "debug data: {:?},\n parsed expressions:{:#?}",
                parser.debug_data(),
                inside
            )
        })?);
        if parser.current().kind == TokenKind::SemiColon {
            parser.advance();
        }
    }
    parser.expect(TokenKind::CloseCurly)?;

    Ok(Expression::NewCodeBlock {
        inside,
        debug_data: parser.debug_data(),
    })
}
pub fn parse_data_structure_initialization(parser: &mut Parser) -> Result<Expression> {
    let mut values = Vec::new();
    loop {
        let value = expression(parser, 0)?;
        values.push(value);
        if parser.current().kind == TokenKind::CloseCurly {
            break;
        }
        parser.expect(TokenKind::Comma)?;
    }
    parser.expect(TokenKind::CloseCurly)?;

    Ok(Expression::DataStructureInitialization {
        values,
        debug_data: parser.debug_data(),
    })
}
```

</details>

### Identifier Token

In rust you write `let` when you declare a variable, or `fn` when you declare a
function. In c, compiler must 'guess' your intention. To accomplish this we will
use the `parser::valid_data_type_names`.

If the value of a token isn't in the `parser::valid_data_type_names`, we simply
output an identifier expression with its value.

We need to use the `types::parse()` to get the current datatype. It will be used
for the next expression. Next let's determine whether the next token is an
identifier:

- it is: we take its value as a name for variable/function.
- it isn't: return a `DataTypeAccess` expression with the previously parsed
  datatype.

Next, check for an array declaration. This is needed because in C square
brackets are placed after a variable name: `int array[][] = ...;`.\
Use `types::wrap_data_type_in_an_array` for this.

Next check whether we are dealing with a function or a variable declaration. We
can do it by checking if the next token is a '('.

For a variable declaration, simply return an expression with a variable name and
its type.

#### Parsing Function Declarations

```c
int* func(int param,char* text){...}
---------
//this is the part that we have already parsed
```

##### Parsing Function Parameters

This is the same as parsing a struct declaration; additionally, use the next
token as the name.

##### Parsing Function Contents

This is the same as when parsing a scope block. Simply return a function
expression with:

- Name
- Datatype
- Parameters
- Contents.

<details>
<summary> ⚠️ Implementation </summary>

```rs
//parser/parsing_functions/identifier_parsing.rs
use crate::{
    lexer::token::TokenKind,
    parse,
    parser::{
        Parser,
        expression::{Expression, Property},
        parsing_functions::{self},
        types::{self, DataType},
    },
};

use anyhow::{Context, Result};
pub fn identifier(parser: &mut Parser) -> Result<Expression> {
    let first = parser.current().to_owned();

    if parser.valid_data_type_names.contains(&first.value) {
        handle_function_or_variable_declaration(parser)
            .with_context(|| format!("identifier - data type name: {}", first.value.as_str()))
    } else {
        parser.expect(first.kind)?;
        Ok(Expression::Identifier(first.value, parser.debug_data()))
    }
}

pub fn handle_function_or_variable_declaration(parser: &mut Parser) -> Result<Expression> {
    let mut data_type = types::parse(parser)
        .context("parse data type for: handle_function_or_variable_declaration")?;
    if parser.current().kind != TokenKind::Identifier {
        return Ok(Expression::DataTypeAccess {
            data_type: data_type,
            debug_data: parser.debug_data(),
        });
    }

    let name = parser.advance().to_owned();

    data_type = types::wrap_data_type_in_an_array(data_type, parser)?;

    if parser.current().kind == TokenKind::OpenParen {
        handle_function_declaration(data_type, name.value, parser)
            .context("handle_function_declaration")
    } else {
        Ok(Expression::VariableDeclaration {
            var_type: data_type,
            name: name.value,
            debug_data: parser.debug_data(),
        })
    }
}
fn handle_function_declaration(
    output_data_type: DataType,
    name: String,
    parser: &mut Parser,
) -> Result<Expression> {
    parser.expect(TokenKind::OpenParen)?;

    let mut properties = Vec::new();

    if parser.current().kind != TokenKind::CloseParen {
        loop {
            let data_type = types::parse(parser).context("parse function input data types")?;
            let name = parser.expect(TokenKind::Identifier)?.value.to_owned();
            properties.push(Property {
                var_name: name,
                var_type: data_type,
            });
            if parser.current().kind == TokenKind::CloseParen {
                break;
            }
            parser
                .expect(TokenKind::Comma)
                .context("function properties")?;
        }
    }
    parser.expect(TokenKind::CloseParen)?;
    parser.expect(TokenKind::OpenCurly)?;

    let mut inside = Vec::new();
    while parser.current().kind != TokenKind::CloseCurly {
        inside.push(parsing_functions::expression(parser, 0).context("inside function")?);
        if parser.current().kind == TokenKind::SemiColon {
            parser.advance();
        }
    }

    parser.expect(TokenKind::CloseCurly)?;
    Ok(Expression::Function {
        name,
        properties,
        output: output_data_type,
        inside: inside,
        debug_data: parser.debug_data(),
    })
}
```

</details>

### If / Else

```c
if(condition && !other_thing){
contents
}else if(a>0){
contents
}else{ 
contents
}
```

It is possible to chain multiple else if statements. Each of them has its
contents and conditions. Remember to expect all the:

- Parentheses
- Curly brackets
- Keywords (like if and else).

Use `parsing_functions::expression` with a binding power of 0 to parse
conditions. It should parse all the conditions at once and preserve parentheses,
thanks to the binding powers of the tokens.

<details>
<summary> ⚠️ Implementation </summary>

```rs
//parser/parsing_functions/statement_parsing.rs
pub fn parse_if(parser: &mut Parser) -> Result<Expression> {
    parser.expect(TokenKind::If)?;
    parser.expect(TokenKind::OpenParen)?;
    let condition = parsing_functions::expression(parser, 0)?;
    parser.expect(TokenKind::CloseParen)?;
    parser.expect(TokenKind::OpenCurly)?;
    let mut inside = Vec::new();
    while parser.current().kind != TokenKind::CloseCurly {
        inside.push(parsing_functions::expression(parser, 0)?);
        parser
            .expect(TokenKind::SemiColon)
            .context("expected to find a semicolon after a expression - function contents")?;
    }
    parser.expect(TokenKind::CloseCurly)?;

    let mut chained_elses = Vec::new();

    while parser.current().kind == TokenKind::Else {
        let (else_value, break_else) = parse_else(parser)?;
        chained_elses.push(else_value);
        if break_else {
            break;
        }
    }

    Ok(Expression::If {
        condition: Box::new(condition),
        inside,
        chained_elses,
        debug_data: parser.debug_data(),
    })
}
fn parse_else(parser: &mut Parser) -> Result<(Expression, bool)> {
    parser.expect(TokenKind::Else)?;
    let (break_else, condition) = if parser.current().kind == TokenKind::If {
        parser.expect(TokenKind::If)?;
        parser.expect(TokenKind::OpenParen)?;
        let condition = parsing_functions::expression(parser, 0)?;
        parser.expect(TokenKind::CloseParen)?;
        (false, Some(Box::new(condition)))
    } else {
        (true, None)
    };
    parser.expect(TokenKind::OpenCurly)?;

    let mut inside = Vec::new();
    while parser.current().kind != TokenKind::CloseCurly {
        inside.push(parsing_functions::expression(parser, 0)?);
        parser
            .expect(TokenKind::SemiColon)
            .context("expected to find a semicolon after a expression - function contents")?;
    }
    parser.expect(TokenKind::CloseCurly)?;
    Ok((
        Expression::Else {
            condition,
            inside,
            debug_data: parser.debug_data(),
        },
        break_else,
    ))
}
```

</details>

### While

```c
while (i >25){
    i/2;
}
```

Parsing a while loop isn't really that different from parsing an if statement.
Simply read the condition and contents.

<details>
<summary> ⚠️ Implementation </summary>

```rs
//parser/parsing_functions/statement_parsing.rs
pub fn parse_while(parser: &mut Parser) -> Result<Expression> {
    parser.expect(TokenKind::While)?;
    parser.expect(TokenKind::OpenParen)?;
    let condition = parsing_functions::expression(parser, 0)?;
    parser.expect(TokenKind::CloseParen)?;
    parser.expect(TokenKind::OpenCurly)?;
    let mut inside = Vec::new();
    while parser.current().kind != TokenKind::CloseCurly {
        inside.push(parsing_functions::expression(parser, 0)?);
        parser
            .expect(TokenKind::SemiColon)
            .context("expected to find a semicolon after a expression - function contents")?;
    }
    parser.expect(TokenKind::CloseCurly)?;

    Ok(Expression::While {
        condition: Box::new(condition),
        inside,
        debug_data: parser.debug_data(),
    })
}
```

</details>

### Break

Return expression with a debug data inside and expect a `Break` token.

<details>
<summary> ⚠️ Implementation </summary>

```rs
//parser/parsing_functions/mod.rs
pub fn break_expr(parser: &mut Parser) -> Result<Expression> {
    parser.expect(TokenKind::Break)?;
    return Ok(Expression::Break {
        debug_data: parser.debug_data(),
    });
}
```

</details>

### For

```c
for(int i =0;i<25;i++){
...
}
```

Parsing a for loop requires using the `parsing_functions::expression` three
times (declaration, condition, and incrementation) followed by parsing contents.

<details>
<summary> ⚠️ Implementation </summary>

```rs
//parser/parsing_functions/statement_parsing.rs
pub fn parse_for(parser: &mut Parser) -> Result<Expression> {
    // for(int i =0;i<25;i++){
    // ...
    // }
    parser.expect(TokenKind::For)?;
    parser.expect(TokenKind::OpenParen)?;
    let iterator_init = Box::new(parsing_functions::expression(parser, 0)?);
    parser.expect(TokenKind::SemiColon)?;
    let condition = Box::new(parsing_functions::expression(parser, 0)?);
    parser.expect(TokenKind::SemiColon)?;
    let incr = Box::new(parsing_functions::expression(parser, 0)?);
    parser.expect(TokenKind::CloseParen)?;

    parser.expect(TokenKind::OpenCurly)?;
    let mut inside = Vec::new();
    while parser.current().kind != TokenKind::CloseCurly {
        inside.push(parsing_functions::expression(parser, 0)?);
        parser
            .expect(TokenKind::SemiColon)
            .context("expected to find a semicolon after a expression - function contents")?;
    }
    parser.expect(TokenKind::CloseCurly)?;

    Ok(Expression::For {
        iterator_init,
        condition,
        incr,
        inside,
        debug_data: parser.debug_data(),
    })
}
```

</details>

### Typedef

```c
typedef struct {
  char brand[2];
  int year;
} Car;
```

Typedef statement tells compiler to create a new datatype with a certain name,
and add it to the `Parser::valid_data_type_names`. Doing this requires parsing
datatype and name first.

<details>
<summary> ⚠️ Implementation </summary>

```rs
//parser/parsing_functions/mod.rs
pub fn type_def(parser: &mut Parser) -> Result<Expression> {
    parser.expect(TokenKind::Typedef)?;
    let data_type = types::parse(parser).context("type_def -> data_type")?;
    let name = parser
        .expect(TokenKind::Identifier)
        .context("type_def -> name")?
        .value;

    parser.valid_data_type_names.insert(name.to_string());

    Ok(Expression::Typedef {
        data_type,
        name,
        debug_data: parser.debug_data(),
    })
}
```

</details>

### Array Access

```c
smth = array[x+2];
```

Parsing this requires knowledge of:

- Expression that is being accessed.
- Index.

<details>
<summary> ⚠️ Implementation </summary>

```rs
//parser/parsing_functions/mod.rs
pub fn array_access(parser: &mut Parser, left: Expression, _: i8) -> Result<Expression> {
    parser.expect(TokenKind::OpenBracket)?;
    let index = expression(parser, 0)?;

    parser.expect(TokenKind::CloseBracket)?;
    Ok(Expression::ArrayAccess {
        left: Box::new(left),
        index: Box::new(index),
        debug_data: parser.debug_data(),
    })
}
```

</details>

### Function Call

```c
func_name(i,x/25,car.name.char());
```

This will be called by the open parentheses token.

Required data:

- Expression on the left.
- Function parameters.

<details>
<summary> ⚠️ Implementation </summary>

```rs
//parser/parsing_functions/mod.rs
pub fn function_call(parser: &mut Parser, left: Expression, _: i8) -> Result<Expression> {
    parser.expect(TokenKind::OpenParen)?;
    let mut properties = Vec::new();
    loop {
        let current_token = parser.current().to_owned();
        properties.push(
            expression(parser, 0).with_context(|| {
                format!("function call- parse input values-> {:?}", current_token)
            })?,
        );

        if parser.current().kind == TokenKind::CloseParen {
            break;
        }
        parser.advance();
    }
    parser
        .expect(TokenKind::CloseParen)
        .context("function_cal -> end paren")?;

    Ok(Expression::FunctionCall {
        left: Box::new(left),
        values: properties,
        debug_data: parser.debug_data(),
    })
}
```

</details>

### Return

```c
return a+b;
```

<details>
<summary> ⚠️ Implementation </summary>

```rs
//parser/parsing_functions/mod.rs
pub fn return_expr(parser: &mut Parser) -> Result<Expression> {
    parser.expect(TokenKind::Return)?;
    let value = expression(parser, 0)?;
    Ok(Expression::Return {
        value: Box::new(value),
        debug_data: parser.debug_data(),
    })
}
```

</details>

As you can see implementing a c parser is a pretty easy task, but it requires a
lot of repetitive work.

## Adding Token Stats

Next, assign newly implemented functions to the correct token stats. Review all
the token stats and consider which functions are appropriate to use. If you are
unsure, go back to the part where they were implemented, and think how they
should be used.

## At the End:

<details>
<summary> ⚠️ Implementation </summary>

````rust
//parser/expression.rs
use crate::{
    lexer::token::{Token, TokenKind},
    parser::types::DataType,
};

#[derive(Debug, Clone)]
pub struct DebugData {
    pub line: u16,
    pub file: String,
}

#[derive(Debug, Clone)]
pub struct Property {
    pub var_name: String,
    pub var_type: DataType,
}

#[derive(Debug, Clone)]
pub enum Expression {
    Skip,
    Increment {
        target: Box<Expression>,
        debug_data: DebugData,
    },
    Decrement {
        target: Box<Expression>,
        debug_data: DebugData,
    },
    DataStructureInitialization {
        values: Vec<Expression>,
        debug_data: DebugData,
    },
    TypeConversion {
        value: Box<Expression>,
        data_type: DataType,
        debug_data: DebugData,
    },
    Typedef {
        data_type: DataType,
        name: String,
        debug_data: DebugData,
    },
    Dereference {
        value: Box<Expression>,
        debug_data: DebugData,
    },
    Boolean(bool, DebugData),

    Number(u32, DebugData),

    CompilerData(String, DebugData),
    String(String, DebugData),
    Identifier(String, DebugData),
    Prefix {
        prefix: Token,
        value: Box<Expression>,
        debug_data: DebugData,
    },
    // target operator value
    Assignment {
        target: Box<Expression>,
        operator: Token,
        value: Box<Expression>,
        debug_data: DebugData,
    },
    // type name mutable
    DataTypeAccess {
        data_type: DataType,
        debug_data: DebugData,
    },
    VariableDeclaration {
        var_type: DataType,
        name: String,
        debug_data: DebugData,
    },
    Grouping {
        value: Box<Expression>,
        debug_data: DebugData,
    },
    Struct {
        public: bool,
        name: String,
        properties: Vec<Property>,
        functions: Vec<Expression>,

        debug_data: DebugData,
    },
    NewCodeBlock {
        inside: Vec<Expression>,
        debug_data: DebugData,
    },

    Binary {
        left: Box<Expression>,
        operator: Token,
        right: Box<Expression>,
        debug_data: DebugData,
    },
    Function {
        name: String,
        properties: Vec<Property>,
        output: DataType,
        inside: Vec<Expression>,
        debug_data: DebugData,
    },

    MemberExpr {
        left: Box<Expression>,
        right: Box<Expression>,

        debug_data: DebugData,
    },
    AccessReference {
        value: Box<Expression>,

        debug_data: DebugData,
    },
    Break {
        debug_data: DebugData,
    },
    Return {
        value: Box<Expression>,

        debug_data: DebugData,
    },
    If {
        condition: Box<Expression>,
        inside: Vec<Expression>,

        /// those will be else statements with or without conditions
        chained_elses: Vec<Expression>,
        debug_data: DebugData,
    },
    Else {
        condition: Option<Box<Expression>>,
        inside: Vec<Expression>,

        debug_data: DebugData,
    },
    ArrayAccess {
        left: Box<Expression>,
        index: Box<Expression>,

        debug_data: DebugData,
    },

    While {
        condition: Box<Expression>,
        inside: Vec<Expression>,

        debug_data: DebugData,
    },
    Static {
        value: Box<Expression>,
        debug_data: DebugData,
    },

    For {
        iterator_init: Box<Expression>,
        condition: Box<Expression>,
        incr: Box<Expression>,
        inside: Vec<Expression>,

        debug_data: DebugData,
    },
    FunctionCall {
        left: Box<Expression>,
        values: Vec<Expression>,
        debug_data: DebugData,
    },
}
    ```



``` rust
//parser/parsing_functions/data_parsing.rs
use crate::parser::{Parser, expression::Expression};
use anyhow::{Result, bail};

pub fn string(parser: &mut Parser) -> Result<Expression> {
    let token = parser.advance();

    return Ok(Expression::String(
        token.value.to_owned(),
        parser.debug_data(),
    ));
}

pub fn number(parser: &mut Parser) -> Result<Expression> {
    let token = parser.advance();

    return Ok(Expression::Number(
        str_to_num(&token.value)?,
        parser.debug_data(),
    ));
}
pub fn str_to_num(s: &str) -> Result<u32, std::num::ParseIntError> {
    if let Some(hex) = s.strip_prefix("0x") {
        u32::from_str_radix(hex, 16)
    } else if let Some(bin) = s.strip_prefix("0b") {
        u32::from_str_radix(bin, 2)
    } else if let Some(oct) = s.strip_prefix("0o") {
        u32::from_str_radix(oct, 8)
    } else {
        // default to decimal
        s.parse::<u32>()
    }
}

pub fn boolean(parser: &mut Parser) -> Result<Expression> {
    let token = parser.advance();
    return Ok(Expression::Boolean(
        match token.kind {
            crate::lexer::token::TokenKind::True => true,
            crate::lexer::token::TokenKind::False => false,
            _ => {
                bail!(
                    "expected to find token of kind either True or False, found: '{:?}'",
                    token.kind
                )
            }
        },
        parser.debug_data(),
    ));
}
````

```rust
//parser/parsing_functions/identifier_parsing.rs

use crate::{
    lexer::token::TokenKind,
    parser::{
        Parser,
        expression::{Expression, Property},
        parsing_functions::{self},
        types::{self, DataType},
    },
};

use anyhow::{Context, Result};
pub fn identifier(parser: &mut Parser) -> Result<Expression> {
    let first = parser.current().to_owned();

    if parser.valid_data_type_names.contains(&first.value) {
        handle_function_or_variable_declaration(parser)
            .with_context(|| format!("identifier - data type name: {}", first.value.as_str()))
    } else {
        parser.expect(first.kind)?;
        Ok(Expression::Identifier(first.value, parser.debug_data()))
    }
}

pub fn handle_function_or_variable_declaration(parser: &mut Parser) -> Result<Expression> {
    let mut data_type = types::parse(parser)
        .context("parse data type for: handle_function_or_variable_declaration")?;
    if parser.current().kind != TokenKind::Identifier {
        return Ok(Expression::DataTypeAccess {
            data_type: data_type,
            debug_data: parser.debug_data(),
        });
    }

    let name = parser.advance().to_owned();

    data_type = types::wrap_data_type_in_an_array(data_type, parser)?;

    if parser.current().kind == TokenKind::OpenParen {
        handle_function_declaration(data_type, name.value, parser)
            .context("handle_function_declaration")
    } else {
        Ok(Expression::VariableDeclaration {
            var_type: data_type,
            name: name.value,
            debug_data: parser.debug_data(),
        })
    }
}
fn handle_function_declaration(
    output_data_type: DataType,
    name: String,
    parser: &mut Parser,
) -> Result<Expression> {
    parser.expect(TokenKind::OpenParen)?;

    let mut properties = Vec::new();

    if parser.current().kind != TokenKind::CloseParen {
        loop {
            let data_type = types::parse(parser).context("parse function input data types")?;
            let name = parser.expect(TokenKind::Identifier)?.value.to_owned();
            properties.push(Property {
                var_name: name,
                var_type: data_type,
            });
            if parser.current().kind == TokenKind::CloseParen {
                break;
            }
            parser
                .expect(TokenKind::Comma)
                .context("function properties")?;
        }
    }
    parser.expect(TokenKind::CloseParen)?;
    parser.expect(TokenKind::OpenCurly)?;

    let mut inside = Vec::new();
    while parser.current().kind != TokenKind::CloseCurly {
        inside.push(parsing_functions::expression(parser, 0).context("inside function")?);
        if parser.current().kind == TokenKind::SemiColon {
            parser.advance();
        }
    }

    parser.expect(TokenKind::CloseCurly)?;
    Ok(Expression::Function {
        name,
        properties,
        output: output_data_type,
        inside: inside,
        debug_data: parser.debug_data(),
    })
}
```

```rust
//parser/parsing_functions/mod.rs
use crate::{
    lexer::token::TokenKind,
    parser::{self, Parser, expression::Expression, types},
};
pub mod data_parsing;
pub mod identifier_parsing;
pub mod statement_parsing;
use anyhow::{Context, Result};
use log::info;

pub fn function_call(parser: &mut Parser, left: Expression, _: i8) -> Result<Expression> {
    parser.expect(TokenKind::OpenParen)?;
    let mut properties = Vec::new();
    loop {
        let current_token = parser.current().to_owned();
        properties.push(
            expression(parser, 0).with_context(|| {
                format!("function call- parse input values-> {:?}", current_token)
            })?,
        );

        if parser.current().kind == TokenKind::CloseParen {
            break;
        }
        parser.advance();
    }
    parser
        .expect(TokenKind::CloseParen)
        .context("function_cal -> end paren")?;

    Ok(Expression::FunctionCall {
        left: Box::new(left),
        values: properties,
        debug_data: parser.debug_data(),
    })
}

pub fn assignment(parser: &mut Parser, left: Expression, _: i8) -> Result<Expression> {
    let operator = parser.advance().to_owned();
    let value = Box::new(expression(parser, 0)?);
    Ok(Expression::Assignment {
        target: Box::new(left),
        operator,
        value,
        debug_data: parser.debug_data(),
    })
}

pub fn return_expr(parser: &mut Parser) -> Result<Expression> {
    parser.expect(TokenKind::Return)?;
    let value = expression(parser, 0)?;
    Ok(Expression::Return {
        value: Box::new(value),
        debug_data: parser.debug_data(),
    })
}
pub fn expression(parser: &mut Parser, bp: i8) -> Result<Expression> {
    let mut current_expression = {
        let nod_function = parser.current_stats()?.nod_function.with_context(|| {
            format!(
                "expected token kind: '{:?}' to have nod function.",
                parser.current().kind
            )
        })?;
        let current_token = parser.current().to_owned();
        nod_function(parser)
            .with_context(|| format!("parse expression, nod- {:?}", current_token))?
    };

    while let current_stats = parser.current_stats()?
        && current_stats.binding_power > bp
    {
        let led_function = current_stats.led_function.with_context(|| {
            format!(
                "expected token kind: '{:?}' to have a led function.",
                parser.current().kind
            )
        })?;

        let current_token_for_dbg = parser.current().to_owned();
        let current_expr_for_dbg = current_expression.to_owned();

        current_expression = led_function(parser, current_expression, current_stats.binding_power)
            .context(format!(
                "parse expression, led- {:?}, current expression: {:?}",
                current_token_for_dbg, current_expr_for_dbg
            ))?;
    }

    return Ok(current_expression);
}

pub fn binary(parser: &mut Parser, left: Expression, bp: i8) -> Result<Expression> {
    let operator = parser.advance().to_owned();
    let right =
        expression(parser, bp).context("binary operation- parse expression on the right")?;

    Ok(Expression::Binary {
        left: Box::new(left),
        operator: operator,
        right: Box::new(right),
        debug_data: parser.debug_data(),
    })
}

pub fn compiler_data(parser: &mut Parser) -> Result<Expression> {
    Ok(Expression::CompilerData(
        parser.advance().value.to_owned(),
        parser.debug_data(),
    ))
}

pub fn prefix(parser: &mut Parser) -> Result<Expression> {
    let prefix = parser.advance().to_owned();
    let value = expression(parser, 0).context("prefix")?;

    return Ok(Expression::Prefix {
        prefix,
        value: Box::new(value),
        debug_data: parser.debug_data(),
    });
}
pub fn break_expr(parser: &mut Parser) -> Result<Expression> {
    parser.expect(TokenKind::Break)?;
    return Ok(Expression::Break {
        debug_data: parser.debug_data(),
    });
}
pub fn open_paren(parser: &mut Parser) -> Result<Expression> {
    parser.expect(TokenKind::OpenParen)?;

    let current = parser.current();
    if current.kind == TokenKind::Identifier
        && parser
            .valid_data_type_names
            .contains(current.value.as_str())
    {
        let data_type =
            types::parse(parser).context("open_paren -> TypeConversion -> data_type")?;
        parser.expect(TokenKind::CloseParen)?;
        let value = expression(parser, 0).context("open_paren -> TypeConversion -> value")?;

        Ok(Expression::TypeConversion {
            value: Box::new(value),
            data_type,
            debug_data: parser.debug_data(),
        })
    } else {
        let value = Box::new(expression(parser, 0)?);

        parser.expect(TokenKind::CloseParen)?;
        Ok(Expression::Grouping {
            value,
            debug_data: parser.debug_data(),
        })
    }
}
pub fn member_expr(parser: &mut Parser, left: Expression, _: i8) -> Result<Expression> {
    parser.expect(TokenKind::Dot)?;
    let right = expression(parser, 0).with_context(|| format!("member expr-> left:{:?}", left))?;

    Ok(Expression::MemberExpr {
        left: Box::new(left),
        right: Box::new(right),
        debug_data: parser.debug_data(),
    })
}
pub fn array_access(parser: &mut Parser, left: Expression, _: i8) -> Result<Expression> {
    parser.expect(TokenKind::OpenBracket)?;
    let index = expression(parser, 0)?;

    parser.expect(TokenKind::CloseBracket)?;
    Ok(Expression::ArrayAccess {
        left: Box::new(left),
        index: Box::new(index),
        debug_data: parser.debug_data(),
    })
}

pub fn static_expr(parser: &mut Parser) -> Result<Expression> {
    parser.expect(TokenKind::Static)?;
    let value = expression(parser, 0)?;
    Ok(Expression::Static {
        value: Box::new(value),
        debug_data: parser.debug_data(),
    })
}
pub fn type_def(parser: &mut Parser) -> Result<Expression> {
    parser.expect(TokenKind::Typedef)?;
    let data_type = types::parse(parser).context("type_def -> data_type")?;
    let name = parser
        .expect(TokenKind::Identifier)
        .context("type_def -> name")?
        .value;

    parser.valid_data_type_names.insert(name.to_string());

    Ok(Expression::Typedef {
        data_type,
        name,
        debug_data: parser.debug_data(),
    })
}

pub fn dereference(parser: &mut Parser) -> Result<Expression> {
    parser.expect(TokenKind::Star)?;
    let value = expression(parser, 0)?;

    Ok(Expression::Dereference {
        value: Box::new(value),
        debug_data: parser.debug_data(),
    })
}

pub fn decrement(parser: &mut Parser, left: Expression, _: i8) -> Result<Expression> {
    parser.expect(TokenKind::MinusMinus)?;
    Ok(Expression::Decrement {
        target: Box::new(left),
        debug_data: parser.debug_data(),
    })
}
pub fn increment(parser: &mut Parser, left: Expression, _: i8) -> Result<Expression> {
    parser.expect(TokenKind::PlusPlus)?;
    Ok(Expression::Increment {
        target: Box::new(left),
        debug_data: parser.debug_data(),
    })
}

pub fn access_reference(parser: &mut Parser) -> Result<Expression> {
    parser.expect(TokenKind::Reference)?;
    let value = expression(parser, 0)?;

    Ok(Expression::AccessReference {
        value: Box::new(value),
        debug_data: parser.debug_data(),
    })
}
```

```rust
//parser/parsing_functions/statement_parsing.rs
use std::collections::vec_deque;

use anyhow::{Context, Result};
use log::info;

use crate::{
    lexer::token::TokenKind,
    parser::{
        Parser,
        expression::Expression,
        parsing_functions::{self, expression},
    },
};
pub fn parse_open_curly(parser: &mut Parser) -> Result<Expression> {
    parser.expect(TokenKind::OpenCurly)?;
    // this might not be the best way to do this, but  i don't see another one for now
    if parser.next().kind == TokenKind::Comma {
        parse_data_structure_initialization(parser)
    } else {
        new_code_block(parser)
    }
}

pub fn new_code_block(parser: &mut Parser) -> Result<Expression> {
    let mut inside = Vec::new();
    while parser.current().kind != TokenKind::CloseCurly {
        inside.push(parsing_functions::expression(parser, 0).with_context(|| {
            format!(
                "debug data: {:?},\n parsed expressions:{:#?}",
                parser.debug_data(),
                inside
            )
        })?);
        if parser.current().kind == TokenKind::SemiColon {
            parser.advance();
        }
    }
    parser.expect(TokenKind::CloseCurly)?;

    Ok(Expression::NewCodeBlock {
        inside,
        debug_data: parser.debug_data(),
    })
}
pub fn parse_data_structure_initialization(parser: &mut Parser) -> Result<Expression> {
    let mut values = Vec::new();
    loop {
        let value = expression(parser, 0)?;
        values.push(value);
        if parser.current().kind == TokenKind::CloseCurly {
            break;
        }
        parser.expect(TokenKind::Comma)?;
    }
    parser.expect(TokenKind::CloseCurly)?;

    Ok(Expression::DataStructureInitialization {
        values,
        debug_data: parser.debug_data(),
    })
}

pub fn parse_if(parser: &mut Parser) -> Result<Expression> {
    parser.expect(TokenKind::If)?;
    parser.expect(TokenKind::OpenParen)?;
    let condition = parsing_functions::expression(parser, 0)?;
    parser.expect(TokenKind::CloseParen)?;
    parser.expect(TokenKind::OpenCurly)?;
    let mut inside = Vec::new();
    while parser.current().kind != TokenKind::CloseCurly {
        inside.push(parsing_functions::expression(parser, 0)?);
        parser
            .expect(TokenKind::SemiColon)
            .context("expected to find a semicolon after a expression - function contents")?;
    }
    parser.expect(TokenKind::CloseCurly)?;

    let mut chained_elses = Vec::new();

    while parser.current().kind == TokenKind::Else {
        let (else_value, break_else) = parse_else(parser)?;
        chained_elses.push(else_value);
        if break_else {
            break;
        }
    }

    Ok(Expression::If {
        condition: Box::new(condition),
        inside,
        chained_elses,
        debug_data: parser.debug_data(),
    })
}
fn parse_else(parser: &mut Parser) -> Result<(Expression, bool)> {
    parser.expect(TokenKind::Else)?;
    let (break_else, condition) = if parser.current().kind == TokenKind::If {
        parser.expect(TokenKind::If)?;
        parser.expect(TokenKind::OpenParen)?;
        let condition = parsing_functions::expression(parser, 0)?;
        parser.expect(TokenKind::CloseParen)?;
        (false, Some(Box::new(condition)))
    } else {
        (true, None)
    };
    parser.expect(TokenKind::OpenCurly)?;

    let mut inside = Vec::new();
    while parser.current().kind != TokenKind::CloseCurly {
        inside.push(parsing_functions::expression(parser, 0)?);
        parser
            .expect(TokenKind::SemiColon)
            .context("expected to find a semicolon after a expression - function contents")?;
    }
    parser.expect(TokenKind::CloseCurly)?;
    Ok((
        Expression::Else {
            condition,
            inside,
            debug_data: parser.debug_data(),
        },
        break_else,
    ))
}

pub fn parse_while(parser: &mut Parser) -> Result<Expression> {
    parser.expect(TokenKind::While)?;
    parser.expect(TokenKind::OpenParen)?;
    let condition = parsing_functions::expression(parser, 0)?;
    parser.expect(TokenKind::CloseParen)?;
    parser.expect(TokenKind::OpenCurly)?;
    let mut inside = Vec::new();
    while parser.current().kind != TokenKind::CloseCurly {
        inside.push(parsing_functions::expression(parser, 0)?);
        parser
            .expect(TokenKind::SemiColon)
            .context("expected to find a semicolon after a expression - function contents")?;
    }
    parser.expect(TokenKind::CloseCurly)?;

    Ok(Expression::While {
        condition: Box::new(condition),
        inside,
        debug_data: parser.debug_data(),
    })
}

pub fn parse_for(parser: &mut Parser) -> Result<Expression> {
    // for(int i =0;i<25;i++){
    // ...
    // }
    parser.expect(TokenKind::For)?;
    parser.expect(TokenKind::OpenParen)?;
    let iterator_init = Box::new(parsing_functions::expression(parser, 0)?);
    parser.expect(TokenKind::SemiColon)?;
    let condition = Box::new(parsing_functions::expression(parser, 0)?);
    parser.expect(TokenKind::SemiColon)?;
    let incr = Box::new(parsing_functions::expression(parser, 0)?);
    parser.expect(TokenKind::CloseParen)?;

    parser.expect(TokenKind::OpenCurly)?;
    let mut inside = Vec::new();
    while parser.current().kind != TokenKind::CloseCurly {
        inside.push(parsing_functions::expression(parser, 0)?);
        parser
            .expect(TokenKind::SemiColon)
            .context("expected to find a semicolon after a expression - function contents")?;
    }
    parser.expect(TokenKind::CloseCurly)?;

    Ok(Expression::For {
        iterator_init,
        condition,
        incr,
        inside,
        debug_data: parser.debug_data(),
    })
}
```

</details>

Token stats should look like this:

```rs
//parser/token_stats.rs

use std::collections::HashMap;

use crate::{
    lexer::token::TokenKind,
    parser::{
        Parser,
        expression::Expression,
        parsing_functions::{self, open_paren, identifier_parsing},
    },
};
use anyhow::Result;

type NodFunction = fn(&mut Parser) -> Result<Expression>;
type LedFunction = fn(&mut Parser, left: Expression, bp: i8) -> Result<Expression>;
pub struct TokenStats {
    pub binding_power: i8,
    pub nod_function: Option<NodFunction>,
    pub led_function: Option<LedFunction>,
}
pub fn token_stats() -> HashMap<TokenKind, TokenStats> {
    HashMap::from([
        (
            TokenKind::EndOfFile,
            TokenStats {
                binding_power: -1,
                nod_function: None,
                led_function: None,
            },
        ),
        (
            TokenKind::SemiColon,
            TokenStats {
                binding_power: -1,
                nod_function: None,
                led_function: None,
            },
        ),
        (
            TokenKind::BitwiseShiftLeft,
            TokenStats {
                binding_power: 2,
                nod_function: None,
                led_function: Some(parsing_functions::binary),
            },
        ),
        (
            TokenKind::BitwiseShiftRight,
            TokenStats {
                binding_power: 2,
                nod_function: None,
                led_function: Some(parsing_functions::binary),
            },
        ),
        (
            TokenKind::Plus,
            TokenStats {
                binding_power: 2,
                nod_function: Some(parsing_functions::prefix),
                led_function: Some(parsing_functions::binary),
            },
        ),
        (
            TokenKind::Minus,
            TokenStats {
                binding_power: 2,
                nod_function: Some(parsing_functions::prefix),
                led_function: Some(parsing_functions::binary),
            },
        ),
        (
            TokenKind::Star,
            TokenStats {
                binding_power: 3,
                nod_function: Some(parsing_functions::dereference),
                led_function: Some(parsing_functions::binary),
            },
        ),
        (
            TokenKind::Slash,
            TokenStats {
                binding_power: 3,
                nod_function: None,
                led_function: Some(parsing_functions::binary),
            },
        ),
        (
            TokenKind::Percent,
            TokenStats {
                binding_power: 3,
                nod_function: None,
                led_function: Some(parsing_functions::binary),
            },
        ),
        (
            TokenKind::Equals,
            TokenStats {
                binding_power: 4,
                nod_function: None,
                led_function: Some(parsing_functions::binary),
            },
        ),
        (
            TokenKind::NotEquals,
            TokenStats {
                binding_power: 4,
                nod_function: None,
                led_function: Some(parsing_functions::binary),
            },
        ),
        (
            TokenKind::Less,
            TokenStats {
                binding_power: 4,
                nod_function: None,
                led_function: Some(parsing_functions::binary),
            },
        ),
        (
            TokenKind::LessEquals,
            TokenStats {
                binding_power: 4,
                nod_function: None,
                led_function: Some(parsing_functions::binary),
            },
        ),
        (
            TokenKind::Greater,
            TokenStats {
                binding_power: 4,
                nod_function: None,
                led_function: Some(parsing_functions::binary),
            },
        ),
        (
            TokenKind::GreaterEquals,
            TokenStats {
                binding_power: 4,
                nod_function: None,
                led_function: Some(parsing_functions::binary),
            },
        ),
        (
            TokenKind::Or,
            TokenStats {
                binding_power: 1,
                nod_function: None,
                led_function: Some(parsing_functions::binary),
            },
        ),
        (
            TokenKind::And,
            TokenStats {
                binding_power: 1,
                nod_function: None,
                led_function: Some(parsing_functions::binary),
            },
        ),
        (
            TokenKind::Not,
            TokenStats {
                binding_power: 1,
                nod_function: Some(parsing_functions::prefix),
                led_function: Some(parsing_functions::binary),
            },
        ),
        (
            TokenKind::Number,
            TokenStats {
                binding_power: 0,
                nod_function: Some(parsing_functions::data_parsing::number),
                led_function: None,
            },
        ),
        (
            TokenKind::String,
            TokenStats {
                binding_power: 0,
                nod_function: Some(parsing_functions::data_parsing::string),
                led_function: None,
            },
        ),
        (
            TokenKind::Identifier,
            TokenStats {
                binding_power: 0,
                nod_function: Some(identifier_parsing::identifier),
                led_function: None,
            },
        ),
        (
            TokenKind::Return,
            TokenStats {
                binding_power: 0,
                nod_function: Some(parsing_functions::return_expr),
                led_function: None,
            },
        ),
        (
            TokenKind::CloseParen,
            TokenStats {
                binding_power: 0,
                nod_function: None,
                led_function: None,
            },
        ),
        (
            TokenKind::OpenParen,
            TokenStats {
                binding_power: 5,
                nod_function: Some(parsing_functions::open_paren),
                led_function: Some(parsing_functions::function_call),
            },
        ),
        (
            TokenKind::True,
            TokenStats {
                binding_power: 0,
                nod_function: Some(parsing_functions::data_parsing::boolean),
                led_function: None,
            },
        ),
        (
            TokenKind::False,
            TokenStats {
                binding_power: 0,
                nod_function: Some(parsing_functions::data_parsing::boolean),
                led_function: None,
            },
        ),
        (
            TokenKind::CloseCurly,
            TokenStats {
                binding_power: 0,
                nod_function: None,
                led_function: None,
            },
        ),
        (
            TokenKind::CompilerData,
            TokenStats {
                binding_power: 0,
                nod_function: Some(parsing_functions::compiler_data),
                led_function: None,
            },
        ),
        (
            TokenKind::Typedef,
            TokenStats {
                binding_power: 0,
                nod_function: Some(parsing_functions::type_def),
                led_function: None,
            },
        ),
        (
            TokenKind::PlusEquals,
            TokenStats {
                binding_power: 5,
                nod_function: None,
                led_function: Some(parsing_functions::assignment),
            },
        ),
        (
            TokenKind::MinusEquals,
            TokenStats {
                binding_power: 5,
                nod_function: None,
                led_function: Some(parsing_functions::assignment),
            },
        ),
        (
            TokenKind::StarEquals,
            TokenStats {
                binding_power: 5,
                nod_function: None,
                led_function: Some(parsing_functions::assignment),
            },
        ),
        (
            TokenKind::SlashEquals,
            TokenStats {
                binding_power: 5,
                nod_function: None,
                led_function: Some(parsing_functions::assignment),
            },
        ),
        (
            TokenKind::PlusPlus,
            TokenStats {
                binding_power: 5,
                nod_function: None,
                led_function: Some(parsing_functions::increment),
            },
        ),
        (
            TokenKind::MinusMinus,
            TokenStats {
                binding_power: 5,
                nod_function: None,
                led_function: Some(parsing_functions::decrement),
            },
        ),
        (
            TokenKind::Equals,
            TokenStats {
                binding_power: 5,
                nod_function: None,
                led_function: Some(parsing_functions::assignment),
            },
        ),
        (
            TokenKind::Reference,
            TokenStats {
                binding_power: 5,
                nod_function: Some(parsing_functions::access_reference),
                led_function: None,
            },
        ),
        (
            TokenKind::Static,
            TokenStats {
                binding_power: 0,
                nod_function: Some(parsing_functions::static_expr),
                led_function: None,
            },
        ),
        (
            TokenKind::OpenBracket,
            TokenStats {
                binding_power: 5,
                nod_function: None,
                led_function: Some(parsing_functions::array_access),
            },
        ),
        (
            TokenKind::CloseBracket,
            TokenStats {
                binding_power: 0,
                nod_function: None,
                led_function: None,
            },
        ),
        (
            TokenKind::OpenCurly,
            TokenStats {
                binding_power: 0,
                nod_function: Some(parsing_functions::statement_parsing::parse_open_curly),
                led_function: None,
            },
        ),
        (
            TokenKind::Comma,
            TokenStats {
                binding_power: 0,
                nod_function: None,
                led_function: None,
            },
        ),
        (
            TokenKind::While,
            TokenStats {
                binding_power: 0,
                nod_function: Some(parsing_functions::statement_parsing::parse_while),
                led_function: None,
            },
        ),
        (
            TokenKind::For,
            TokenStats {
                binding_power: 0,
                nod_function: Some(parsing_functions::statement_parsing::parse_for),
                led_function: None,
            },
        ),
        (
            TokenKind::If,
            TokenStats {
                binding_power: 0,
                nod_function: Some(parsing_functions::statement_parsing::parse_if),
                led_function: None,
            },
        ),
        (
            TokenKind::Dot,
            TokenStats {
                binding_power: 1,
                nod_function: None,
                led_function: Some(parsing_functions::member_expr),
            },
        ),
        (
            TokenKind::Unsigned,
            TokenStats {
                binding_power: 0,
                nod_function: Some(
                    parsing_functions::identifier_parsing::handle_function_or_variable_declaration,
                ),
                led_function: None,
            },
        ),
    ])
}
```

---

#### Bugs

If you find anything to improve in this project's code, please create an issue
describing it on the
[GitHub repository for this project](https://github.com/FilipRuman/RIP/issues).
For website-related issues, create an issue
[here](https://github.com/FilipRuman/pages/issues).

#### Support

All pages on this site are written by a human, and you can access everything for
free without ads. If you find this work valuable, please give a star to the
[GitHub repository for this project](https://github.com/FilipRuman/RIP).

<script src="https://giscus.app/client.js"
        data-repo="FilipRuman/RIP"
        data-repo-id="R_kgDOQNyZng"
        data-category="Announcements"
        data-category-id="DIC_kwDOQNyZns4C4CHN"
        data-mapping="specific"
        data-term="expression parsing functions"
        data-strict="0"
        data-reactions-enabled="1"
        data-emit-metadata="0"
        data-input-position="top"
        data-theme="preferred_color_scheme"
        data-lang="en"
        data-loading="lazy"
        crossorigin="anonymous"
        async>
</script>
