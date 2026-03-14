---
title: 3. basic parser
description: parser
---

## Removing Useless Tokens

We don't need all tokens, so let's filter some of them out. Implement a function
in main.rs that will filter
out:`TokenKind::Tab, TokenKind::Comment, TokenKind::WhiteSpace`.

<details>
<summary> ⚠️ Implementation </summary>

```rust
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

## What Is a Parser?

A Parser turns 'Tokens' that it gets from a lexer into expressions, using
[Pratt parsing](https://www.youtube.com/watch?v=0c8b7YfsBKs).

An expression is a more complex piece of information that is composed of other
expressions

:::note[Example]

`25 + 55 * 40` will be turned into:
`Add { Number{25} , Multiply{ Number{55} , Number{40} } }`

:::

Expression can then be turned into other types of output. For example: assembly,
code in other language.

## Core Definitions

### Binding Power- BP

Binding power says whether a specific token will 'bind' with other tokens:

:::note[Example binding power usage in code]

```rust
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

:::

### Function / Expression Types

#### Left Denoted -> Led

It's the function that is called when a token has a large enough binding power.
It takes a current (left) expression, and current binding power.

#### Null Denoted -> Nod

It's the function that is called for the first expression, in a tree 'branch',
it doesn't take any expressions as parameters.

## Example

### Code to Parse

`25 + 55 * 22;`

| Token kind | Binding power |
| ---------- | ------------- |
| Number     | 0             |
| +          | 2             |
| *          | 3             |
| ;          | -1            |

### Steps Needed to Parse It

0. 'expression()' function from the previous example gets called for the first
   time, it has BP of 0. Reads a number token - 25.
1. Nod function of the number 25 gets called, and we get:
   `Expression::Number{value:25}`
2. BP of the plus sign is 2, so we will call its 'led' function with an argument
   of Expression::Number{value: 25}.
3. Led function of the plus sign wants to get the expression on the right, so it
   calls the 'expression()' once again, with BP = 2
4. It finds the number '55', but it gets bound to the multiplication sign.This
   happens, because its BP is 3, and 3 > 2. Next we will call led function of
   multiply sign, with Expression::Number{55}.
5. This function reads the next token - number 22
6. The next token is a ';', which has a BP of -1, so it is ignored.
7. Right side expression, for the plus-sign's led function, will be:
   `Multiply{ Number{55} , Number{40} }`.

### Output

`Add { Number{25} , Multiply{ Number{55} , Number{40} } }`

## Parser Struct

We will implement struct named 'Parser' similarly to 'Lexer'. It will be calling
a function similar to the expression one from the example.

### Properties

- Current token index
- Tokens
- Valid datatype names: parsing c requires us to know names of all valid data
  types. For example: int,char,bool, struct, someSturctNameDefinedInCode.\
  To do this we will have a 'HashSet' of all valid names.
- File path: needed for debugging messages if you are parsing multiple files.
- Token_stats: `HashMap<TokenKind, TokenStats>` this is a core variable that we
  will use throughout. We will be implementing 'TokenStats' soon.

### Functions

- Advance -> advances current token index.
- Next -> next token without advancing.
- Current -> current token.
- Current_stats -> 'TokenStats' for the current token.
- Expect -> returns a 'result' indicating whether the current token has the same
  kind as expected.

<details>
<summary> ⚠️ Implementation </summary>

```rust
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

## Expression

Now let's implement 'Expression' enum. We will have to add a lot of types for
it, but we will add them gradually when implementing a function to parse this
type of enum.

Some of the expressions have other expressions inside them. When doing this we
need to wrap them in a
[Box<T>](https://doc.rust-lang.org/std/boxed/struct.Box.html). Box is basically
a pointer to a heap allocated memory. We need to do this so the compiler can
calculate size of the data structure. Otherwise, it would encounter an infinite
recursion. But with the pointer, size of the struct is always the same.

```rust
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

For now, add only those simple ones.

## Token Stats

Token stats will allow us to, get the correct expression parsing function, for
certain token type. Every stat will have: binding power, nod, and a led
functions.

:::note

The binding power was chosen so that:

- Order of math operations is right
- [ is always a led function
- '*' is both dereference, and multiply sign, depending on if you use its led or
  nod function.

:::

Your task will be filling the led, and nod functions so that they are parsed
right. But more on that later.

For now I've filled out some basic functions that we will be implementing in a
second.

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

## Implementing the 'Expression' Function

Its described by this pseudocode, form the beginning of this page.

```rust
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

Your job is to make it work with the functions, that we have already
implemented.

:::caution

Remember about debugging information. This is a core function that we will be
using throughout the parser. If we add some nice debugging information in here,
it will make our life a lot simpler in the future.

:::

<details>
<summary> ⚠️ Implementation </summary>

```rust
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

Now that we have implemented it, we can write functions that will use this code.

## Implementing Basic Parsing Functions

:::caution

Remember to put references to implemented functions, in the nod/led function,at
the appropriate token stats. If you don't know where to put it or if you have
missed one token stat, don't worry, you can always look at the code at the end
of the "4. expression parsing functions" page.

:::

### Parsing_Functions::Prefix

It's just a nod function for '-'. (maybe also the '+'). It is used to reverse
the sign of its value: `5 + -5 = 0`. It will be a nod function, that will be
just advancing the parser. It will get its value using the 'expression()'

<details>
<summary> ⚠️ implementation </summary>

```rust
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

### Parsing_Functions::Open_Paren

:::tip

Always use `parser::expected(TokenKind::SMTH)?;` when moving past a known token.

Example:

```rust
// pseudo code
fn open_paren(parser) -> Result<...>{
parser.expect(TokenKind::OpenParen)?;
... // parse value
parser.expect(TokenKind::CloseParen)?;
// output expression
}
```

:::

It's just an expression wrapped in parentheses e.g. `5 * <u>(25 + 1)</u>`.

It will be getting value using the 'expression()'.

<details>
<summary> ⚠️ implementation </summary>

```rust
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

### Data_Parsing::Number

Just an expression with parsed number. To parse number we could just use
`str::parse::<u32>()`, but this doesn't work with hex, bin, and oct values. So
we need to implement a function that uses
[s.from_str_radix()](https://doc.rust-lang.org/std/primitive.u32.html) for this.

<details>
<summary> ⚠️ implementation </summary>

```rust
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

### Parsing_Functions::Binary

Binary expression will be used for most of the math operations:
`+ - * / % << >> >= > < <=`

It is really simple, it has to store: expression on the left, and right, and
operator. Make it work like the [example](#example) from the beginning

<details>
<summary> ⚠️ implementation </summary>

```rust
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

## Using Implemented Code

### Parse Function

Now we need to use all the, code that we have implemented on this page. Create a
'parse' function in `parser/mod.rs`:

```rust
pub fn parse(tokens: Vec<Token>, file: String) -> Result<Vec<Expression>>
```

1. Initialize 'Parser', for the `valid_data_type_names`. Use standard c data
   types like: char, int, long, etc.
2. Do this until you encounter `TokenKind::EndOfFile`:
   - Use 'parsing_functions::expression(&mut parser, 0)', and store outputs
     inside of a vector.
   - If you encounter a semicolon just continue the loop
3. output all parsed expressions

<details>
<summary> ⚠️ implementation </summary>

```rs
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

You might need to import a few things to make this work...

</details>

### Running Code

Temporarily replace your test.c file with a simpler test code like this:

```c
15 % ((25 / -66) * (*81 - 25))
```

Run the project with `cargo run`. You should see beautiful output, of parsed
expression in the console. Please make sure that expressions were parsed in the
right way.

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
