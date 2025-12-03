---
title: 4. data type parsing functions 
description: parser
---

If we have for example:

```c
TestStructName value[5][3]  = {{...},{...}};
// or
char** c = ...;
//or
typedef enum { MODE_A, MODE_B = 5, MODE_C } Mode;
```

we need a pretty smart code that will be able to parse those patterns.

## Basic data type parsing
```c 
char c;
```
### DataType enum
We need to implement an enum that will be holding parsed data, let's name it 'DataType'.
It has to be an enum because it will be holding different data types like: arrays, pointers, enums, etc.

But for now, only give it these types:
* Data->  name and a bool value- if it is unsigned
* Pointer-> Box< DataType >


<details>
<summary> ⚠️ Implementation </summary>

``` rs
//parser/types/mod.rs
#[derive(Debug, Clone)]
pub enum DataType {
    Data { name: String, unsigned: bool },
    Pointer(Box<DataType>),
}
```

</details>

### parse function
#### declaration
``` rust
pub fn parse(parser: &mut Parser) -> Result<DataType>{...}
```
#### function  

1. Parse current tokens so that it outputs appropriate 'DataType'.
2. Remember to check for `TokenKind::Unsigned` at the beginning eg. `unsigned int uint = 16;`
3. select the right function depending on the kind of the token it encountered next:
    * identifier -> identifier_type();
    * enum -> enum_type();
    * struct -> struct_type();
4. Their functions will output  `Result<DataType>`, so we will just output them straight after adding some context.

<details>
<summary> ⚠️ Implementation </summary>

``` rust
//parser/types/mod.rs
pub fn parse(parser: &mut Parser) -> Result<DataType> {
    let unsigned = {
        let current = parser.current();

        let unsigned = current.value == "unsigned";
        if unsigned {
            parser.advance();
        }
        unsigned
    };

    let current = parser.advance().to_owned();
    match current.kind {
        TokenKind::Identifier => {
            identifier_type(parser, unsigned, current).context("types::parse -> identifier")
        }
        TokenKind::Enum => enum_type(parser).context("types::parse -> Enum"),
        TokenKind::Struct => struct_type(parser).context("types::parse -> Struct"),
        other => {
            bail!(
                "types::parse: expected to fine 'Identifier' || 'Enum' || 'Struct', found: {:?} -> parsing of this token kind as datatype is not supported",
                other
            )
        }
    }
}
```

</details>

###  Identifier type

This will be a really simple one: 
It has to output Datatype::Data, and it will do it by just taking, current token as an name, and a boolean saying weather it is unsigned or not.

But then we need to check if our data isn't wrapped in pointers, so we need to be wrap our data in a DataType::Pointer for each token of kind 'star'.   

<details>
<summary> ⚠️ Implementation </summary>

``` rust
///parser/types/mod.rs
fn identifier_type(parser: &mut Parser, unsigned: bool, current: Token) -> Result<DataType> {
    let mut output = DataType::Data {
        name: current.value,
        unsigned,
    };
    while parser.current().kind == TokenKind::Star {
        output = DataType::Pointer(Box::new(output));
        parser.advance();
    }
    Ok(output)
}
```

</details>

Now update call to 'identifier_type()' inside 'parse()' and you should be able to pares the type form the example.
In this tutorial we will be testing this later, when we implement variable declaration, but you might test it out right now if you want! 

##  parsing arrays

```c 
int c[5]= ...;
```

### Data type 
We need to add a enum type for it to the `DataType`, it needs to have:
* length
* inside 'DataType'

<details>
<summary> ⚠️ Implementation </summary>

``` rs
//parser/types/mod.rs
pub enum DataType {
    ...
    Array { length: u32, inside: Box<DataType> },
}
```

</details>


### Parsing 

Function to parse an array will not be called by the 'parse' function, this is because 'array brackets' come after the name of a variable.
Because of this, the function will be called by the variable declaration function, so it 'wraps' the current data type inside of the Array data type eg.
``` c
int c[1][2]
```
into
```rust
DataType::Array{ length:1, inside: Box{DataType::Array{length:2,inside:Box{DataType::Data{name:"int",unsigned:false}}}}
```

###  Implementing 'wrap_data_type_in_an_array' function 
#### declaration
```rust 
pub fn wrap_data_type_in_an_array(
    mut data_type: DataType,
    parser: &mut Parser,
) -> Result<DataType> {
```

#### function
wraps data type that it got in arrays of parsed length while the current token kind is a open bracket `[`. 

