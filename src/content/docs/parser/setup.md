---
title: 1. setup
description: setup
---

1.  Setup your rust project  with ``cargo init <name>``.
2.  add log and [colog](https://docs.rs/colog/latest/colog/) create to your project ``cargo add colog log``.
* Why we need it? we don't really need them but log create will give us nice functions for printing warning, info and errors. and colog will automatically set it up and add colors to them - who doesn't like separate colors for debug messages of different types?  
* add code:

``` rust
// main.rs
fn main() {
    use log::*;

    colog::init();
    info!("init colog");
    error!("some error message!");
}
```


* run this code with ``cargo run `` and you should see nice logs in your terminal.
3. next we will add [anyhow](https://docs.rs/anyhow/latest/anyhow/) ``cargo add anyhow``. 
* what is anyhow? Anyhow makes adding great debug messages in code really simple.
* it allows us to eg. add context to error and propagate it further. this is possible thanks to the [result type](https://doc.rust-lang.org/std/result/).
Example:
``` rust
use anyhow::{Context, Result, bail};
// Result<T,E> T- value, in this instance nothing. E- error value - by importing anyhow::Result i don't have to specify type - it is anyhow::Error.TODO: add link to anyhow error
fn do_smth() -> Result<()> {
    let x = todo!();
    let y = todo!();
    // with_context allows us to add context that is evaluated lazily- only once an error does occur.
    // and than use ? to propagate the error.
    calculate_w().with_context(|| {
        format!(
            "calculate_w -> x: {x} y: {y}, current time:{}",
            time::SystemTime::now()
        )
    })?;

    todo!()
}
fn calculate_w(x: u16, y: u16) -> Result<u16> {
    if y == 0 {
        // the same as return Err(value);
        bail!("Can't dived by 0!");
    }

    // ? returns function with error if result contains it. otherwise just 'unwraps' value.
    let n: u16 = calculate_n().context("calculate_n - this often means... . you should create issue on github with information form this log.")?;
    Ok(x / y * n)
}
fn calculate_n() -> Result<u16> {
    todo!()
}
```


# Reading from a file.
## create test file


## reading

Reading a file in rust is as simple as:
```rust
// there are at least 5 ways to represent string in rust: https://doc.rust-lang.org/std/string/struct.String.html
let path: &str = "path/to/a/file"; 
let file: String  = std::fs::read_to_string(path)?;
let chars: Vec<char> = file.chars() // returns iterator, it could be nice but normal vector is more flexible;
                            .collect::<Vec<char>>(); // converts iterator into a vec
```
>[!Warning]
> Loading whole file at once might be a problem when woring with large files.
> But modern systems have so much memeory that for our purposes this won't be a problem.
> If you want you might implement it differently. this should be fairly simple.
but this gives a one big string. for out purpose better way would be to have our data as an array/vector of characters.

Great, now we have everything that is needed to start writing our lexer. 
If you are new to rust I recommend you to try to do tasks that I'll specify bellow. they will help you to understand string manipulation in rust better, and thus help you later.
* Read 15 characters at a time.
* Sort segments of 15 characters by sum of their characters as integers. eg: 
'HELLO' = 
H->	72+	
E->	69+
L->	76+	
L->	76+	
O->	79	
= 372
* split contents of file into vec of strings that contain 1 line. 
