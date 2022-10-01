import { expandGlob } from "https://deno.land/std@0.157.0/fs/expand_glob.ts";
import { parse } from "https://deno.land/std@0.158.0/encoding/yaml.ts";

async function process(path: string) {
  const manifestBody = await Deno.readTextFile(path + "/manifest.yaml");
  // deno-lint-ignore no-explicit-any
  const manifest: any = parse(manifestBody);
  const foo = await Deno.run({
    cmd: ["remodel", "run", "dump-gear", manifest.id, path],
    env: {
      // Remodel spams output if I don't define a cookie, so we may as well tell it to shut up.
      REMODEL_AUTH: "SHUT UP!",
    },
  });
  console.log(await foo.status());
}

const promises = [];
for await (const dir of expandGlob("gears/*/*")) {
  promises.push(process(dir.path));
}

await Promise.all(promises);

await Deno.run({
  cmd: ["stylua", "gears"],
  cwd: "gears",
});
await Deno.run({
  cmd: ["deno", "fmt"],
  cwd: "gears",
});
