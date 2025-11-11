---
title: 2. lexer
description: lexer
---

#### What is a lexer?
* Lexer is a simple program that converts arbitrary text that it reads from a file, into simple tokens.
* tokens will simplify the process of parsing, more on that later.

### code:

Let's start by creating parse function that will load our file and use lexer to convert it into tokens.

<details>
<summary> ⚠️ Code </summary>

```rust
//main.rs

mod lexer;
use std::{
    collections::HashSet,
    fs::{self},
};

fn main() {
    colog::init();
    info!("init colog");
    if let Err(err) = parse() {
        error!("{err:?}")
    }
}

fn parse() -> Result<()> {
    const FILE_PATH: &str = "test_files/test.c";

    let mut tokens = tokenize_file(FILE_PATH)
        .with_context(|| format!("tokenization of a file at path: '{FILE_PATH}'"))?;

    info!("Tokens: {tokens:#?}");

    Ok(())
}

fn tokenize_file(path: &str) -> Result<Vec<Token>> {
    let chars = fs::read_to_string(path)?.chars().collect::<Vec<char>>();
    lexer::tokenize(chars)
}
```


</details>




mod.rs files allow you to link other rust files in that directory
* we need to have a lexer struct that will handle all basic operations that we need.

## Lexer struct
#### Variables 
* contents of file as characters
* current character index.
#### functions
* reading current char
* reading next char
* advancing current character index
* expect function takes expected character and if current character is not the same it will return error result

<details>
<summary> ⚠️ Implementation </summary>


```rust 
//lexer/mod.rs

pub mod token;

use anyhow::{Context, Result, bail};
use log::warn;

use crate::lexer::{
    patterns::{TokenPattern, setup_token_patters},
    token::{Token, TokenKind},
};

pub struct Lexer {
    contents: Vec<char>,
    pub i: usize,
}

impl Lexer {
    pub fn next(&self) -> char {
        match self.contents.get(self.i + 1) {
            Some(val) => *val,
            None => '\n',
        }
    }
    pub fn current(&self) -> char {
        match self.contents.get(self.i) {
            Some(val) => *val,
            None => '\n',
        }
    }
    #[must_use]
    pub fn expect(&mut self, expected: char) -> Result<char> {
        let current = self.advance();
        if current != expected {
            bail!("Expected: '{expected}', found: '{current}'")
        }
        Ok(current)
    }
    pub fn advance(&mut self) -> char {
        self.i += 1;
        match self.contents.get(self.i - 1) {
            Some(val) => *val,
            None => '\n',
        }
    }
}
```


</details>

Now let's create a 'tokenize' function that will initialize the lexer with contents of a file and output tokens after running some code that we will implement later  .

<details>
<summary> ⚠️ Implementation </summary>

``` rust
//lexer/mod.rs


pub fn tokenize(text: Vec<char>) -> Result<Vec<Token>> {
        let mut lexer = Lexer {
        contents: text,
        i: 0,
    };

    let mut output: Vec<Token> = vec![];
    let mut current_line: u16 = 0;

    Ok(output)
}
```

</details>


Now we need to create special struct that will hold our tokens
It has to hold:
* value :String
* kind : TokenKind
* line: u16

TokenKind will be a simple enum that will be really helpful in the future. 
It will contain all token types that we need, like: GreaterEquals, Not, Number, String, True, etc...

**For list of all token kinds look at the code down bellow**

``` rust
//lexer/token.rs
// allows this struct to be easily printed with {:?}. + can use .clone() 
#[derive(Debug, Clone)]
pub struct Token {
    pub value: String,
    pub kind: TokenKind,
    pub line: u16, // needed for debugging
}

//  PartialEq,Eq - needed for comparison eg. if x == TokenKind::Tab
// Hash - needed for later usage with hashset
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum TokenKind {
    Typedef,
    Tab,
    Comment,
    CompilerData,

    WhiteSpace,
    EndOfFile,
    NextLine,
    OpenParen,
    CloseParen,
    OpenBracket,
    CloseBracket,
    OpenCurly,
    CloseCurly,
    Comma,
    Dot,
    SemiColon,
    Colon,
    Arrow,
    Question,

    Plus,
    Minus,
    Star,
    Slash,
    Percent,

    PlusEquals,
    MinusEquals,
    StarEquals,
    SlashEquals,

    PlusPlus,
    MinusMinus,

    Equals,
    NotEquals,
    Less,
    LessEquals,
    Greater,
    GreaterEquals,

    Not,
    And,
    Or,

    BitwiseShiftLeft,
    BitwiseShiftRight,

    Assignment,
    Reference,

    Number,
    String,
    True,
    False,

    Identifier,
    Static,
    Return,
    If,
    Else,
    While,
    For,
    Enum,
    Struct,
    Break,
    Other,
    Constant,
}
```


