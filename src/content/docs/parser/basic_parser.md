---
title: 3. basic parser
description: parser
---

## What is a parser?

Parser turns 'Tokens' that it gets form code that we have already implemented, using '[Prat parsing](https://www.youtube.com/watch?v=0c8b7YfsBKs)' into expressions.

Expression will be a more complex piece of information that will be composed of other expressions 
:::note[Example]
``25 + 55 * 40`` will be turned into:
``Add { Number{25} , Multiply{ Number{55} , Number{40} } }``
:::

Than we will be able to turn those expressions easily into whatever we need- assembly, code in other language, etc. 

## Core definitions, it's a core part of a Prat parser. 

:::note[Example usage of binding power in code]
``` rust 
// pseudo code

fn expression(bp: i8) -> Expression {
    let nod_function = current_nod();
    let mut current_expression = nod_function(); 
    while current_bp() > bp{
        let led_function =  current_led();
        current_expression = led_function(current_expression, current_bp());
    }

    current_expression
}
``` 
Binding power says how often specific token will 'bind' with other tokens creating a 'tree' of expressions:
:::


### Function / expression types
#### Left denoted -> led
It's a function that is called when a token has a large enough binding power.
It takes a current expression - on the left, and current binding power.


#### Null denoted -> nod
It's the function that is called for the first expression, in a tree 'branch', it doesn't take any expressions as parameters .

## Example

### code to parse

``25 + 55 * 22;``

| Token kind | Binding power |
-------------|---------------|
| Number | 0|
| + | 2 |
| * | 3 |
| ; | -1|

###  steps to parse it
0. the 'expression()' function from previous example gets called for the first time with bp of 0.
1. the nod function of the number 25 gets called and we get: ``Expression::Number{value:25}``
2. the  Bp of Plus sing is 2, so we will call it's 'led' function with a argument of Expression::Number{value: 25}.

3. led function of the plus sign wants to get the expression on the right, so it calls the 'expression()' once again, with bp = 2
4. It finds the 55 number, but it gets binded with multiply sign, because it's bp is 3 and 3 > 2. so we call led function of multiply sign, with Expression::Number{value:}.
5. than this function wants to get the token on the right - number 22
6. The next token is ; which has a bp of -1, so it is ignored.

7. the led function of Add sign gets as the right side expression an output of: ``Multiply{ Number{55} , Number{40} }``.

### output

``Add { Number{25} , Multiply{ Number{55} , Number{40} } }``


## Removing useless tokens

We don't need all tokens, so let's filter them. Implement a function in main.rs that will filter out:

``TokenKind::Tab, TokenKind::Comment, TokenKind::WhiteSpace``


<details>
<summary> ⚠️ Implementation </summary>

``` rust
//main.rs

fn parse() -> Result<()> {

    const FILE_PATH: &str = "test_files/test.c";

    let mut tokens = tokenize_file(FILE_PATH)
        .with_context(|| format!("tokenization of a file at path: '{FILE_PATH}'"))?;


    black_list_filter_tokens_by_kind(
        &mut tokens,
        HashSet::from([
            TokenKind::Tab,
            TokenKind::Comment,
            TokenKind::NextLine,
            TokenKind::WhiteSpace,
        ]),
    );

    info!("Tokens: {tokens:#?}");

    Ok(())
}

fn black_list_filter_tokens_by_kind(tokens: &mut Vec<Token>, black_list: HashSet<TokenKind>) {
    tokens.retain(|token| !black_list.contains(&token.kind))
}
```


</details>

# Parser struct
We will implement struct named 'Parser' similarly to 'Lexer'.
## Implementation requirements:
### Properties
* current token index
* tokens
* valid data type names: parsing c requires us to know names of all valid data types eg. int,char,bool etc.
To do this we will have a 'HashSet' of all valid names. 
* file path: needed for debugging messages if you will be parsing multiple files.
* token_stats: ``HashMap<TokenKind, TokenStats>`` this is a core variable that we will be throughout. We will be implementing 'TokenStats' soon.

### Functions

