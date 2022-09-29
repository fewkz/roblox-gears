import { stringify } from "https://deno.land/std@0.157.0/encoding/yaml.ts";
import { Sha256 } from "https://deno.land/x/sha2@1.0.0/mod/sha256.ts";
import { snakeCase } from "https://deno.land/x/case@2.1.1/mod.ts";
import { emptyDirSync } from "https://deno.land/std@0.157.0/fs/mod.ts";

emptyDirSync("gears");
// deno-lint-ignore no-explicit-any
async function processGear(gear: any) {
  const hash = new Sha256().hashToLowerHex(gear.id.toString()).substring(0, 8);
  const snakedName = snakeCase(gear.name).replace("_s_", "s_");
  // const root = `gears/${snakedName}_${hash}`;
  const firstLetter = snakedName.substring(0, 1);
  const root = `gears/${firstLetter}/${snakedName}_${hash}`;
  const tags: string[] = [];
  tags.push(gear.priceStatus == "Offsale" ? "Offsale" : "Onsale");
  const manifestBody = stringify({
    name: gear.name,
    id: gear.id,
    tags: tags,
  });
  await Deno.mkdir(root, {
    recursive: true,
  });
  await Deno.writeTextFile(`${root}/manifest.yaml`, manifestBody);
}

async function getDetailsPage(cursor?: string) {
  const params = new URLSearchParams({
    category: "Accessories",
    includeNotForSale: "true",
    limit: "30",
    sortType: "3",
    subcategory: "Gear",
    ...cursor && { cursor },
  });
  const res = await fetch("https://catalog.roproxy.com/v1/search/items/details?" + params);
  const body = await res.json();
  return {
    nextCursor: body.nextPageCursor,
    data: body.data,
  };
}

async function getIdsPage(cursor: string) {
  const params = new URLSearchParams({
    category: "Accessories",
    includeNotForSale: "true",
    limit: "120",
    sortType: "3",
    subcategory: "Gear",
    cursor: cursor,
  });
  const res = await fetch("https://catalog.roproxy.com/v1/search/items?" + params);
  const body = await res.json();
  // deno-lint-ignore no-explicit-any
  const ids: number[] = body.data.map((entry: { id: any }) => entry.id);
  return {
    nextCursor: body.nextPageCursor,
    data: ids,
  };
}

async function iteratePages<T>(
  getPageFn: (cursor: string) => Promise<{ nextCursor: string; data: T[] }>,
  callback: (arg0: T) => void,
) {
  let lastCursor = "";
  let processed = 0;
  while (lastCursor || processed == 0) {
    const res = await getPageFn(lastCursor);
    res.data.forEach(callback);
    lastCursor = res.nextCursor;
    processed += res.data.length;
    console.log(`${processed} items processed`);
  }
  console.log("Finished processing all items");
}

await iteratePages(getIdsPage, (id) => {
  console.log(id);
});