## Converting set of characters into tokens

The plan is to do this in loop:
1. source current and next character
2. find right function to use on them
3. call this function
4. collect token from function output
5. repeat

This allows us to worry about implementing functions to actually convert characters into tokens later.

### Finding right function to use on set of characters
Most of the time we can figure out right function by just looking at 2 characters.

#### EXAMPLE

|1'st|2'nd| Output token kind|
|----|----|-----------------|
| '+'| '=' |PlusEquals| 
| '+'  | ' '  | Plus |
| '-'  | ' '  | Minus|
| '0..9'  | ' '  | Number |
| '/'  | '/'  | Comment |
| '&'  | '&'  | And |


### Implementation
We will be using 'HashMap'-s that will do all of the searching for us.
So let's store them inside 'Lexer' struct.

We need:
* **token_patterns** -> takes 2 characters and returns 'TokenPattern' enum that we will implement later
* **keywords** -> takes string and returns 'TokenKind'. this will be needed for more complex tokens.
##### EXAMPLE: else, break, struct, int, true

* **valid_identifier_token_chars** -> 'HashSet' of valid characters for identifier tokens. 
* **valid_number_token_char** -> 'HashSet' of valid characters for number tokens.

<details>
<summary> ⚠️ Implementation </summary>

``` rust
//lexer/mod.rs

pub struct Lexer {
    contents: Vec<char>,
    pub i: usize,
    token_patterns: HashMap<(char, char), TokenPattern>,
    keywords: HashMap<&'static str, TokenKind>,
    pub valid_identifier_token_chars: HashSet<char>,
    pub valid_number_token_chars: HashSet<char>,
}
```

</details>

### Token patterns
'TokenPattern' will be a enum that will allow us to, both use 'complex' functions or just simply  return needed token kind.
We also need to initialize 'token_patterns' inside the 'Lexer' struct this should be fairly easy.
But there are some some of the more complex patterns like: string, identifier, number.
They can start with more than 1 character so we would have to insert right pattern for each one of them.

So to improve it we also need 'TokenPatternInitialization' struct:  
``` rust
//lexer/patterns.rs

use crate::lexer::{
    Lexer,
    token::{Token, TokenKind},
};

type TokenizationFunc = fn(u16, &mut Lexer) -> Result<Token>;
#[derive(Clone, Copy)]
pub enum TokenPattern {
    Fast {
        kind: TokenKind,
        use_second_char: bool,
    },
    Long(TokenizationFunc),
}

struct TokenPatternInitialization {
    start_chars: Vec<char>,
    second_char: char,
    pattern: TokenPattern,
}
```

### Initializing Token Patterns

Create a 'patterns' function.
It will return pattern initializations.

``` rust
//lexer/patterns.rs

fn patterns() -> Vec<TokenPatternInitialization> {
    vec![
        TokenPatternInitialization::new(
            vec!['?'],
            ' ',
            TokenPattern::Fast {
                kind: TokenKind::Question,
                use_second_char: false,
            },
        ),
        TokenPatternInitialization::new(
            vec!['+'],
            '=',
            TokenPattern::Fast {
                kind: TokenKind::PlusEquals,
                use_second_char: true,
            },
        ),
        TokenPatternInitialization::new(
            vec!['+'],
            '+',
            TokenPattern::Fast {
                kind: TokenKind::PlusPlus,
                use_second_char: true,
            },
        ),
        TokenPatternInitialization::new(
            vec!['+'],
            ' ',
            TokenPattern::Fast {
                kind: TokenKind::Plus,
                use_second_char: false,
            },
        ),
        ...

    ]
}
```

You might want to implement rest of it by yourself.
But for now leave : comments, strings, numbers, identifiers.
We will handle them with more complex functions.  
But if you don't want to write rest of tokens by hand, you can just copy code that will be written later. 


