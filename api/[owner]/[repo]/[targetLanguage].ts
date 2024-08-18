import { findCodeblocks } from "marked-util";
import * as yaml from "yaml";
export const config = { runtime: "edge" };

export type NestedObject<T = null> = {
  [key: string]: NestedObject<T> | T;
};

const yamlFileHierarchyPath = "__fileHierarchy.yaml";
const jsonSplitter = "\n\n\n____[JSON]____\n\n\n";

function setNestedValue(obj: any, path: string[], value: any): any {
  if (path.length === 0) {
    return value;
  }

  const [head, ...rest] = path;

  if (rest.length === 0) {
    obj[head] = value;
  } else {
    if (!(head in obj) || typeof obj[head] !== "object") {
      obj[head] = {};
    }
    setNestedValue(obj[head], rest, value);
  }

  return obj;
}

/** We assume this can retain order */
const nestedPathObjectToQueryPathsArray = <
  T,
  N extends NestedObject<T> = NestedObject<T>,
>(
  nestedPathObject: N,
  prefix: string = "",
  isLeaf: (item: T | NestedObject<T>) => boolean,
  level = 0,
): string[] => {
  let result: string[] = [];

  if (level > 20) {
    // too deep
    console.warn("20 levels deep, incorrect end case");
    return result;
  }
  for (const key of Object.keys(nestedPathObject)) {
    const value = nestedPathObject[key];
    const currentPath = prefix ? `${prefix}/${key}` : key;

    if (isLeaf(value)) {
      // This is a leaf node
      result.push(currentPath);
    } else {
      // This is an internal node, recurse
      result = result.concat(
        nestedPathObjectToQueryPathsArray(
          value as NestedObject<T>,
          currentPath,
          isLeaf,
          level + 1,
        ),
      );
    }
  }

  return result;
};

/** Useful utility for streams! */
async function pipeResponseToController<T>(
  response: Response,
  controller: ReadableStreamDefaultController,
  reduceFn?: any,
  initialValue?: T,
) {
  let cumulativeValue = initialValue;
  let index = 0;
  const reader = response.body.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        controller.close();
        break;
      }
      if (reduceFn) {
        cumulativeValue = reduceFn(cumulativeValue, value, index + 1);
      }

      controller.enqueue(value);
    }
  } catch (error) {
    controller.error(error);
  }

  return cumulativeValue;
}

function getNestedValue(obj: any, path: string[]): any {
  return path.reduce((current, key) => {
    return current && current[key] !== undefined ? current[key] : undefined;
  }, obj);
}

export const GET = async (request: Request) => {
  const url = new URL(request.url);
  const Authorization = request.headers.get("Authorization");
  const owner = url.searchParams.get("owner");
  const repo = url.searchParams.get("repo");
  const targetLanguage = url.searchParams.get("targetLanguage");

  const prompt = await fetch(url.origin + "/prompt.md").then((res) =>
    res.text(),
  );

  const headers = Authorization
    ? { Accept: "application/json", Authorization }
    : { Accept: "application/json" };

  const fileHierarchyContentJson = await fetch(
    `https://github.actionschema.com/${owner}/${repo}/search`,
    { headers },
  ).then(async (res) =>
    res.ok ? { json: await res.json() } : { status: res.status },
  );

  const fileHierarchyYaml = await fetch(
    `https://github.actionschema.com/${owner}/${repo}/search?size=lines`,
    { headers: Authorization ? { Authorization } : undefined },
  ).then(async (res) =>
    res.ok ? { text: await res.text() } : { status: res.status },
  );

  if (!fileHierarchyContentJson || !fileHierarchyYaml) {
    const status = fileHierarchyContentJson.status || fileHierarchyYaml.status;
    return new Response(status + ": Could not find your code", {
      status,
    });
  }

  const pathsArray = nestedPathObjectToQueryPathsArray(
    fileHierarchyContentJson,
    undefined,
    (item) => typeof item === "string",
  );

  const variableNameMap: { [oldVariableName: string]: string } = {};
  const translationMap: { [path: string]: string } = {};

  const items = pathsArray
    .map((path) => {
      const codeString = getNestedValue(
        fileHierarchyContentJson,
        path.split("/"),
      )?.content;

      if (!codeString) {
        return;
      }
      return {
        path,
        codeString: codeString,
      };
    })
    .filter((x) => x !== undefined);
  // NB: Concatenate the file hierarchy to ensure it also gets translated in the end
  //.concat([{ path: yamlFileHierarchyPath, codeString: fileHierarchyYaml }]);

  return new Response(
    new ReadableStream({
      //@ts-ignore
      start: async (controller) => {
        for await (const item of items) {
          const { codeString, path } = item;

          const variableNameMapListString = Object.keys(variableNameMap)
            .filter((key) => codeString.includes(key))
            .reduce((string, key) => {
              return `${string}\n- ${key}: ${variableNameMap[key]}`;
            }, "");

          const response = await fetch(
            "https://chat.actionschema.com/chat/simple",
            {
              body: prompt
                .replace("{codeString}", codeString)
                .replace(
                  "{variableNameMapListString}",
                  variableNameMapListString,
                )
                .replace("{targetLanguage}", targetLanguage),
            },
          );

          const markdown = await pipeResponseToController(
            response,
            controller,
            (previous, current) => previous + current,
            "",
          );

          const [translatedCodeString, translatedVariableNameMapJsonString] =
            findCodeblocks(markdown);

          //set the code to the map
          translationMap[path] = translatedCodeString;

          const translatedVariableNameMap = JSON.parse(
            translatedVariableNameMapJsonString,
          );

          // add the map
          Object.keys(translatedVariableNameMap).map((key) => {
            variableNameMap[key] = translatedVariableNameMap[key];
          });
        }

        // now we have translated all paths one by one, streaming the intermediate result.
        // this includes the yaml file hierarchy translation
        // const filenameTranslationYamlString =
        //   translationMap[yamlFileHierarchyPath];
        // const filenameTranslationHierarchy = yaml.parse(
        //   filenameTranslationYamlString,
        // );
        // const translatedPathsArray = nestedPathObjectToQueryPathsArray(
        //   filenameTranslationHierarchy,
        //   undefined,
        //   (item) => typeof item !== "object",
        // );
        const translationFileHierarchyContent = {};

        pathsArray.map((path, index) => {
          const chunks = path.split("/");
          // if we can rely on order, should stay the same!
          const translation = translationMap[pathsArray[index]];
          setNestedValue(translationFileHierarchyContent, chunks, translation);
        });

        controller.enqueue(jsonSplitter);

        // TODO: rather, use the github API and create a new repo with these contents.
        controller.enqueue(JSON.stringify(translationFileHierarchyContent));

        controller.close();
      },
    }),
  );
};