* advance -> advances current token index.
* next -> next token without advancing.
* current -> current token.
* current_stats -> TokenStats of current token.
* expect -> returns Result whether current token has the same kind as expected. 

<details>
<summary> ⚠️ Implementation </summary>


``` rust
//parser/mod.rs

pub struct Parser {
    pub valid_data_type_names: HashSet<String>,
    pub tokens: Vec<Token>,
    pub i: usize,
    pub token_stats: HashMap<TokenKind, TokenStats>,
    pub file: String,
}
impl Parser {
    pub fn debug_data(&self) -> expression::DebugData {
        expression::DebugData {
            file: self.file.to_owned(),
            line: self.current().line,
        }
    }
    pub fn advance(&mut self) -> &Token {
        self.i += 1;
        &self.tokens[self.i - 1]
    }

    pub fn next(&self) -> &Token {
        &self.tokens[self.i + 1]
    }
    pub fn current(&self) -> &Token {
        &self.tokens[self.i]
    }

    pub fn current_stats(&self) -> Result<&TokenStats> {
        self.token_stats.get(&self.current().kind).with_context(|| {
            format!(
                "there were no stats data for token of kind: '{:?}'",
                self.current().kind
            )
        })
    }

    #[must_use]
    pub fn expect(&mut self, expected: TokenKind) -> Result<Token> {
        match self.advance().to_owned() {
            val => {
                if val.kind == expected {
                    return Ok(val);
                } else {
                    bail!("expected to find token of kind: '{expected:?}', found: '{val:?}'");
                }
            }
        }
    }
}
```

</details>

Now let's implement 'Expression' struct. We will have to add a lot of values for it, but we will add them gradually when implementing a function to parse this type of enum.  