### Handling more complex patterns
We will be creating functions of type that we used in 'TokenPattern'  
```rust 
type TokenizationFunc = fn(u16, &mut Lexer) -> Result<Token>;
```
Takes current line, mutable reference to lexer and returns result of token

#### Number

It will collect all characters until it encounter's one that is not inside 'Lexer::valid_number_token_chars'

<details>
<summary> ⚠️ Implementation </summary>

``` rust
//lexer/tokenization_functions.rs

use crate::lexer::{
    Lexer,
    token::{Token, TokenKind},
};

use anyhow::Result;
pub fn handle_number(line: u16, lexer: &mut Lexer) -> Result<Token> {
    let mut value = String::new();
    while lexer.valid_number_token_chars.contains(&lexer.current()) {
        value += &lexer.advance().to_string();
    }

    Ok(Token {
        value,
        kind: TokenKind::Number,
        line,
    })
}
```

</details>

#### String
* expects to find '"' at the beginning
* collects all characters until it hits '"' 

<details>
<summary> ⚠️ Implementation </summary>


``` rust
//lexer/tokenization_functions.rs

pub fn handle_string(line: u16, lexer: &mut Lexer) -> Result<Token> {
    lexer.expect('"')?;

    let mut value = String::new();
    while lexer.current() != '"' {
        value += &lexer.advance().to_string();
    }
    lexer.expect('"')?;

    Ok(Token {
        value,
        kind: TokenKind::String,
        line,
    })
}
```

</details>


#### compiler_data
* expects to find '#' at the beginning
* collects all characters until it hits next line - '\n' 
<details>
<summary> ⚠️ Implementation </summary>

``` rust
//lexer/tokenization_functions.rs

pub fn handle_compiler_data(line: u16, lexer: &mut Lexer) -> Result<Token> {
    lexer.expect('#')?;

    let mut value = String::new();
    while lexer.current() != '\n' {
        value += &lexer.advance().to_string();
    }

    Ok(Token {
        value,
        kind: TokenKind::CompilerData,
        line,
    })
}
```

</details>

#### Comment
* expects to find two '/' at the beginning
* collects all characters until it hits next line - '\n' 

<details>
<summary> ⚠️ Implementation </summary>

``` rust
//lexer/tokenization_functions.rs

pub fn handle_comments(line: u16, lexer: &mut Lexer) -> Result<Token> {
    lexer.expect('/')?;
    lexer.expect('/')?;

    let mut value = String::new();
    while lexer.current() != '\n' {
        value += &lexer.advance().to_string();
    }

    Ok(Token {
        value,
        kind: TokenKind::Comment,
        line,
    })
}
```

</details>

#### Identifier
0. It will collect all characters until it encounter's one that is not inside 'valid_identifier_token_chars'
1. Then it needs to check the value that it gathered if it is a keyword or not eg.else,break,struct... 

<details>
<summary> ⚠️ Implementation </summary>

``` rust
//lexer/tokenization_functions.rs

pub fn handle_identifier(line: u16, lexer: &mut Lexer) -> Result<Token> {
    let mut value = String::new();
    while lexer
        .valid_identifier_token_chars
        .contains(&lexer.current())
    {
        value += &lexer.advance().to_string();
    }

    match lexer.keywords.get(value.as_str()) {
        Some(token_kind) => Ok(Token {
            value: String::new(),
            kind: *token_kind,
            line,
        }),
        None => Ok(Token {
            value,
            kind: TokenKind::Identifier,
            line,
        }),
    }
}
```

</details>


#### Using them

