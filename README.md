Once upon a time someone told me a story of a cook from Africa that went to the Netherlands without knowing one word in English or Dutch. This was before the time of the internet and smart phones, so the cook had no way to communicate with others. But because he was a good cook, he could still work and interact with others on a daily basis. And so he did! And within a few months, the cook learned Dutch fluently. He was SO FAST because of one advantage he had: true immersion. He learned so fast because he had no other option.

Learning a language works best by immersion. However, a mixed language environment is a slippery slope that makes you switch back to your mother tongue easily. In order to achieve a true immersion, we need a single language environment where the only language is the target language.

In order to do this, our physical environment can change by traveling, but what about the digital environment? It can not easily be changed, especially since our input and output of the work we do remains mostly English and Dutch. We interact with documents we've written from the past that have been written in our previous language. To overcome this, we need to either have on the fly translation, or, better probably, reliably translate large sets of documents.

For largely semantic contextual information, there's a challenge in accurately programmatically translating documents that have important context embedded. For programmers like me, the challenge mostly lies in syntax, the dependency of choices in translation, and the boundary of what to translate.

These challenges intrigue me because if I can solve them I may be able to create a truly single language environment for myself and still do my work productively.

## Let's get to work!

What if we can translate a codebase to another language:

- Input: {owner}/{repo}
- Output: {owner}/{repo}-{targetLanguage}

How? By leveraging ActionSchema `/chat/completion` with gpt4o up until a concurrency just hitting the ratelimit. Via a stream, this should be peanuts.

- Get folder file hierarchy with .genignore applied in yaml
- Have gpt4o translate that into target language
- Store this file/folder structure in a kv
- For each folder/file in the codebase, including code files, go over them one by one, and get a variable mapping and translated codefile

POC:

- ✅ Tested to get a good prompt that does code translation right (for now, customised to my stack)
- ✅ Implemented a Stream that does it
- Implement `/chat/simple` (`/chat/completions` string->string chat completion stream)
- Make it actually respond with functional code in a ZIP
- Test it on a small repo I have and see if the result is promising...

Try it out for a week:

- Find a good translation plugin in VSCode so I can select text and peek for the translation easily
- For all small enough repos I work on, do them in portuguese for a bit. If it works well enough, be serious about this and REALLY go through with this, to learn portuguese once and for all.

Advanced:

- to make it more reliable, try https://www.inngest.com/docs/guides/background-jobs and split things up with temporary upstash kv state
- to make it faster: first do all code in the order of removing dependency, after that, all text files can be done in parallel (assuming variables declared there are already in our map now)
- replace relative imports in all js,ts,tsx,jsx by the translated filenames, and re-enable filename translation.
- in github.actionschema.com, create functionality for creating a new repo with file content similar to the output of `search`. Use that instead of responding with a zip.
- ensure to also copy over binary files into the new repo
- Make it more general for translations of large sets of documents. For improved translation, we need to do context analysis and provide useful context for each document. This is actually a very useful thing for agents too!
