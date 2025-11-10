---
title: 3. basic parser
description: parser
---

# What  our goal with this parser?

We will be turning 'Tokens' that we get form code that we have already implemented, using '[Prat parsing](https://www.youtube.com/watch?v=0c8b7YfsBKs)'
Expression will be a more complex piece of information that will be composed of other expressions 

:::note[Example]
``25 + 55 * 40`` will be turned into:
``Add { Number{25} , Multiply{ Number{55} , Number{40} } }``
:::

Than we will be able to turn those expressions easily into whatever we need- assembly, code in other language, etc. 

## Removing useless tokens

We don't need all tokens, so let's filter them. Implement a function in main.rs that will filter out:

``TokenKind::Tab, TokenKind::Comment, TokenKind::WhiteSpace``


<details>
<summary> ⚠️ Implementation </summary>

``` rust
main.rs

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

## Parser struct
We will implement struct named 'Parser' similarly to 'Lexer'.
### Implementation requirements:
#### Properties
* current token index
* tokens
* valid data type names: parsing c requires us to know names of all valid data types eg. int,char,bool etc.
To do this we will have a 'HashSet' of all valid names. 
* file path: needed for debugging messages if you will be parsing multiple files.
* token_stats: ``HashMap<TokenKind, TokenStats>`` this is a core variable that we will be throughout. We will be implementing 'TokenStats' soon.

#### Functions

* advance -> advances current token index.
* next -> next token without advancing.
* current -> current token.
* current_stats -> TokenStats of current token.
* expect -> returns Result whether current token has the same kind as expected. 

<details>
<summary> ⚠️ Implementation </summary>


``` rust
parser/mod.rs

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


``` rust
parser/expression.rs

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


```rust
parser/token_stats.rs
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
                nod_function: Some(parsing_functions::grouping),
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




## Testing

```c 
15 % ((25 / -66) * (*81 - 25)) 

```