Now we nee to initialize all patterns:
``` rust
//lexer/patterns.rs

...

const SYMBOL_CHARS: [char; 53] = [
    'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's',
    't', 'u', 'v', 'w', 'x', 'y', 'z', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L',
    'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', '_',
];
const NUMBERS: [char; 10] = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];


use crate::lexer::{
    Lexer,
    token::{Token, TokenKind},
    tokenization_functions::{
        handle_comments, handle_compiler_data, handle_identifier, handle_number, handle_string,
    }
};


fn patterns() -> Vec<TokenPatternInitialization> {
    vec![
        TokenPatternInitialization::new(vec!['/'], '/', TokenPattern::Long(handle_comments)),
        TokenPatternInitialization::new(vec!['"'], ' ', TokenPattern::Long(handle_string)),
        TokenPatternInitialization::new(vec!['#'], ' ', TokenPattern::Long(handle_compiler_data)),
        TokenPatternInitialization::new(NUMBERS.to_vec(), ' ', TokenPattern::Long(handle_number)),
        TokenPatternInitialization::new(
            SYMBOL_CHARS.to_vec(),
            ' ',
            TokenPattern::Long(handle_identifier),
        ),
        TokenPatternInitialization::new(
            vec!['\t'],
            ' ',
            TokenPattern::Fast {
                kind: TokenKind::Tab,
                use_second_char: false,
            },
        ),
        TokenPatternInitialization::new(
            vec![' '],
            ' ',
            TokenPattern::Fast {
                kind: TokenKind::WhiteSpace,
                use_second_char: false,
            },
        ),
        TokenPatternInitialization::new(
            vec!['\0'],
            ' ',
            TokenPattern::Fast {
                kind: TokenKind::EndOfFile,
                use_second_char: false,
            },
        ),
        TokenPatternInitialization::new(
            vec!['\n'],
            ' ',
            TokenPattern::Fast {
                kind: TokenKind::NextLine,
                use_second_char: false,
            },
        ),
        TokenPatternInitialization::new(
            vec!['('],
            ' ',
            TokenPattern::Fast {
                kind: TokenKind::OpenParen,
                use_second_char: false,
            },
        ),
        TokenPatternInitialization::new(
            vec![')'],
            ' ',
            TokenPattern::Fast {
                kind: TokenKind::CloseParen,
                use_second_char: false,
            },
        ),
        TokenPatternInitialization::new(
            vec!['['],
            ' ',
            TokenPattern::Fast {
                kind: TokenKind::OpenBracket,
                use_second_char: false,
            },
        ),
        TokenPatternInitialization::new(
            vec![']'],
            ' ',
            TokenPattern::Fast {
                kind: TokenKind::CloseBracket,
                use_second_char: false,
            },
        ),
        TokenPatternInitialization::new(
            vec!['{'],
            ' ',
            TokenPattern::Fast {
                kind: TokenKind::OpenCurly,
                use_second_char: false,
            },
        ),
        TokenPatternInitialization::new(
            vec!['}'],
            ' ',
            TokenPattern::Fast {
                kind: TokenKind::CloseCurly,
                use_second_char: false,
            },
        ),
        TokenPatternInitialization::new(
            vec![','],
            ' ',
            TokenPattern::Fast {
                kind: TokenKind::Comma,
                use_second_char: false,
            },
        ),
        TokenPatternInitialization::new(
            vec!['.'],
            ' ',
            TokenPattern::Fast {
                kind: TokenKind::Dot,
                use_second_char: false,
            },
        ),
        TokenPatternInitialization::new(
            vec![';'],
            ' ',
            TokenPattern::Fast {
                kind: TokenKind::SemiColon,
                use_second_char: false,
            },
        ),
        TokenPatternInitialization::new(
            vec![':'],
            ' ',
            TokenPattern::Fast {
                kind: TokenKind::Colon,
                use_second_char: false,
            },
        ),
        TokenPatternInitialization::new(
            vec!['-'],
            '>',
            TokenPattern::Fast {
                kind: TokenKind::Arrow,
                use_second_char: true,
            },
        ),
        TokenPatternInitialization::new(
            vec!['?'],
            ' ',
            TokenPattern::Fast {
                kind: TokenKind::Question,
                use_second_char: false,
            },
        ),
        TokenPatternInitialization::new(
            vec!['+'],
            '=',
            TokenPattern::Fast {
                kind: TokenKind::PlusEquals,
                use_second_char: true,
            },
        ),
        TokenPatternInitialization::new(
            vec!['+'],
            '+',
            TokenPattern::Fast {
                kind: TokenKind::PlusPlus,
                use_second_char: true,
            },
        ),
        TokenPatternInitialization::new(
            vec!['+'],
            ' ',
            TokenPattern::Fast {
                kind: TokenKind::Plus,
                use_second_char: false,
            },
        ),
        TokenPatternInitialization::new(
            vec!['-'],
            '=',
            TokenPattern::Fast {
                kind: TokenKind::MinusEquals,
                use_second_char: true,
            },
        ),
        TokenPatternInitialization::new(
            vec!['-'],
            '-',
            TokenPattern::Fast {
                kind: TokenKind::MinusMinus,
                use_second_char: true,
            },
        ),
        TokenPatternInitialization::new(
            vec!['-'],
            ' ',
            TokenPattern::Fast {
                kind: TokenKind::Minus,
                use_second_char: false,
            },
        ),
        TokenPatternInitialization::new(
            vec!['*'],
            '=',
            TokenPattern::Fast {
                kind: TokenKind::StarEquals,
                use_second_char: true,
            },
        ),
        TokenPatternInitialization::new(
            vec!['*'],
            ' ',
            TokenPattern::Fast {
                kind: TokenKind::Star,
                use_second_char: false,
            },
        ),
        TokenPatternInitialization::new(
            vec!['/'],
            '=',
            TokenPattern::Fast {
                kind: TokenKind::SlashEquals,
                use_second_char: true,
            },
        ),
        TokenPatternInitialization::new(
            vec!['/'],
            ' ',
            TokenPattern::Fast {
                kind: TokenKind::Slash,
                use_second_char: false,
            },
        ),
        TokenPatternInitialization::new(
            vec!['%'],
            ' ',
            TokenPattern::Fast {
                kind: TokenKind::Percent,
                use_second_char: false,
            },
        ),
        TokenPatternInitialization::new(
            vec!['='],
            '=',
            TokenPattern::Fast {
                kind: TokenKind::Equals,
                use_second_char: true,
            },
        ),
        TokenPatternInitialization::new(
            vec!['!'],
            '=',
            TokenPattern::Fast {
                kind: TokenKind::NotEquals,
                use_second_char: true,
            },
        ),
        TokenPatternInitialization::new(
            vec!['<'],
            '=',
            TokenPattern::Fast {
                kind: TokenKind::LessEquals,
                use_second_char: true,
            },
        ),
        TokenPatternInitialization::new(
            vec!['<'],
            '<',
            TokenPattern::Fast {
                kind: TokenKind::BitwiseShiftLeft,
                use_second_char: true,
            },
        ),
        TokenPatternInitialization::new(
            vec!['<'],
            ' ',
            TokenPattern::Fast {
                kind: TokenKind::Less,
                use_second_char: false,
            },
        ),
        TokenPatternInitialization::new(
            vec!['>'],
            '=',
            TokenPattern::Fast {
                kind: TokenKind::GreaterEquals,
                use_second_char: true,
            },
        ),
        TokenPatternInitialization::new(
            vec!['>'],
            '>',
            TokenPattern::Fast {
                kind: TokenKind::BitwiseShiftRight,
                use_second_char: true,
            },
        ),
        TokenPatternInitialization::new(
            vec!['>'],
            ' ',
            TokenPattern::Fast {
                kind: TokenKind::Greater,
                use_second_char: false,
            },
        ),
        TokenPatternInitialization::new(
            vec!['!'],
            ' ',
            TokenPattern::Fast {
                kind: TokenKind::Not,
                use_second_char: false,
            },
        ),
        TokenPatternInitialization::new(
            vec!['&'],
            '&',
            TokenPattern::Fast {
                kind: TokenKind::And,
                use_second_char: true,
            },
        ),
        TokenPatternInitialization::new(
            vec!['|'],
            '|',
            TokenPattern::Fast {
                kind: TokenKind::Or,
                use_second_char: true,
            },
        ),
        TokenPatternInitialization::new(
            vec!['='],
            ' ',
            TokenPattern::Fast {
                kind: TokenKind::Assignment,
                use_second_char: false,
            },
        ),
        TokenPatternInitialization::new(
            vec!['&'],
            ' ',
            TokenPattern::Fast {
                kind: TokenKind::Reference,
                use_second_char: false,
            },
        ),
    ]
}
```

