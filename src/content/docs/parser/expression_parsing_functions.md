---
title: 5. expression parsing functions 
description: parser
---
Now we we will need to implement functions to parse all of the other expressions that we need.
And we need add those expressions to our expression enum, and also update token stats.

## Implementation

###  Assignment
Will be called when parsing `= += -= *= /=` tokens.
It will be used when eg.
```rust
a += 52
```
It needs to know value, operator and target to assign. 

<details>
<summary> ⚠️ Implementation </summary>

``` rs
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

</details>


### Increment && Decrement 
It's basically an assignment but without a value

<details>
<summary> ⚠️ Implementation </summary>

``` rs
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


### Type conversion 

We have already implemented a nod function for a '(' token - grouping expression, eg. `2 * (52 - 22)`
But in c to convert type of a variable you do: `bool z = (bool)1`
So to differentiate this we will check if inside of the parentheses there is an identifier, and if it's value is inside the parser::valid_data_type_names
The type conversion itself has to know it's type and value it converts - next expression 


<details>
<summary> ⚠️ Implementation </summary>

``` rs
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
You dereference a pointer by putting a star before a name of a variable. dereferencing is a fancy way of saying 'access a value inside a pointer'. 

<details>
<summary> ⚠️ Implementation </summary>

``` rs
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


### Access reference 

``` c
int a = 25;
int *ptr = &a; 
```

basically a reversed dereference
<details>
<summary> ⚠️ Implementation </summary>

``` rs
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
``` c 
 static int count = 0;
```

In c static keyword tells the compiler to store this variable on [.data/.bss](https://www.geeksforgeeks.org/c/memory-layout-of-c-program/) instead of the [stack](https://os.phil-opp.com/heap-allocation/#local-and-static-variables).
![memory layout c](https://media.geeksforgeeks.org/wp-content/uploads/20250122155858092295/Memory-Layout-of-C-Program.webp)
It allows you to make value of this variable to persist through the life time of the program, without using heap.


<details>
<summary> ⚠️ Implementation </summary>

``` rs
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
``` c 
 some.thing.to.access = 2;
```

It needs to know the thing it accesses - left and the value - right 


<details>
<summary> ⚠️ Implementation </summary>

``` rs
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

``` rs
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

``` rs
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


### CompilerData

``` c
#include "this part also should be included"
```

This is all you need

<details>
<summary> ⚠️ Implementation </summary>

``` rs
//parser/parsing_functions/mod.rs
pub fn compiler_data(parser: &mut Parser) -> Result<Expression> {
    Ok(Expression::CompilerData(
        parser.advance().value.to_owned(),
        parser.debug_data(),
    ))
}
```

</details>

### Open curly

In C there are many things that could be wrapped in curly braces, thank fully most of them will be parsed by functions called when encountering a keyword beforehand eg. ``if (...) {if statement contents}`` or ``int test(){function contents}``.
This allows us to only have to think about 2 cases.
* creating a new 'scope' 
``` c
int test_fn(){
    {
        int var_name = 25;
    }
    int var_name = 55;
}
```
* initializing a struct
``` c
myStructure s1 = {13, 'B', "Some text"};
```

We will need to first check with which case we are dealing and than call appropriate function.

####  Scope block


Scope block will just consist of an array of expressions that represent lines inside of it.  
We will be just parsing expressions until we encounter a right curly brace.

#### Struct initialization 

To initialize a struct we just need to know values inside the initialization that we will be assigning.

This may seem hard at first, but actually is pretty easy, coma has a low binding power so parsing expressions, with binding power of 0, in a loop and moving past comas  will give us needed values.  


<details>
<summary> ⚠️ Implementation </summary>

``` rs
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

In rust for example you write let when you declare a variable or fn when you declare a function.
In c compiler must 'guess' your intention.
To accomplish this we will use the ``parser::valid_data_type_names``.

If the value of a token isn't inside of the ``parser::valid_data_type_names`` we will just output an identifier expression with it's value.

We need to use ``types::parse()`` to get data type that we will be using for next expressions.
Than we need to check if the next token is a identifier:
    a. it is: we take it's value as a name for variable/function.
    b. it isn't: just return a 'DataTypeAccess' expression with the data type that we parsed before. 

Than we need to check for array declaration because in c you put square brackets after variable name: ``int array[][] = ...; ``.
So we use ``types::wrap_data_type_in_an_array`` for this.
 

Next we need to check weather we are dealing with a function or variable declaration. 
We can do it by checking if the next token is a '('.

For variable declaration we know everything that we need so we will just return expression with variable name and type.

Now we need to deal with function declaration:
``` c
int* func(int param,char* text){...}
---------
//this is the part that we have already parsed
```
#### Parsing function parameters 
we will do the same  as during parsing the struct declaration, but than we need to read value of the next character as a name.
#### Parsing function contents
this is the same as when parsing a scope block.


Than we need to just return a function expression with: name, data type, parameters, and contents.

<details>
<summary> ⚠️ Implementation </summary>

``` rs
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


### If / else 
``` c
if(condition && !other_thing){
contents
}else if(a>0){
contents
}else{ 
contents
}
```

It is possible to chain multiple else if-s and every one has it's contents and conditions.  
Also we need to remember to expect all of the parentheses and curly brackets and keywords like if and else.
To parse conditions we will just use parsing_functions::expression with binding power of 0. 
It should nicely parse all of the conditions at once and leave parentheses thanks to the binding power of all of the tokens.

<details>
<summary> ⚠️ Implementation </summary>

``` rs
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

``` c 
while (i >25){
    i/2;
}
```
Parsing while loop isn't different from parsing if-s in almost any way.

<details>
<summary> ⚠️ Implementation </summary>

``` rs
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

just return expression with debug data inside and expect token of kind Bread LOL.
<details>
<summary> ⚠️ Implementation </summary>

``` rs
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



<details>
<summary> ⚠️ Implementation </summary>

``` rs
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


<details>
<summary> ⚠️ Implementation </summary>

``` rs
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

### array access
TODO: Think about changing name to array access

<details>
<summary> ⚠️ Implementation </summary>

``` rs
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

### FunctionCall 


<details>
<summary> ⚠️ Implementation </summary>

``` rs
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


<details>
<summary> ⚠️ Implementation </summary>

``` rs
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

## Adding token stats

## At the end:

<details>
<summary> ⚠️ Implementation </summary>

``` rust
//parser/expression.rs
TODO: COPY IT  ONCE Again
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
```


``` rust
//parser/parsing_functions/identifier_parsing.rs
TODO: COPY IT  ONCE Again

```


``` rust
//parser/parsing_functions/mod.rs
TODO: COPY IT  ONCE Again

```


``` rust
//parser/parsing_functions/statement_parsing.rs
TODO: COPY IT  ONCE Again
```

</details>

and our token stats should look like this:

```rs
//parser/token_stats.rs
TODO: COPY IT  ONCE Again
```