<details>
<summary> ⚠️ Implementation </summary>

```rust
//parser/types/mod.rs
pub fn wrap_data_type_in_an_array(
    mut data_type: DataType,
    parser: &mut Parser,
) -> Result<DataType> {
    while parser.current().kind == TokenKind::OpenBracket {
        parser.expect(TokenKind::OpenBracket)?;
        let length =
            parsing_functions::data_parsing::str_to_num(&parser.expect(TokenKind::Number)?.value)?;
        parser.expect(TokenKind::CloseBracket)?;
        data_type = DataType::Array {
            length,
            inside: Box::new(data_type),
        };
    }

    Ok(data_type)
}
```

</details>


##  parsing struts
```c 
typedef struct {
    int a;
} str1;
```


### Data type 

The struct data type just needs to know its properties. 
We will implement a 'Property' struct inside the 'expressions.rs' because we will be also using it in other places. it needs to have it's name and data type.


<details>
<summary> ⚠️ Implementation </summary>

```rust
//parser/expressions.rs
use crate::parser::types::DataType,
#[derive(Debug, Clone)]
pub struct Property {
    pub var_name: String,
  pub var_type: DataType,
}
...
```

</details>
 
DataType::Struct

<details>
<summary> ⚠️ Implementation </summary>

```rust
//parser/types/mod.rs
#[derive(Debug, Clone)]
pub enum DataType {
    Struct { properties: Vec<Property> },
    ...
}
``` 

</details>


### Parsing 

We need to remember to expect all of the curly braces and the struct keyword, after that we need to parse the properties.
To do this, we just need to: 
1. get the data type -> use 'parse()'
2. get variable name -> read value of the next identifier token
3. do this until there is no comma afterwards.


<details>
<summary> ⚠️ Implementation </summary>

```rust
//parser/types/mod.rs
fn struct_type(parser: &mut Parser) -> Result<DataType> {
    parser.expect(TokenKind::OpenCurly)?;
    let mut properties = Vec::new();
    while parser.current().kind != TokenKind::CloseCurly {
        let data_type = parse(parser)?;
        let name = parser.expect(TokenKind::Identifier)?.value;
        parser
            .expect(TokenKind::SemiColon)
            .context("expected to find a semicolon after a expression - struct contents")?;

        properties.push(Property {
            var_name: name,
            var_type: data_type,
        });
    }

    parser.expect(TokenKind::CloseCurly)?;
    Ok(DataType::Struct { properties })
}
``` 

</details>

##  parsing enums

```c 
typedef enum { MODE_A, MODE_B = 5, MODE_C } Mode;
```

### Data type 

First we need to define a new type for the enum fields, because it doesn't match the previous types that we used, it needs: value(int) and a name.  

<details>
<summary> ⚠️ Implementation </summary>

``` rs
//parser/types/mod.rs
pub enum DataType {
    ...
    Enum { fields: Vec<EnumField> },
}
```

</details>

type inside `DataType`, only needs to store fields.

<details>
<summary> ⚠️ Implementation </summary>

``` rs
//parser/types/mod.rs
#[derive(Debug, Clone)]
pub enum DataType {
    Enum { fields: Vec<EnumField> },
    ...
}
```

</details>


### Parsing 

To parse enum we will have to read the name of a field, then check if it has some value assigned to it.
If the value is set, then it should carry through to the next fields, increasing by one.

:::caution
Remember to expect tokens like '{' and '}' at the beginning and end.
:::

<details>
<summary> ⚠️ Implementation </summary>

``` rust
fn enum_type(parser: &mut Parser) -> Result<DataType> {
    parser.expect(TokenKind::OpenCurly)?;
    let mut current_value: i32 = 0;
    let mut fields = Vec::new();
    let mut end = false;
    while !end {
        let field_name = parser.expect(TokenKind::Identifier)?.value;
        match parser.advance().kind {
            TokenKind::Equals => {
                let sign: i32 = if parser.current().kind == TokenKind::Minus {
                    parser.advance();
                    -1
                } else {
                    1
                };
                current_value = str_to_num(&parser.expect(TokenKind::Number)?.value)? as i32 * sign;
                end = parser.advance().kind == TokenKind::CloseCurly;
            }
            TokenKind::Comma => {}
            TokenKind::CloseCurly => {
                end = true;
            }
            kind => {
                bail!(
                    "expected to find token of kind: 'Comma' || 'Assignment' || 'CloseParen', found: '{kind:?}'"
                )
            }
        }

        fields.push(EnumField {
            name: field_name,
            value: current_value,
        });

        current_value += 1;
    }
    Ok(DataType::Enum { fields })
}
```