'TokenPatternInitialization' it self doesn't do anything. We need to use it to create HashMap that we will actually use:
```rust
HashMap<(char, char), TokenPattern>
```

<details>
<summary> ⚠️ Implementation  </summary>

``` rust
//lexer/patterns.rs

pub fn setup_token_patters() -> Result<HashMap<(char, char), TokenPattern>> {
    let patterns = patterns();
    let mut hashmap = HashMap::new();

    let mut i = 0;
    for pat in patterns {
        for start_char in pat.start_chars {
            let key = (start_char, pat.second_char);
            if hashmap.contains_key(&key) {
                bail!(
                    "there is another 'token kind' that has pattern with the same char combination: '{}' '{}', pattern index: {i}",
                    start_char,
                    pat.second_char
                );
            }

            hashmap.insert(key, pat.pattern);
        }
        i += 1;
    }

    Ok(hashmap)
}
```

</details>

Now we need a function that will actually use our handy HashMap from Lexer.
```rust 
fn pattern_for_current_char(lexer: &mut Lexer) -> Option<TokenPattern>
```
It will get needed characters form lexer and output 'TokenPattern' that we will need to use later. 

<details>
<summary> ⚠️ Implementation  </summary>

``` rust
//lexer/patterns.rs

///INFO: Uses Lexer to get current and next char and get right function for parsing value that starts
/// with those chars
pub fn pattern_for_current_char(lexer: &mut Lexer) -> Option<TokenPattern> {
    let current = lexer.current();
    let next = lexer.next();
    match lexer.token_patterns.get(&(current, next)) {
        Some(val) => Some(*val),
        // if there is no pattern with next char, then there might be one without it
        None => match lexer.token_patterns.get(&(current, ' ')) {
            Some(val) => Some(*val),
            None => None,
        },
    }
}
```
</details>