Some of the expressions have other expressions inside them. When doing this we need to wrap them in [Box<T>](https://doc.rust-lang.org/std/boxed/struct.Box.html). 
Box is basically a pointer to a heap allocated memory. We need to do this so the compiler can calculate size of the data structure. otherwise it would encounter a infinite recursion.
But with the pointer the size is always the same. 
``` rust
//parser/expression.rs

#[derive(Debug, Clone)]
pub struct DebugData {
    pub line: u16,
    pub file: String,
}

#[derive(Debug, Clone)]
pub enum Expression {
    Dereference {
        value: Box<Expression>,
        debug_data: DebugData,
    },
    Number(u32, DebugData),
    Binary {
        left: Box<Expression>,
        operator: Token,
        right: Box<Expression>,
        debug_data: DebugData,
    },
    Prefix {
        prefix: Token,
        value: Box<Expression>,
        debug_data: DebugData,
    },
    Grouping {
        value: Box<Expression>,
        debug_data: DebugData,
    },
    ...
}
```

For now put there those simple ones.

## Token stats

Token stats will allow us to get correct expression parsing function for certain token.
Every stat will have binding power, nod, and led functions needed for prat parsing.


:::note

The binding power was chosen so that eg:
* order of math operations is right
* [ is always a led function
* *is both dereference and multiply sign, depending on if you use it's led or nod function.

:::

Your task will be to fill some of the nod and led functions with functions to parse right expressions.  
But more on that later.

For now I've filled out some basic functions that we will be implementing in a second.

```rust
//parser/token_stats.rs
use std::collections::HashMap;

use crate::{
    lexer::token::TokenKind,
    parser::{
        Parser,
        expression::Expression,
        parsing_functions::{self, grouping, identifier_parsing},
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
                led_function: None,
            },
        ),
        (
            TokenKind::BitwiseShiftRight,
            TokenStats {
                binding_power: 2,
                nod_function: None,
                led_function: None,
            },
        ),
        (
            TokenKind::Plus,
            TokenStats {
                binding_power: 2,
                nod_function: None,
                led_function: None,
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
                nod_function: None,
                led_function: None,
            },
        ),
        (
            TokenKind::Identifier,
            TokenStats {
                binding_power: 0,
                nod_function: None,
                led_function: None,
            },
        ),
        (
            TokenKind::Return,
            TokenStats {
                binding_power: 0,
                nod_function: None,
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
                led_function: None,
            },
        ),
        (
            TokenKind::True,
            TokenStats {
                binding_power: 0,
                nod_function: None,
                led_function: None,
            },
        ),
        (
            TokenKind::False,
            TokenStats {
                binding_power: 0,
                nod_function: None,
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
                nod_function: None,
                led_function: None,
            },
        ),
        (
            TokenKind::Typedef,
            TokenStats {
                binding_power: 0,
                nod_function: None,
                led_function: None,
            },
        ),
        (
            TokenKind::PlusEquals,
            TokenStats {
                binding_power: 5,
                nod_function: None,
                led_function: None,
            },
        ),
        (
            TokenKind::MinusEquals,
            TokenStats {
                binding_power: 5,
                nod_function: None,
                led_function: None,
            },
        ),
        (
            TokenKind::StarEquals,
            TokenStats {
                binding_power: 5,
                nod_function: None,
                led_function: None,
            },
        ),
        (
            TokenKind::SlashEquals,
            TokenStats {
                binding_power: 5,
                nod_function: None,
                led_function: None,
            },
        ),
        (
            TokenKind::PlusPlus,
            TokenStats {
                binding_power: 5,
                nod_function: None,
                led_function: None,
            },
        ),
        (
            TokenKind::MinusMinus,
            TokenStats {
                binding_power: 5,
                nod_function: None,
                led_function: None,
            },
        ),
        (
            TokenKind::Equals,
            TokenStats {
                binding_power: 5,
                nod_function: None,
                led_function: None,
            },
        ),
        (
            TokenKind::Reference,
            TokenStats {
                binding_power: 5,
                nod_function: None,
                led_function: None,
            },
        ),
        (
            TokenKind::Static,
            TokenStats {
                binding_power: 0,
                nod_function: None,
                led_function: None,
            },
        ),
        (
            TokenKind::OpenBracket,
            TokenStats {
                binding_power: 5,
                nod_function: None,
                led_function: None,
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
                nod_function: None,
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
                nod_function: None,
                led_function: None,
            },
        ),
        (
            TokenKind::For,
            TokenStats {
                binding_power: 0,
                nod_function: None,
                led_function: None,
            },
        ),
        (
            TokenKind::If,
            TokenStats {
                binding_power: 0,
                nod_function: None,
                led_function: None,
            },
        ),
        (
            TokenKind::Dot,
            TokenStats {
                binding_power: 1,
                nod_function: None,
                led_function: None,
            },
        ),
        // Colon,
        // Question,
        // Reference,
        // Other,
        // Constant,
    ])
}

```
## implementing the 'expression' function

It's function is described by this pseudo code form the beginning of this page.
``` rust 
// pseudo code

fn expression(bp: i8) -> Expression {
    let nod_function = current_nod();
    let mut current_expression = nod_function(); 
    while current_bp() > bp{
        let led_function =  current_led();
        current_expression = led_function(current_expression, current_bp());
    }

    current_expression
}
``` 


:::caution
Remember about debugging information.
This is the core function that we will be using thru out the parser. 
If we add some nice debugging information in here, it will make our life a lot simpler in the future, while debugging. 
:::


<details>
<summary> ⚠️ Implementation </summary>


``` rust
//parser/parsing_functions/mod.rs
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
```

</details>


Now that we have implemented it we can write functions that will use this code.

## implementing basic parsing functions


:::caution
Remember to put references to implemented functions at the appropriate token stats in the nod/led function option.
If you don't know where to put it or if you have missed one token stat, don't worry, you can always look at the code at the end of the '4. expression parsing functions' page.
:::
### parsing_functions::prefix


It's just a nod function for '-'. (and maybe +)
It is used to reverse sing of it's value: ``5 + - 5 = 0 ``
it will be a nod function and will be just advancing parser for prefix token kind, and getting it's value using the 'expression()'

<details>
<summary> ⚠️ implementation </summary>


``` rust
//parser/parsing_functions/mod.rs
pub fn prefix(parser: &mut Parser) -> Result<Expression> {
    let prefix = parser.advance().to_owned();
    let value = expression(parser, 0).context("prefix")?;

    return Ok(Expression::Prefix {
        prefix,
        value: Box::new(value),
        debug_data: parser.debug_data(),
    });
}
```

</details>


### parsing_functions::open_paren

:::tip
Always use ``parser::expected(TokenKind::SMTH)?;`` when moving past a known token eg.
``` rust
// pseudo code
fn open_paren(parser) -> Result<...>{
parser.expect(TokenKind::OpenParen)?;
... // parse value
parser.expect(TokenKind::CloseParen)?;
// output expression
}
```

:::

It's just a value wrapped in (). eg. 5 * <u>(25 + 1)</u>
It will be getting it's value using the 'expression()'

<details>
<summary> ⚠️ implementation </summary>


``` rust
//parser/parsing_functions/mod.rs
pub fn open_paren(parser: &mut Parser) -> Result<Expression> {
    parser.expect(TokenKind::OpenParen)?;
    let value = Box::new(expression(parser, 0)?);
    parser.expect(TokenKind::CloseParen)?;

    Ok(Expression::Grouping {
        value,
        debug_data: parser.debug_data(),
    })
}
```

</details>

### data_parsing::number

just an expression with parsed number.
to parse number we could just use ``str::parse::<u32>()``, but this doesn't work with hex, bin and oct values.
so we need to implement a function that will use [s.from_str_radix()](https://doc.rust-lang.org/std/primitive.u32.html) for it.

<details>
<summary> ⚠️ implementation </summary>

``` rust
//parser/parsing_functions/data_parsing.rs
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
```

</details>

### parsing_functions::binary

The parsing function will be of the led type.
binary expression will be used for most of the math operations so:
`+ - * / % << >> >= > < <= `

It is really simple, it has to store: expression on the left and right and operator. 
Make it work like in the [example](#example) from the beginning

<details>
<summary> ⚠️ implementation </summary>

``` rust 
//parser/parsing_functions/mod.rs

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
```

</details>


## Using implemented code

### Parse Function

Now we need to use all of the code that we have implemented on this page.
Create a 'parse' function in ``parser/mod.rs``:

``` rust
pub fn parse(tokens: Vec<Token>, file: String) -> Result<Vec<Expression>>
```
1. initialize 'Parser', for the `valid_data_type_names` use standard c data types like: char, int, long, etc.
2. do until you encounter  `TokenKind::EndOfFile`
    * use parsing_functions::expression(&mut parser, 0) and store outputs inside a vector.
    * if you encounter a semicolon just continue the loop
3. output all parsed expressions

<details>
<summary> ⚠️ implementation </summary>

``` rs
//parser/mod.rs
pub fn parse(tokens: Vec<Token>, file: String) -> Result<Vec<Expression>> {
    let mut parser = Parser {
        valid_data_type_names: HashSet::from([
            "bool".to_string(),
            "char".to_string(),
            "short".to_string(),
            "int".to_string(),
            "long".to_string(),
            "float".to_string(),
            "double".to_string(),
        ]),
        i: 0,
        tokens: tokens,
        token_stats: token_stats(),
        file,
    };

    let mut output = vec![];
    while parser.current().kind != TokenKind::EndOfFile {
        if parser.current().kind == TokenKind::SemiColon {
            parser.advance();
            continue;
        }
        output.push(
            parsing_functions::expression(&mut parser, 0).with_context(|| {
                format!(
                    "debug data: {:?},\n parsed expressions:{:#?}",
                    parser.debug_data(),
                    output
                )
            })?,
        );
    }
    Ok(output)
}
```
You might need to import few things to make this work...
</details>

### Running code

Temporally replace your test.c file with:

```c 
15 % ((25 / -66) * (*81 - 25)) 
```

And when you run the project with `cargo run` you should see beauty full output of parsed expression in the console.
Please make sure that the expressions were parsed int the right way
