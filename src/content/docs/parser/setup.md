---
title: 1. setup
description: setup
---
## 1. Create a Rust Project
Create a new project using Cargo:
```bash
cargo init <name>
```

:::note[What is cargo?]
"[Cargo is the Rust package manager. 
Cargo downloads your Rust package’s dependencies, compiles your packages, makes distributable packages, and uploads them to crates.io](https://doc.rust-lang.org/cargo/)"
:::

This gives us a clean Rust project.

## 2. Add Logging Support

We’ll use two crates:

* [log](https://docs.rs/log/latest/log/) — provides structured logging macros (info!, warn!, error!, etc.)
* [colog](https://docs.rs/colog/latest/colog/) — configures logging automatically and adds colored output

Add both crates:

```bash
cargo add log colog
```

Why logging?
As we build the lexer and parser, it’s extremely helpful to print structured debug information.
Especially when writing error-prone code- like working with text.
Colored logs make it even easier to understand what’s happening.

Add this example:
```rs
// main.rs
fn main() {
    use log::*;

    colog::init();
    info!("colog initialized");
    error!("example error message");
}
```


Run the program:

```bash
cargo run
```

You should see nicely formatted, colored log output.

## 3. Add easier error handling with anyhow
Next, add the [anyhow](https://docs.rs/anyhow/latest/anyhow/)

crate:
```bash
cargo add anyhow
```

What is anyhow?
Anyhow makes adding great debug messages in code really simple. 
It allows us to eg. add context to an error and propagate it further. This is possible thanks to the Rust's [result type](https://doc.rust-lang.org/std/result/).

This pattern will be extremely useful once we start parsing and want readable error messages.

Example:
``` rust
use anyhow::{Context, Result, bail};
// Result<T,E> T- value, in this instance nothing. E- error value - by importing anyhow::Result i don't have to specify type - it is anyhow::Error
fn do_smth() -> Result<()> {
    // u16 - 16 bit unsigned integer
    let x:u16 = 9;
    let y = 10;

    // with_context allows us to add context that is evaluated lazily- only once an error does occur.
    // and then use ? to propagate the error.
    let w: u16 = calculate_w(x,y).with_context(|| {
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
        bail!("Can't divide by 0!");
    }

    // what ? does in rust:
    // result type: Err- immediately returns function with this error result.
    // result type: OK- just 'unwraps' value and move on and run next piece of code.
    let n: u16 = calculate_n().context("calculate_n - this often means... . you should create issue on github with information from this log.")?;
    Ok(x / y * n)
}
fn calculate_n() -> Result<u16> {
    todo!()
}
```
## Reading from a File
### create a test file
Create a simple text file anywhere in your project for testing file I/O—this will be our lexer’s input later.

```c
unsigned int test = 32;

#include "endian.h"
#include "file.c"
#include <cstdio>
#include <stddef.h>
#include <stdio.h>
typedef int i32;

typedef struct {
  i32 x;
  i32 y;
} Vec;

typedef enum { MODE_A = -1, MODE_B = 5, MODE_C } Mode;

static i32 global = 10;
static i32 data[4] = {1, 2, 3, 4};

i32 mul(i32 a, i32 b) { return a * b; }

i32 weird_decl = sizeof(Vec) + sizeof(Mode);

i32 identity(i32 v) { return v; }

int main() {
  Vec v = {3, 4};
  Mode m = MODE_B;

  i32 idx = v.x - 1;
  i32 val = data[idx];

  i32 i32 = identity(7);

  {
    int val = mul(v.x, v.y);
    global = val;
  }

  int a = 2;
  int *ptr = &a;
  int b = *ptr + 3;
  int c;

  int len = 25;
  for (int i = 0; i < len; i++) {
    printf("25 %d", i);
  }
  int i = 0;
  while (i < len) {
    printf("25 %d", i);
  }

  if (i < len) {
    c++;
    printf("i < len");
    printf("i < len");
    printf("i < len");
  } else if (i > len * 2) {
    b--;
    printf("Some text");
  } else {
    return c * 25;
  }

  c = a + b + val + global + m + i32;

  return c;
}
```
### Reading the File

:::caution
Loading whole file at once might be a problem when working with large files.
But modern systems have so much memory that for our purposes this won't be a problem.
If you want you might implement it differently. This should be fairly simple.
:::

Reading a file in rust is as simple as:
```rs
std::fs::read_to_string(path)?
```
This gives one big string.
But a [vec](https://doc.rust-lang.org/std/vec/struct.Vec.html) of characters is easier to work with than raw UTF-8 bytes for our purposes. 
This is because the lexer will be checking char by char and sometimes peeking 1 char ahead.
```rust
// there are at least 5 ways to represent string in rust: https://doc.rust-lang.org/std/string/struct.String.html
let path: &str = "path/to/a/file"; 
let file: String  = std::fs::read_to_string(path)?;
let chars: Vec<char> = file.chars() // returns iterator, it could be nice but normal vector is more flexible;
                            .collect::<Vec<char>>(); // converts iterator into a vec
```
## Practice Tasks (Recommended)

If you’re new to Rust, try these small exercises. They will strengthen your understanding of string manipulation which is  crucial for writing a lexer.

#### Split a file into Vec<String> where each element is a line

#### Read 15 characters at a time

#### Sort 15-character segments by their total character code sum
Example:
``HELLO = 72 + 69 + 76 + 76 + 79 = 372``