### Finishing

Now let's  initialize lexer with needed values.  


```rust
//lexer/mod.rs

pub fn tokenize(text: Vec<char>) -> Result<Vec<Token>> {
    let valid_identifier_token_chars: HashSet<char> = [
        '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h',
        'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z',
        'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R',
        'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', '_',
    ]
    .into_iter()
    .collect();
    let valid_number_token_chars: HashSet<char> = [
        '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'x', 'a', 'b', 'c', 'd', 'e', 'f',
    ]
    .into_iter()
    .collect();
    let keywords: HashMap<&str, TokenKind> = HashMap::from([
        ("if", TokenKind::If),
        ("else", TokenKind::Else),
        ("break", TokenKind::Break),
        ("return", TokenKind::Return),
        ("while", TokenKind::While),
        ("static", TokenKind::Static),
        ("const", TokenKind::Constant),
        ("enum", TokenKind::Enum),
        ("true", TokenKind::True),
        ("false", TokenKind::False),
        ("struct", TokenKind::Struct),
        ("for", TokenKind::For),
        ("typedef", TokenKind::Typedef),
    ]);

    let mut lexer = Lexer {
        keywords,
        valid_identifier_token_chars,
        valid_number_token_chars,
        contents: text,
        i: 0,
        token_patterns: setup_token_patters().context("setting up token patterns")?,
    };
    ...
```

#### Using 'pattern_for_current_char'

now we just call pattern_for_current_char until we read thru all file.
when we get a valid pattern we need to check if it is a long one or the fast one.

##### Long 
* call a function stored in this pattern enum
* use ? and .context("some information") on result
* push the Token into some kind of output vector.
##### Fast
* If the kind == TokenKind::NextLine we advance current line counter
* Create Token struct with:
    - String::new() as value
    - line set as current line counter
    - kind set to the kind form pattern enum


<details>
<summary> ⚠️ Implementation  </summary>

``` rust
//lexer/mod.rs

pub fn tokenize(text: Vec<char>) -> Result<Vec<Token>> {
...
    let mut output: Vec<Token> = vec![];
    let mut current_line: u16 = 1;
    while lexer.i < lexer.contents.len() {
        let pattern = match patterns::pattern_for_current_char(&mut lexer) {
            Some(val) => val,
            None => {
                warn!(
                    "there was no pattern for combo: '{}'&&'{}'",
                    lexer.current(),
                    lexer.next()
                );
                lexer.advance();
                continue;
            }
        };

        output.push(match pattern {
            TokenPattern::Fast {
                kind,
                use_second_char,
            } => {
                if kind == TokenKind::NextLine {
                    current_line += 1;
                }
                // advance
                lexer.i += 1 + use_second_char as usize;
                Token {
                    value: String::new(),
                    kind,
                    line: current_line,
                }
            }
            TokenPattern::Long(function) => function(current_line, &mut lexer)
                .context("while running a token pattern function")?,
        });
    }

```

</details>

## Testing
Now we should be able to test everything by just running our program with `cargo run`.
Than look at the output in console and see if the output tokens are right.

