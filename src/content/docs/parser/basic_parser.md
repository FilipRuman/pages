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

