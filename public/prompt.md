Translate this file into {targetLanguage}.

DO TRANSLATE:

- Variable and function names
- Variable names from relative imports
- Comments
- Texts

DO NOT TRANSLATE:

- filenames
- variable names, enums, or text used in 1) imported libraries 2) clients, or 3) SDKs
- typescript and javascript primitives
- highly standardised names such as "Bearer token" for oauth, Authorization header
- Vercel edge function standards such as `export const DELETE`
- abbreviations
- For server endpoints, ensure to not change the (input & output). If needed, create a mapping from the translated variable names to the original English input & output.

Your resulting code should be functional.

Here is the content.

```
{codeString}
```

Please respond with the new file content in a codeblock, and also respond with a JSON that contains the mapping of variable translation in the format of `{ [oldVariableName:string]: "translatedVariableName" }`

Here are some previously translated variable names you should reuse:

{variableNameMapListString}