</details>

## End result

At in the end your `parser/types/mod.rs` file should look like this: 
<details>
<summary> ⚠️ Implementation </summary>

``` rust
// parser/types/mod.rs
use crate::lexer::token::Token;
use crate::parser::expression::Property;
use crate::parser::{Parser, parsing_functions};
use crate::{lexer::token::TokenKind, parser::parsing_functions::data_parsing::str_to_num};
use anyhow::{Context, Result, bail};

#[derive(Debug, Clone)]
pub struct EnumField {
    name: String,
    value: i32,
}

#[derive(Debug, Clone)]
pub enum DataType {
    Array { length: u32, inside: Box<DataType> },
    Data { name: String, unsigned: bool },
    Struct { properties: Vec<Property> },
    Enum { fields: Vec<EnumField> },
    Pointer(Box<DataType>),
}

pub fn parse(parser: &mut Parser) -> Result<DataType> {
    let unsigned = {
        let current = parser.current();

        let unsigned = current.kind == TokenKind::Unsigned;
        if unsigned {
            parser.advance();
        }
        unsigned
    };

    let current = parser.advance().to_owned();
    match current.kind {
        TokenKind::Identifier => {
            identifier_type(parser, unsigned, current).context("types::parse -> identifier")
        }
        TokenKind::Enum => enum_type(parser).context("types::parse -> Enum"),
        TokenKind::Struct => struct_type(parser).context("types::parse -> Struct"),
        other => {
            bail!(
                "types::parse: expected to find 'Identifier' || 'Enum' || 'Struct', found: {:?} -> parsing of this token kind as datatype is not supported",
                other
            )
        }
    }
}
pub fn wrap_data_type_in_an_array(
    mut data_type: DataType,
    parser: &mut Parser,
) -> Result<DataType> {
    while parser.current().kind == TokenKind::OpenBracket {
        parser.expect(TokenKind::OpenBracket)?;
        let length =
            parsing_functions::data_parsing::str_to_num(&parser.expect(TokenKind::Number)?.value)?;
        parser.expect(TokenKind::CloseBracket)?;
        data_type = DataType::Array {
            length,
            inside: Box::new(data_type),
        };
    }

    Ok(data_type)
}
fn identifier_type(parser: &mut Parser, unsigned: bool, current: Token) -> Result<DataType> {
    let mut output = DataType::Data {
        name: current.value,
        unsigned,
    };
    while parser.current().kind == TokenKind::Star {
        output = DataType::Pointer(Box::new(output));
        parser.advance();
    }
    Ok(output)
}

fn enum_type(parser: &mut Parser) -> Result<DataType> {
    parser.expect(TokenKind::OpenCurly)?;
    let mut current_value: i32 = 0;
    let mut fields = Vec::new();
    let mut end = false;
    while !end {
        let field_name = parser.expect(TokenKind::Identifier)?.value;
        match parser.advance().kind {
            TokenKind::Equals => {
                let sign: i32 = if parser.current().kind == TokenKind::Minus {
                    parser.advance();
                    -1
                } else {
                    1
                };
                current_value = str_to_num(&parser.expect(TokenKind::Number)?.value)? as i32 * sign;
                end = parser.advance().kind == TokenKind::CloseCurly;
            }
            TokenKind::Comma => {}
            TokenKind::CloseCurly => {
                end = true;
            }
            kind => {
                bail!(
                    "expected to find token of kind: 'Comma' || 'Assignment' || 'CloseCurly', found: '{kind:?}'"
                )
            }
        }

        fields.push(EnumField {
            name: field_name,
            value: current_value,
        });

        current_value += 1;
    }
    Ok(DataType::Enum { fields })
}

fn struct_type(parser: &mut Parser) -> Result<DataType> {
    parser.expect(TokenKind::OpenCurly)?;
    let mut properties = Vec::new();
    while parser.current().kind != TokenKind::CloseCurly {
        let data_type = parse(parser)?;
        let name = parser.expect(TokenKind::Identifier)?.value;
        parser
            .expect(TokenKind::SemiColon)
            .context("expected to find a semicolon after an expression - struct contents")?;

        properties.push(Property {
            var_name: name,
            var_type: data_type,
        });
    }

    parser.expect(TokenKind::CloseCurly)?;
    Ok(DataType::Struct { properties })
}
``` 

</details>

